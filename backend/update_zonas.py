"""Script para actualizar zonas a las 3 operativas: Zaragoza, Huesca, Pamplona."""
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Zona, Cliente, Usuario
from api.engine import detectar_zona_por_cp

# Eliminar zonas antiguas (sub-zonas de Zaragoza)
old_zonas = Zona.objects.exclude(nombre__in=['Zaragoza', 'Huesca', 'Pamplona'])
print(f'Eliminando {old_zonas.count()} zonas antiguas...')

# Reasignar clientes y tecnicos de zonas antiguas a None temporalmente
Cliente.objects.filter(zona__in=old_zonas).update(zona=None)
Usuario.objects.filter(zona__in=old_zonas).update(zona=None)
old_zonas.delete()

# Crear las 3 zonas operativas
zonas_data = [
    {
        'nombre': 'Zaragoza',
        'descripcion': 'Zona metropolitana de Zaragoza y alrededores',
        'codigos_postales': '50001,50002,50003,50004,50005,50006,50007,50008,50009,50010,50011,50012,50013,50014,50015,50016,50017,50018,50019,50059,50180,50190,50196,50410,50420,50430,50500,50600,50620,50800',
    },
    {
        'nombre': 'Huesca',
        'descripcion': 'Provincia de Huesca: capital, Monzon, Barbastro, Jaca, Sabinanigo',
        'codigos_postales': '22001,22002,22003,22004,22005,22006,22080,22300,22400,22500,22520,22600,22700',
    },
    {
        'nombre': 'Pamplona',
        'descripcion': 'Zona de Pamplona/Iruna y comarca: Baranain, Burlada, Villava, Tudela, Estella',
        'codigos_postales': '31001,31002,31003,31004,31005,31006,31007,31008,31009,31010,31011,31012,31013,31014,31015,31100,31200,31300,31400,31500,31600',
    },
]

for data in zonas_data:
    zona, created = Zona.objects.get_or_create(
        nombre=data['nombre'],
        defaults={
            'descripcion': data['descripcion'],
            'codigos_postales': data['codigos_postales'],
            'activa': True
        }
    )
    if not created:
        zona.codigos_postales = data['codigos_postales']
        zona.descripcion = data['descripcion']
        zona.save()
    status = 'Creada' if created else 'Actualizada'
    print(f'  {status}: {zona.nombre}')

# Reasignar clientes existentes a la zona correcta por CP
clientes_sin = Cliente.objects.filter(zona__isnull=True)
total_sin = clientes_sin.count()
reasignados = 0
for c in clientes_sin:
    if c.codigo_postal:
        z = detectar_zona_por_cp(c.codigo_postal)
        if z:
            c.zona = z
            c.save(update_fields=['zona'])
            reasignados += 1

print(f'\nReasignados {reasignados}/{total_sin} clientes a sus nuevas zonas')

# Reasignar tecnicos a Zaragoza por defecto (la zona principal)
zona_zgz = Zona.objects.get(nombre='Zaragoza')
tecnicos_sin = Usuario.objects.filter(rol='tecnico', zona__isnull=True)
tecnicos_sin.update(zona=zona_zgz)
print(f'Tecnicos asignados a Zaragoza: {tecnicos_sin.count()}')

print(f'\nZonas finales:')
for z in Zona.objects.filter(activa=True):
    n_clientes = Cliente.objects.filter(zona=z).count()
    n_tecnicos = Usuario.objects.filter(zona=z, rol='tecnico').count()
    print(f'  {z.nombre}: {n_clientes} clientes, {n_tecnicos} tecnicos')
