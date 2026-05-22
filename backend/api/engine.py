"""
Motor de auto-asignación de turnos.

Flujo en 2 pasos:

PASO 1 - Importar clientes (coordinador sube CSV):
  1. Se suben clientes (CSV) con dirección/CP
  2. El sistema detecta la zona por CP automáticamente
  3. Clientes quedan en "pool" pendientes de asignar (sin turno)

PASO 2 - Generar turnos (coordinador asigna técnicos a zonas):
  1. Coordinador ve carga por zona (cuántos clientes pendientes)
  2. Coordinador asigna técnico(s) a zona(s)
  3. Sistema genera turnos: reparte clientes de cada zona al técnico asignado
  4. Máx X tareas/día, calcula horas, crea turnos + tareas
"""
from datetime import date, timedelta
from django.db import models
from django.db.models import Count, Q
from .models import Zona, Usuario, Cliente, Turno, TareaTurno
from .geocoding import geocodificar_cliente, limpiar_cache


# ══════════════════════════════════════════════════════════════
# PASO 1: IMPORTAR CLIENTES → DETECTAR ZONA
# ══════════════════════════════════════════════════════════════

def detectar_zona_por_cp(codigo_postal: str) -> 'Zona | None':
    """Detecta la zona a la que pertenece un código postal."""
    zonas = Zona.objects.filter(activa=True)
    for zona in zonas:
        cps = zona.get_codigos_postales_list()
        if codigo_postal in cps:
            return zona
    return None


def detectar_zona_por_nombre(nombre_zona: str) -> 'Zona | None':
    """Busca zona por nombre (match parcial, case insensitive)."""
    try:
        return Zona.objects.get(nombre__iexact=nombre_zona, activa=True)
    except Zona.DoesNotExist:
        zonas = Zona.objects.filter(nombre__icontains=nombre_zona, activa=True)
        return zonas.first()


def importar_clientes(clientes_data: list) -> dict:
    """
    Importa clientes del CSV, les asigna zona por CP y genera automáticamente
    turnos y tareas cuando la fila incluye fecha_programada.
    
    Flujo:
      1. Crea/actualiza cliente
      2. Detecta zona por CP o nombre
      3. Si hay fecha_programada → busca técnico de la zona → crea turno + tarea
    
    Returns:
        Dict con resultado de la importación y turnos generados
    """
    resultado = {
        'clientes_creados': 0,
        'clientes_actualizados': 0,
        'turnos_creados': 0,
        'tareas_creadas': 0,
        'errores': [],
        'resumen_por_zona': [],
        'clientes_sin_zona': 0,
        'geocoding': {
            'exitosos': 0,
            'fallidos': 0,
            'errores_geocoding': [],
        },
    }
    
    # Limpiar cache de geocoding al inicio de cada importación
    limpiar_cache()
    
    # Contadores por zona
    zona_counts = {}
    
    for datos in clientes_data:
        # 1. Crear o actualizar cliente
        cliente = _crear_o_actualizar_cliente(datos, resultado)
        if not cliente:
            continue
        
        # 1b. Geocodificar dirección via Google Geocoding API
        if not cliente.geocodificado and cliente.direccion:
            ok = geocodificar_cliente(cliente)
            if ok:
                resultado['geocoding']['exitosos'] += 1
            else:
                resultado['geocoding']['fallidos'] += 1
                resultado['geocoding']['errores_geocoding'].append(
                    f"No se pudo geocodificar: {cliente.nombre} - "
                    f"{cliente.direccion}, {cliente.ciudad}"
                )
        
        # 2. Detectar zona: primero por CP (más fiable), luego por nombre
        zona = None
        if cliente.codigo_postal:
            zona = detectar_zona_por_cp(cliente.codigo_postal)
        if not zona and datos.get('zona'):
            zona = detectar_zona_por_nombre(datos['zona'])
        
        if zona:
            if cliente.zona != zona:
                cliente.zona = zona
                cliente.save(update_fields=['zona'])
            
            # Contar para resumen
            if zona.id not in zona_counts:
                zona_counts[zona.id] = {'nombre': zona.nombre, 'count': 0}
            zona_counts[zona.id]['count'] += 1
        else:
            resultado['clientes_sin_zona'] += 1
            resultado['errores'].append(
                f"No se detectó zona para '{cliente.nombre}' "
                f"(CP: {cliente.codigo_postal})"
            )
        
        # 3. Si hay fecha_programada → generar turno y tarea automáticamente
        fecha_programada_str = datos.get('fecha_programada', '').strip()
        if fecha_programada_str and zona:
            _crear_tarea_desde_importacion(cliente, zona, datos, resultado)
    
    # Resumen por zona
    resultado['resumen_por_zona'] = [
        {'zona_id': zid, 'zona': data['nombre'], 'clientes_importados': data['count']}
        for zid, data in zona_counts.items()
    ]
    
    return resultado


