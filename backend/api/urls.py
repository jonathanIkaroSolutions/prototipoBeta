from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'clientes', views.ClienteViewSet)
router.register(r'turnos', views.TurnoViewSet)
router.register(r'tareas', views.TareaTurnoViewSet)
router.register(r'usuarios', views.UsuarioViewSet)
router.register(r'zonas', views.ZonaViewSet)

urlpatterns = [
    # Custom paths BEFORE router to avoid conflicts
    path('auth/login/', views.login_view, name='login'),
    path('auth/logout/', views.logout_view, name='logout'),
    path('auth/me/', views.me_view, name='me'),
    path('itinerario/<int:tecnico_id>/', views.itinerario_tecnico, name='itinerario'),
    path('importar/', views.importar_csv, name='importar_csv'),
    path('carga-zonas/', views.carga_zonas, name='carga_zonas'),
    path('generar-turnos/', views.generar_turnos, name='generar_turnos'),
    path('reset/', views.reset_datos, name='reset_datos'),
    path('geocodificar/', views.geocodificar_clientes, name='geocodificar_clientes'),
    # Router at the end
    path('', include(router.urls)),
]
