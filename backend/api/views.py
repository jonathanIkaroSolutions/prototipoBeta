from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.db import models
from datetime import date

from .models import Usuario, Cliente, Turno, TareaTurno, Zona
from .serializers import (
    UsuarioSerializer, LoginSerializer, ClienteSerializer,
    TurnoSerializer, TareaTurnoSerializer, ImportRowSerializer,
    ZonaSerializer
)
from .engine import importar_clientes, generar_turnos_zona, obtener_carga_por_zona


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Endpoint para login de usuario."""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UsuarioSerializer(user).data
        })
    return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
def logout_view(request):
    """Endpoint para logout."""
    if hasattr(request.user, 'auth_token'):
        request.user.auth_token.delete()
    return Response({'message': 'Sesión cerrada correctamente'})


@api_view(['GET'])
def me_view(request):
    """Obtener datos del usuario autenticado."""
    return Response(UsuarioSerializer(request.user).data)


class ClienteViewSet(viewsets.ModelViewSet):
    """CRUD completo de clientes."""
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    
    def get_queryset(self):
        queryset = Cliente.objects.all()
        activo = self.request.query_params.get('activo')
        buscar = self.request.query_params.get('buscar')
        
        if activo is not None:
            queryset = queryset.filter(activo=activo.lower() == 'true')
        if buscar:
            queryset = queryset.filter(
                models.Q(nombre__icontains=buscar) |
                models.Q(nif__icontains=buscar) |
                models.Q(correo_electronico__icontains=buscar)
            )
        return queryset


class TurnoViewSet(viewsets.ModelViewSet):
    """CRUD de turnos con tareas embebidas."""
    queryset = Turno.objects.all()
    serializer_class = TurnoSerializer
    
    def get_queryset(self):
        queryset = Turno.objects.prefetch_related('tareas', 'tareas__cliente').all()
        tecnico_id = self.request.query_params.get('tecnico')
        fecha = self.request.query_params.get('fecha')
        
        if tecnico_id:
            queryset = queryset.filter(tecnico_id=tecnico_id)
        if fecha:
            queryset = queryset.filter(fecha=fecha)
        return queryset


class TareaTurnoViewSet(viewsets.ModelViewSet):
    """CRUD de tareas individuales."""
    queryset = TareaTurno.objects.all()
    serializer_class = TareaTurnoSerializer

    def get_queryset(self):
        queryset = TareaTurno.objects.select_related('cliente', 'turno').all()
        turno_id = self.request.query_params.get('turno')
        estado = self.request.query_params.get('estado')
        if turno_id:
            queryset = queryset.filter(turno_id=turno_id)
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset


class UsuarioViewSet(viewsets.ModelViewSet):
    """CRUD de usuarios (técnicos y coordinadores)."""
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    
    def get_queryset(self):
        queryset = Usuario.objects.all()
        rol = self.request.query_params.get('rol')
        if rol:
            queryset = queryset.filter(rol=rol)
        return queryset


class ZonaViewSet(viewsets.ModelViewSet):
    """CRUD de zonas geográficas."""
    queryset = Zona.objects.all()
    serializer_class = ZonaSerializer
    
    def get_queryset(self):
        queryset = Zona.objects.all()
        activa = self.request.query_params.get('activa')
        if activa is not None:
            queryset = queryset.filter(activa=activa.lower() == 'true')
        return queryset


@api_view(['GET'])
def itinerario_tecnico(request, tecnico_id):
    """Obtener el itinerario de un técnico para una fecha específica."""
    fecha_str = request.query_params.get('fecha', str(date.today()))
    
    try:
        tecnico = Usuario.objects.get(id=tecnico_id, rol='tecnico')
    except Usuario.DoesNotExist:
        return Response(
            {'error': 'Técnico no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    turno = Turno.objects.filter(tecnico=tecnico, fecha=fecha_str).first()
    tareas = []
    if turno:
        tareas = TareaTurno.objects.filter(turno=turno).select_related('cliente').order_by('orden')

    data = {
        'tecnico': UsuarioSerializer(tecnico).data,
        'fecha': fecha_str,
        'turno': TurnoSerializer(turno).data if turno else None,
        'tareas': TareaTurnoSerializer(tareas, many=True).data,
    }
    
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def importar_csv(request):
    """
    Importar clientes del CSV con generación automática de turnos.
    Crea/actualiza clientes, les asigna zona por CP, y genera turnos+tareas
    automáticamente usando la fecha_programada del CSV.
    """
    filas = request.data.get('filas', [])
    if not filas:
        return Response({'error': 'No se enviaron filas'}, status=status.HTTP_400_BAD_REQUEST)

    # Validar filas con serializer
    clientes_data = []
    errores_validacion = []
    
    for i, fila_data in enumerate(filas):
        ser = ImportRowSerializer(data=fila_data)
        if not ser.is_valid():
            errores_validacion.append(f"Fila {i+1} inválida: {ser.errors}")
            continue
        clientes_data.append(ser.validated_data)
    
    if not clientes_data:
        return Response(
            {'error': 'No hay filas válidas', 'errores': errores_validacion},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Importar clientes Y generar turnos automáticamente
    resultado = importar_clientes(clientes_data)
    resultado['errores'] = errores_validacion + resultado.get('errores', [])
    
    return Response(resultado, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def carga_zonas(request):
    """
    Devuelve la carga pendiente de cada zona.
    El coordinador usa esto para ver cuántos clientes hay por zona
    y decidir qué técnicos asignar a cada una.
    """
    data = obtener_carga_por_zona()
    return Response(data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def generar_turnos(request):
    """
    PASO 2: Generar turnos para una zona con técnicos asignados.
    
    Body esperado:
    {
        "zona_id": 1,
        "tecnico_ids": [3, 4],
        "fecha_inicio": "2026-05-22"  (opcional, default: mañana)
    }
    """
    zona_id = request.data.get('zona_id')
    tecnico_ids = request.data.get('tecnico_ids', [])
    fecha_inicio_str = request.data.get('fecha_inicio')
    
    if not zona_id:
        return Response({'error': 'zona_id es obligatorio'}, status=status.HTTP_400_BAD_REQUEST)
    if not tecnico_ids:
        return Response({'error': 'tecnico_ids es obligatorio (lista de IDs)'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Parsear fecha
    fecha_inicio = None
    if fecha_inicio_str:
        try:
            parts = fecha_inicio_str.split('-')
            fecha_inicio = date(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, IndexError):
            pass
    
    resultado = generar_turnos_zona(zona_id, tecnico_ids, fecha_inicio)
    
    if resultado.get('errores') and not resultado.get('tareas_asignadas'):
        return Response(resultado, status=status.HTTP_400_BAD_REQUEST)
    
    return Response(resultado, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_datos(request):
    """
    Borra TODOS los clientes, turnos y tareas.
    Resetea las zonas de los técnicos a null.
    Útil para demo/testing.
    """
    tareas_borradas = TareaTurno.objects.count()
    turnos_borrados = Turno.objects.count()
    clientes_borrados = Cliente.objects.count()
    
    TareaTurno.objects.all().delete()
    Turno.objects.all().delete()
    Cliente.objects.all().delete()
    
    # Resetear zona de técnicos
    Usuario.objects.filter(rol='tecnico').update(zona=None)
    
    return Response({
        'mensaje': 'Datos reseteados correctamente',
        'tareas_borradas': tareas_borradas,
        'turnos_borrados': turnos_borrados,
        'clientes_borrados': clientes_borrados,
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def geocodificar_clientes(request):
    """
    Re-geocodifica clientes que no tienen coordenadas.
    Útil para reprocesar direcciones o tras configurar la API key.
    
    Body opcional:
    {
        "cliente_ids": [1, 2, 3]  // Si no se pasa, geocodifica todos los pendientes
        "forzar": false           // Si true, re-geocodifica incluso los ya geocodificados
    }
    """
    from .geocoding import geocodificar_lote, limpiar_cache
    
    limpiar_cache()
    
    cliente_ids = request.data.get('cliente_ids', [])
    forzar = request.data.get('forzar', False)
    
    if cliente_ids:
        queryset = Cliente.objects.filter(id__in=cliente_ids)
    elif forzar:
        queryset = Cliente.objects.filter(activo=True)
    else:
        queryset = Cliente.objects.filter(activo=True, geocodificado=False)
    
    if not queryset.exists():
        return Response({'mensaje': 'No hay clientes pendientes de geocodificar'})
    
    resultado = geocodificar_lote(queryset)
    return Response(resultado)