# ══════════════════════════════════════════════════════════════
# PASO 2: GENERAR TURNOS (coordinador asigna técnicos a zonas)
# ══════════════════════════════════════════════════════════════

def obtener_carga_por_zona() -> list:
    """
    Devuelve la carga pendiente de cada zona (clientes sin turno asignado).
    El coordinador usa esto para decidir qué técnicos asignar.
    """
    zonas = Zona.objects.filter(activa=True)
    resultado = []
    
    for zona in zonas:
        # Clientes en esta zona que NO tienen tarea pendiente
        clientes_zona = Cliente.objects.filter(zona=zona, activo=True)
        clientes_con_tarea = TareaTurno.objects.filter(
            cliente__zona=zona,
            estado__in=['pendiente', 'en_curso']
        ).values_list('cliente_id', flat=True)
        
        clientes_sin_asignar = clientes_zona.exclude(id__in=clientes_con_tarea).count()
        clientes_total = clientes_zona.count()
        
        # Técnicos actualmente asignados a esta zona
        tecnicos_zona = Usuario.objects.filter(rol='tecnico', zona=zona)
        
        resultado.append({
            'zona_id': zona.id,
            'zona': zona.nombre,
            'clientes_total': clientes_total,
            'clientes_sin_asignar': clientes_sin_asignar,
            'tecnicos_asignados': [
                {'id': t.id, 'nombre': t.get_full_name()}
                for t in tecnicos_zona
            ],
        })
    
    return resultado


def generar_turnos_zona(zona_id: int, tecnico_ids: list, fecha_inicio: date = None,
                        tipo_servicio_default: str = 'gas') -> dict:
    """
    PASO 2: Genera turnos para una zona con los técnicos asignados.
    
    El coordinador elige:
    - Qué zona procesar
    - Qué técnico(s) cubren esa zona
    - Desde qué fecha empezar
    
    El sistema:
    - Coge todos los clientes de esa zona SIN tarea pendiente
    - Los reparte entre los técnicos asignados (equitativo)
    - Genera turnos (máx tareas/día por técnico)
    - Calcula horas estimadas
    """
    if fecha_inicio is None:
        fecha_inicio = date.today() + timedelta(days=1)
    
    resultado = {
        'tareas_asignadas': 0,
        'turnos_creados': 0,
        'reservas_creadas': 0,
        'errores': [],
        'resumen_por_tecnico': [],
    }
    
    # Validar zona
    try:
        zona = Zona.objects.get(id=zona_id, activa=True)
    except Zona.DoesNotExist:
        resultado['errores'].append(f"Zona con id {zona_id} no encontrada")
        return resultado
    
    # Validar técnicos
    tecnicos = list(Usuario.objects.filter(id__in=tecnico_ids, rol='tecnico'))
    if not tecnicos:
        resultado['errores'].append("No se encontraron técnicos válidos")
        return resultado
    
    # Asignar la zona a los técnicos (actualizar su zona)
    for tecnico in tecnicos:
        if tecnico.zona_id != zona.id:
            tecnico.zona = zona
            tecnico.save(update_fields=['zona'])
    
    # Obtener clientes de esta zona SIN tarea pendiente
    clientes_con_tarea = TareaTurno.objects.filter(
        cliente__zona=zona,
        estado__in=['pendiente', 'en_curso']
    ).values_list('cliente_id', flat=True)
    
    clientes_pendientes = list(
        Cliente.objects.filter(zona=zona, activo=True)
        .exclude(id__in=clientes_con_tarea)
        .order_by('codigo_postal', 'direccion')  # Agrupar por proximidad
    )
    
    if not clientes_pendientes:
        resultado['errores'].append(f"No hay clientes pendientes en zona '{zona.nombre}'")
        return resultado
    
    # Repartir clientes entre técnicos (round-robin equitativo)
    reparto = {t.id: [] for t in tecnicos}
    for i, cliente in enumerate(clientes_pendientes):
        tecnico = tecnicos[i % len(tecnicos)]
        reparto[tecnico.id].append(cliente)
    
    # Generar turnos para cada técnico
    for tecnico in tecnicos:
        clientes_tecnico = reparto[tecnico.id]
        if not clientes_tecnico:
            continue
        
        max_dia = tecnico.max_tareas_dia or 12
        fecha_actual = fecha_inicio
        tareas_en_dia = 0
        turno_actual = None
        
        for cliente in clientes_tecnico:
            # Buscar día con hueco
            fecha_actual = _siguiente_dia_con_hueco(tecnico, fecha_actual, max_dia)
            
            # Crear o buscar turno
            if turno_actual is None or turno_actual.fecha != fecha_actual:
                turno_actual, created = Turno.objects.get_or_create(
                    tecnico=tecnico,
                    fecha=fecha_actual,
                    defaults={'tipo_turno': 'completo', 'notas_coordinador': f'Auto-generado zona {zona.nombre}'}
                )
                if created:
                    resultado['turnos_creados'] += 1
                tareas_en_dia = turno_actual.tareas.filter(es_reserva=False).count()
            
            # Si el día está lleno, avanzar
            if tareas_en_dia >= max_dia:
                fecha_actual += timedelta(days=1)
                fecha_actual = _siguiente_dia_con_hueco(tecnico, fecha_actual, max_dia)
                turno_actual, created = Turno.objects.get_or_create(
                    tecnico=tecnico,
                    fecha=fecha_actual,
                    defaults={'tipo_turno': 'completo', 'notas_coordinador': f'Auto-generado zona {zona.nombre}'}
                )
                if created:
                    resultado['turnos_creados'] += 1
                tareas_en_dia = turno_actual.tareas.filter(es_reserva=False).count()
            
            # Crear tarea
            tareas_en_dia += 1
            orden = tareas_en_dia
            hora = _calcular_hora(turno_actual, orden)
            
            TareaTurno.objects.create(
                turno=turno_actual,
                cliente=cliente,
                orden=orden,
                tipo_servicio=tipo_servicio_default,
                estado='pendiente',
                hora_estimada=hora,
                duracion_estimada=45,
                descripcion='',
                prioridad=2,
                confirmacion='sin_avisar',
                es_reserva=False,
            )
            resultado['tareas_asignadas'] += 1
        
        # Resumen
        resultado['resumen_por_tecnico'].append({
            'tecnico_id': tecnico.id,
            'tecnico': tecnico.get_full_name(),
            'zona': zona.nombre,
            'tareas': len(clientes_tecnico),
        })
    
    return resultado


