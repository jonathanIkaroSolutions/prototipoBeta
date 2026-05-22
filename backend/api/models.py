from django.db import models
from django.contrib.auth.models import AbstractUser


class Usuario(AbstractUser):
    """Modelo de usuario con roles."""
    
    class Rol(models.TextChoices):
        COORDINADOR = 'coordinador', 'Coordinador'
        TECNICO = 'tecnico', 'Técnico'
    
    rol = models.CharField(
        max_length=20,
        choices=Rol.choices,
        default=Rol.TECNICO,
    )
    telefono = models.CharField(max_length=20, blank=True)
    especialidad = models.CharField(max_length=50, blank=True)
    vehiculo = models.CharField(max_length=100, blank=True)
    zona = models.ForeignKey(
        'Zona', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tecnicos'
    )
    coordinador = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tecnicos_a_cargo',
        limit_choices_to={'rol': 'coordinador'}
    )
    max_tareas_dia = models.IntegerField(default=12, help_text='Máximo de tareas por día')
    foto = models.URLField(max_length=500, blank=True, default='', help_text='URL de la foto del técnico')
    
    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.get_rol_display()})"


class Zona(models.Model):
    """Zona geográfica para asignación automática de técnicos."""
    
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)
    codigos_postales = models.TextField(
        help_text='Códigos postales separados por coma (ej: 50001,50002,50003)',
        blank=True
    )
    activa = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'Zona'
        verbose_name_plural = 'Zonas'
        ordering = ['nombre']
    
    def get_codigos_postales_list(self):
        """Devuelve lista de CPs de esta zona."""
        if not self.codigos_postales:
            return []
        return [cp.strip() for cp in self.codigos_postales.split(',') if cp.strip()]
    
    def __str__(self):
        return self.nombre


class Cliente(models.Model):
    """Modelo para los clientes de la empresa."""
    
    nombre = models.CharField(max_length=200)
    nif = models.CharField(max_length=20, unique=True, verbose_name='NIF')
    correo_electronico = models.EmailField(verbose_name='Correo electrónico', blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    direccion = models.TextField(verbose_name='Dirección')
    ciudad = models.CharField(max_length=100, default='Zaragoza')
    codigo_postal = models.CharField(max_length=10, blank=True)
    zona = models.ForeignKey(
        Zona, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='clientes'
    )
    notas = models.TextField(blank=True)
    fecha_registro = models.DateField(auto_now_add=True)
    activo = models.BooleanField(default=True)
    tipo_equipo = models.CharField(max_length=30, default='caldera_gas')
    marca_equipo = models.CharField(max_length=100, blank=True)
    ultima_revision = models.DateField(null=True, blank=True)
    
    # Coordenadas geocodificadas (via Google Geocoding API)
    latitud = models.FloatField(null=True, blank=True, help_text='Latitud geocodificada')
    longitud = models.FloatField(null=True, blank=True, help_text='Longitud geocodificada')
    direccion_formateada = models.CharField(
        max_length=300, blank=True,
        help_text='Dirección normalizada devuelta por Google Geocoding API'
    )
    geocodificado = models.BooleanField(default=False, help_text='True si la dirección fue validada por Google')
    
    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['-fecha_registro']
    
    def __str__(self):
        return f"{self.nombre} - {self.nif}"


class Turno(models.Model):
    """Turno de un técnico para un día con sus tareas."""
    
    class TipoTurno(models.TextChoices):
        MANANA = 'manana', 'Mañana (8:00-14:00)'
        TARDE = 'tarde', 'Tarde (14:00-20:00)'
        COMPLETO = 'completo', 'Jornada completa (8:00-20:00)'
    
    tecnico = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name='turnos',
        limit_choices_to={'rol': 'tecnico'}
    )
    fecha = models.DateField()
    tipo_turno = models.CharField(
        max_length=20,
        choices=TipoTurno.choices,
        default=TipoTurno.COMPLETO,
    )
    notas_coordinador = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'Turno'
        verbose_name_plural = 'Turnos'
        unique_together = ['tecnico', 'fecha']
        ordering = ['fecha']
    
    def __str__(self):
        return f"{self.tecnico.get_full_name()} - {self.fecha} ({self.get_tipo_turno_display()})"


class TareaTurno(models.Model):
    """Tarea asignada dentro de un turno."""
    
    class TipoServicio(models.TextChoices):
        LUZ = 'luz', 'Alonso LUZ'
        GAS = 'gas', 'Alonso GAS'
        OSMOSIS = 'osmosis', 'Alonso ÓSMOSIS'
        DESCAL = 'descal', 'Alonso DESCAL'
        OZONO = 'ozono', 'Alonso OZONO'
        CLIMA = 'clima', 'Alonso CLIMA'
        FOTOVOLTAICA = 'fotovoltaica', 'Alonso FOTOVOLTAICA'
        MANITAS = 'manitas', 'Alonso MANITAS'
    
    class Estado(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        EN_CURSO = 'en_curso', 'En curso'
        COMPLETADA = 'completada', 'Completada'
        INCIDENCIA = 'incidencia', 'Incidencia'
        CANCELADA = 'cancelada', 'Cancelada'
    
    class Confirmacion(models.TextChoices):
        SIN_AVISAR = 'sin_avisar', 'Sin avisar'
        AVISADO = 'avisado', 'Avisado'
        CONFIRMADO = 'confirmado', 'Confirmado'
        NO_CONTESTA = 'no_contesta', 'No contesta'
        NO_CONTESTA_DIA = 'no_contesta_dia', 'No contesta (día)'
        RECHAZADO = 'rechazado', 'Rechazado'
        PROMOVIDO = 'promovido', 'Promovido'
    
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name='tareas')
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='tareas')
    orden = models.IntegerField(default=0)
    tipo_servicio = models.CharField(max_length=20, choices=TipoServicio.choices, default=TipoServicio.GAS)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    hora_estimada = models.CharField(max_length=10, blank=True)
    hora_inicio = models.CharField(max_length=10, blank=True)
    hora_fin = models.CharField(max_length=10, blank=True)
    duracion_estimada = models.IntegerField(default=45)  # minutos
    descripcion = models.TextField(blank=True)
    incidencia = models.TextField(blank=True)
    prioridad = models.IntegerField(default=2, choices=[(1, 'Alta'), (2, 'Media'), (3, 'Baja')])
    
    # Confirmaciones
    confirmacion = models.CharField(max_length=20, choices=Confirmacion.choices, default=Confirmacion.SIN_AVISAR)
    intentos_contacto = models.IntegerField(default=0)
    hora_ultimo_intento = models.CharField(max_length=10, blank=True)
    notas_confirmacion = models.TextField(blank=True)
    
    # Reservas
    es_reserva = models.BooleanField(default=False)
    posicion_reserva = models.IntegerField(null=True, blank=True)
    promovido_desde_reserva = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = 'Tarea de turno'
        verbose_name_plural = 'Tareas de turno'
        ordering = ['orden']
    
    def __str__(self):
        return f"Tarea {self.id} - {self.cliente.nombre} ({self.get_estado_display()})"
