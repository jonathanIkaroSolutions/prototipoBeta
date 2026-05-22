"""
Script para generar demo completa:
1. Importa los 89 clientes del CSV
2. Asigna 1 técnico por zona
3. Genera turnos repartidos por días (max 10/día)

Resultado: cada técnico tiene turnos distribuidos por varios días de la semana
"""
import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from datetime import date
from api.models import Usuario, Zona, Cliente
from api.engine import importar_clientes, generar_turnos_zona

# ═══════════ PASO 1: IMPORTAR CLIENTES DEL CSV ═══════════
print("\n═══ PASO 1: IMPORTANDO CLIENTES DEL CSV ═══")

csv_path = os.path.join(os.path.dirname(__file__), '..', 'datos_clientes_importacion.csv')
with open(csv_path, encoding='latin-1') as f:
    contenido = f.read()

lineas = contenido.strip().split('\n')
cabecera = lineas[0].split(';')
filas = []

for linea in lineas[1:]:
    valores = linea.split(';')
    if len(valores) < len(cabecera):
        continue
    fila = {}
    for i, col in enumerate(cabecera):
        fila[col.strip()] = valores[i].strip() if i < len(valores) else ''
    filas.append(fila)

resultado = importar_clientes(filas)
print(f"  Clientes creados: {resultado['clientes_creados']}")
print(f"  Clientes actualizados: {resultado['clientes_actualizados']}")
print(f"  Clientes sin zona: {resultado['clientes_sin_zona']}")
print(f"  Errores: {len(resultado['errores'])}")
for zona_info in resultado['resumen_por_zona']:
    print(f"    → {zona_info['zona']}: {zona_info['clientes_importados']} clientes")

# ═══════════ PASO 2: ASIGNAR TÉCNICOS A ZONAS ═══════════
print("\n═══ PASO 2: ASIGNANDO TÉCNICOS A ZONAS ═══")

# Orden de las zonas por carga (más clientes primero)
zonas = list(Zona.objects.filter(activa=True).order_by('id'))
tecnicos = list(Usuario.objects.filter(rol='tecnico').order_by('id'))

# Asignación: 1 técnico por zona (6 zonas, 6 técnicos)
asignaciones = {}
for i, zona in enumerate(zonas):
    if i < len(tecnicos):
        tecnico = tecnicos[i]
        tecnico.zona = zona
        tecnico.save(update_fields=['zona'])
        asignaciones[zona.id] = [tecnico.id]
        clientes_zona = Cliente.objects.filter(zona=zona, activo=True).count()
        print(f"  {tecnico.get_full_name()} → {zona.nombre} ({clientes_zona} clientes)")

# ═══════════ PASO 3: GENERAR TURNOS ═══════════
print("\n═══ PASO 3: GENERANDO TURNOS (max 10/día, lun-vie) ═══")

# Fecha inicio: lunes 25 mayo 2026
fecha_inicio = date(2026, 5, 25)

for zona in zonas:
    tecnico_ids = asignaciones.get(zona.id, [])
    if not tecnico_ids:
        continue
    
    res = generar_turnos_zona(zona.id, tecnico_ids, fecha_inicio)
    
    for resumen in res['resumen_por_tecnico']:
        print(f"  {resumen['tecnico']} ({resumen['zona']}): {resumen['tareas']} tareas → {res['turnos_creados']} turnos")
    
    if res['errores']:
        for err in res['errores']:
            print(f"    ⚠ {err}")

# ═══════════ RESUMEN FINAL ═══════════
print("\n═══ RESUMEN FINAL ═══")
from api.models import Turno, TareaTurno

total_turnos = Turno.objects.count()
total_tareas = TareaTurno.objects.filter(es_reserva=False).count()

print(f"  Total turnos creados: {total_turnos}")
print(f"  Total tareas asignadas: {total_tareas}")
print(f"  Total clientes: {Cliente.objects.count()}")

print("\n  Distribución por día:")
from django.db.models import Count
dias = Turno.objects.values('fecha').annotate(n=Count('id')).order_by('fecha')
dias_semana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
for d in dias:
    dia_nombre = dias_semana[d['fecha'].weekday()]
    tareas_dia = TareaTurno.objects.filter(turno__fecha=d['fecha'], es_reserva=False).count()
    print(f"    {dia_nombre} {d['fecha']}: {d['n']} turno(s) - {tareas_dia} tareas")