# ══════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ══════════════════════════════════════════════════════════════

def _crear_tarea_desde_importacion(cliente, zona, datos, resultado):
    """
    Crea automáticamente un turno y una tarea para un cliente importado
    que tiene fecha_programada en el CSV.
    
    - Los clientes del CSV ya están confirmados (cita cerrada)
    - Asigna técnico por zona con balanceo de carga por día
    - Calcula hora escalonada según orden en turno
    """
    from datetime import date as date_cls
    
    # Parsear fecha
    fecha_str = datos.get('fecha_programada', '').strip()
    try:
        parts = fecha_str.split('-')
        fecha = date_cls(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError):
        resultado['errores'].append(
            f"Fecha inválida '{fecha_str}' para cliente '{cliente.nombre}'"
        )
        return
    
    # Buscar técnico de la zona con balanceo de carga para ese día
    tecnico = _buscar_tecnico_para_zona_dia(zona, fecha)
    
    if not tecnico:
        resultado['errores'].append(
            f"No hay técnicos disponibles para asignar tarea de '{cliente.nombre}'"
        )
        return
    
    # Crear o buscar turno para ese técnico en esa fecha
    turno, turno_created = Turno.objects.get_or_create(
        tecnico=tecnico,
        fecha=fecha,
        defaults={
            'tipo_turno': 'completo',
            'notas_coordinador': f'Auto-generado importación zona {zona.nombre}'
        }
    )
    if turno_created:
        resultado['turnos_creados'] += 1
    
    # Calcular orden (siguiente tarea disponible)
    orden_actual = turno.tareas.filter(es_reserva=False).count() + 1
    
    # Calcular hora escalonada según el orden en el turno
    hora = _calcular_hora(turno, orden_actual)
    
    # Datos de la tarea
    tipo_servicio = datos.get('tipo_servicio', 'gas').strip()
    duracion = datos.get('duracion_estimada', 45)
    prioridad = datos.get('prioridad', 2)
    descripcion = datos.get('descripcion', '').strip()
    es_reserva = datos.get('es_reserva', False)
    if isinstance(es_reserva, str):
        es_reserva = es_reserva.lower() in ('true', '1', 'si', 'sí')
    
    # Verificar que no exista ya una tarea para este cliente en este turno
    if TareaTurno.objects.filter(turno=turno, cliente=cliente).exists():
        return
    
    # Los clientes importados ya vienen con cita cerrada/confirmada
    TareaTurno.objects.create(
        turno=turno,
        cliente=cliente,
        orden=orden_actual,
        tipo_servicio=tipo_servicio,
        estado='pendiente',
        hora_estimada=hora,
        duracion_estimada=duracion if isinstance(duracion, int) else 45,
        descripcion=descripcion,
        prioridad=prioridad if isinstance(prioridad, int) else 2,
        confirmacion='confirmado',
        es_reserva=es_reserva,
    )
    resultado['tareas_creadas'] += 1


