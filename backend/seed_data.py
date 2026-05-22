"""
Seed script para poblar la base de datos con datos iniciales.
Ejecutar: python seed_data.py
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import Usuario, Zona


def crear_zonas():
    """Crea las 3 zonas operativas principales de la empresa."""
    zonas_data = [
        {
            'nombre': 'Zaragoza',
            'descripcion': 'Zona metropolitana de Zaragoza y alrededores (capital + pueblos cercanos)',
            'codigos_postales': '50001,50002,50003,50004,50005,50006,50007,50008,50009,50010,50011,50012,50013,50014,50015,50016,50017,50018,50019,50059,50180,50190,50196,50410,50420,50430,50500,50600,50620,50800',
        },
        {
            'nombre': 'Huesca',
            'descripcion': 'Provincia de Huesca: capital, Monzón, Barbastro, Jaca, Sabiñánigo y alrededores',
            'codigos_postales': '22001,22002,22003,22004,22005,22006,22080,22300,22400,22500,22520,22600,22700',
        },
        {
            'nombre': 'Pamplona',
            'descripcion': 'Zona de Pamplona/Iruña y comarca: Barañáin, Burlada, Villava, Tudela, Estella',
            'codigos_postales': '31001,31002,31003,31004,31005,31006,31007,31008,31009,31010,31011,31012,31013,31014,31015,31100,31200,31300,31400,31500,31600',
        },
    ]
    
    zonas = {}
    for data in zonas_data:
        zona, created = Zona.objects.get_or_create(
            nombre=data['nombre'],
            defaults={
                'descripcion': data['descripcion'],
                'codigos_postales': data['codigos_postales'],
                'activa': True
            }
        )
        zonas[data['nombre']] = zona
        st = 'Creada' if created else 'Ya existia'
        print(f"  {st}: {zona.nombre} ({data['codigos_postales']})")
    
    return zonas


def crear_usuarios(zonas):
    """Crea coordinadores y técnicos con zonas asignadas."""
    
    # Coordinadores (solo 2)
    coordinadores_data = [
        {
            'username': 'jonathanadmin',
            'first_name': 'Jonathan',
            'last_name': 'Administrador',
            'email': 'jonathan@alonsoluzgas.es',
            'rol': 'coordinador',
            'telefono': '663302000',
        },
        {
            'username': 'coord2',
            'first_name': 'Laura',
            'last_name': 'Coordinacion',
            'email': 'laura@alonsoluzgas.es',
            'rol': 'coordinador',
            'telefono': '663302001',
        },
    ]
    
    coordinadores = []
    for data in coordinadores_data:
        user, created = Usuario.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'email': data['email'],
                'rol': data['rol'],
                'telefono': data['telefono'],
            }
        )
        if created:
            user.set_password('123')
            user.is_superuser = True
            user.is_staff = True
            user.save()
        coordinadores.append(user)
        st = 'Creado' if created else 'Ya existia'
        print(f"  {st}: {user.get_full_name()} ({user.rol})")
    
    # Técnicos (6 para probar, SIN zona - el coordinador asigna despues)
    tecnicos_data = [
        {'username': 'mgarcia', 'first_name': 'Miguel', 'last_name': 'Garcia Lopez',
         'email': 'miguel@alonsoluzgas.es', 'telefono': '666111222',
         'especialidad': 'calderas', 'vehiculo': 'Citroen Berlingo - 1234ABC'},
        {'username': 'alopez', 'first_name': 'Andres', 'last_name': 'Lopez Martin',
         'email': 'andres@alonsoluzgas.es', 'telefono': '666333444',
         'especialidad': 'gas', 'vehiculo': 'Renault Kangoo - 5678DEF'},
        {'username': 'pserrano', 'first_name': 'Pablo', 'last_name': 'Serrano Gil',
         'email': 'pablo@alonsoluzgas.es', 'telefono': '666555666',
         'especialidad': 'calderas', 'vehiculo': 'Peugeot Partner - 9012GHI'},
        {'username': 'dnavarro', 'first_name': 'David', 'last_name': 'Navarro Ruiz',
         'email': 'david@alonsoluzgas.es', 'telefono': '666777888',
         'especialidad': 'electricidad', 'vehiculo': 'Ford Transit - 3456JKL'},
        {'username': 'jmoreno', 'first_name': 'Javier', 'last_name': 'Moreno Blasco',
         'email': 'javier@alonsoluzgas.es', 'telefono': '666999000',
         'especialidad': 'general', 'vehiculo': 'Volkswagen Caddy - 7890MNO'},
        {'username': 'rcastro', 'first_name': 'Raul', 'last_name': 'Castro Perez',
         'email': 'raul@alonsoluzgas.es', 'telefono': '666112233',
         'especialidad': 'calderas', 'vehiculo': 'Citroen Berlingo - 1122PQR'},
    ]
    
    for data in tecnicos_data:
        user, created = Usuario.objects.get_or_create(
            username=data['username'],
            defaults={
                'first_name': data['first_name'],
                'last_name': data['last_name'],
                'email': data['email'],
                'rol': 'tecnico',
                'telefono': data['telefono'],
                'especialidad': data.get('especialidad', 'general'),
                'vehiculo': data.get('vehiculo', ''),
                'zona': None,
                'coordinador': coordinadores[0],
                'max_tareas_dia': 10,
            }
        )
        if created:
            user.set_password('123')
            user.save()
        st = 'Creado' if created else 'Ya existia'
        print(f"  {st}: {user.get_full_name()} (sin zona - pendiente)")


if __name__ == '__main__':
    print("\n=== CREANDO ZONAS ===")
    zonas = crear_zonas()
    print(f"\n=== CREANDO USUARIOS ===")
    crear_usuarios(zonas)
    print(f"\n Seed completado. {Usuario.objects.count()} usuarios, {Zona.objects.count()} zonas.")
