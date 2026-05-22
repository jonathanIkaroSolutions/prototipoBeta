from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Cliente, Turno, TareaTurno


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ['username', 'first_name', 'last_name', 'rol', 'zona', 'email']
    list_filter = ['rol']
    fieldsets = UserAdmin.fieldsets + (
        ('Información adicional', {'fields': ('rol', 'telefono', 'especialidad', 'vehiculo', 'zona', 'coordinador')}),
    )


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'nif', 'correo_electronico', 'telefono', 'ciudad', 'tipo_equipo', 'activo']
    list_filter = ['activo', 'ciudad', 'tipo_equipo']
    search_fields = ['nombre', 'nif', 'correo_electronico']


class TareaTurnoInline(admin.TabularInline):
    model = TareaTurno
    extra = 0
    fields = ['orden', 'cliente', 'tipo_servicio', 'estado', 'hora_estimada', 'duracion_estimada', 'es_reserva']


@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = ['tecnico', 'fecha', 'tipo_turno']
    list_filter = ['fecha', 'tipo_turno', 'tecnico']
    inlines = [TareaTurnoInline]


@admin.register(TareaTurno)
class TareaTurnoAdmin(admin.ModelAdmin):
    list_display = ['id', 'turno', 'cliente', 'tipo_servicio', 'estado', 'hora_estimada', 'es_reserva']
    list_filter = ['estado', 'tipo_servicio', 'es_reserva']
    search_fields = ['cliente__nombre', 'descripcion']