def _buscar_tecnico_para_zona_dia(zona, fecha):
    """
    Busca el mejor técnico para una zona en un día concreto.
    Prioridad:
      1. Técnico asignado a la zona con hueco ese día
      2. Si hay varios en la misma zona, el menos cargado ese día
      3. Si no hay técnico en la zona, auto-asigna uno libre
    """
    # Técnicos ya asignados a esta zona
    tecnicos_zona = list(Usuario.objects.filter(rol='tecnico', zona=zona))
    
    if tecnicos_zona:
        # Elegir el que menos tareas tiene ese día
        mejor = None
        menos_tareas = 999
        for tec in tecnicos_zona:
            n_tareas = TareaTurno.objects.filter(
                turno__tecnico=tec, turno__fecha=fecha, es_reserva=False
            ).count()
            if n_tareas < tec.max_tareas_dia and n_tareas < menos_tareas:
                menos_tareas = n_tareas
                mejor = tec
        if mejor:
            return mejor
    
    # No hay técnico en la zona o están llenos → asignar uno libre
    tecnico = Usuario.objects.filter(rol='tecnico', zona__isnull=True).first()
    if not tecnico:
        # Todos tienen zona → buscar el globalmente menos cargado ese día
        from django.db.models import Count, Q
        tecnico = (
            Usuario.objects.filter(rol='tecnico')
            .annotate(
                n_tareas_dia=Count(
                    'turnos__tareas',
                    filter=Q(turnos__fecha=fecha, turnos__tareas__es_reserva=False)
                )
            )
            .filter(n_tareas_dia__lt=models.F('max_tareas_dia'))
            .order_by('n_tareas_dia')
            .first()
        )
    
    if tecnico:
        # Asignar este técnico a la zona
        tecnico.zona = zona
        tecnico.save(update_fields=['zona'])
    
    return tecnico


def _siguiente_dia_con_hueco(tecnico, fecha_inicio, max_tareas):
    """Encuentra siguiente día laborable con hueco."""
    fecha = fecha_inicio
    intentos = 0
    
    while intentos < 90:
        if fecha.weekday() < 5:  # Lun-Vie
            tareas_dia = TareaTurno.objects.filter(
                turno__tecnico=tecnico,
                turno__fecha=fecha,
                es_reserva=False
            ).count()
            if tareas_dia < max_tareas:
                return fecha
        fecha += timedelta(days=1)
        intentos += 1
    
    return fecha_inicio


def _calcular_hora(turno, orden):
    """Calcula hora estimada según orden y tipo de turno.
    
    Jornada de 8h con max 10 tareas = 48min por tarea.
    Mañana: 08:00-16:00 | Tarde: 14:00-22:00 | Completo: 08:00-16:00
    """
    inicio_min = 8 * 60  # 8:00
    if turno.tipo_turno == 'tarde':
        inicio_min = 14 * 60
    
    # 48 min por tarea (8h / 10 tareas = 48min)
    minutos = inicio_min + (orden - 1) * 48
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _crear_o_actualizar_cliente(datos, resultado) -> 'Cliente | None':
    """Busca cliente por NIF o lo crea. Retorna el cliente."""
    nif = datos.get('nif', '').strip()
    if not nif:
        resultado['errores'].append(f"Cliente sin NIF: {datos.get('nombre_cliente', 'desconocido')}")
        return None
    
    try:
        cliente = Cliente.objects.get(nif=nif)
        updated = False
        for campo, valor in [
            ('telefono', datos.get('telefono')),
            ('correo_electronico', datos.get('email')),
            ('direccion', datos.get('direccion')),
            ('ciudad', datos.get('ciudad')),
            ('codigo_postal', datos.get('codigo_postal')),
            ('tipo_equipo', datos.get('tipo_equipo')),
            ('marca_equipo', datos.get('marca_equipo')),
        ]:
            if valor and valor.strip():
                setattr(cliente, campo, valor.strip())
                updated = True
        if updated:
            cliente.save()
            resultado['clientes_actualizados'] = resultado.get('clientes_actualizados', 0) + 1
    except Cliente.DoesNotExist:
        cliente = Cliente.objects.create(
            nombre=datos.get('nombre_cliente', ''),
            nif=nif,
            correo_electronico=datos.get('email', ''),
            telefono=datos.get('telefono', ''),
            direccion=datos.get('direccion', ''),
            ciudad=datos.get('ciudad', 'Zaragoza'),
            codigo_postal=datos.get('codigo_postal', ''),
            notas=datos.get('notas', ''),
            activo=True,
            tipo_equipo=datos.get('tipo_equipo', 'caldera_gas'),
            marca_equipo=datos.get('marca_equipo', ''),
        )
        resultado['clientes_creados'] += 1
    
    return cliente
