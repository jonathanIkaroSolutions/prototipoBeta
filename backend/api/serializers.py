from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import Usuario, Cliente, Turno, TareaTurno, Zona


class ZonaSerializer(serializers.ModelSerializer):
    tecnicos_count = serializers.SerializerMethodField()
    clientes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Zona
        fields = ['id', 'nombre', 'descripcion', 'codigos_postales', 'activa',
                  'tecnicos_count', 'clientes_count']
        read_only_fields = ['id']
    
    def get_tecnicos_count(self, obj):
        return obj.tecnicos.count()
    
    def get_clientes_count(self, obj):
        return obj.clientes.count()


class UsuarioSerializer(serializers.ModelSerializer):
    coordinador_id = serializers.PrimaryKeyRelatedField(
        source='coordinador', queryset=Usuario.objects.filter(rol='coordinador'),
        required=False, allow_null=True
    )
    zona_nombre = serializers.CharField(source='zona.nombre', read_only=True, default='')
    zona_id = serializers.PrimaryKeyRelatedField(
        source='zona', queryset=Zona.objects.all(),
        required=False, allow_null=True
    )

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'rol',
                  'telefono', 'especialidad', 'vehiculo', 'zona_id', 'zona_nombre',
                  'coordinador_id', 'max_tareas_dia', 'foto']
        read_only_fields = ['id']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()
    
    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if user and user.is_active:
            return user
        raise serializers.ValidationError("Credenciales incorrectas")


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'
        read_only_fields = ['id', 'fecha_registro']


class TareaTurnoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)

    class Meta:
        model = TareaTurno
        fields = '__all__'
        read_only_fields = ['id']


class TurnoSerializer(serializers.ModelSerializer):
    tareas = TareaTurnoSerializer(many=True, read_only=True)
    tecnico_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Turno
        fields = ['id', 'tecnico', 'fecha', 'tipo_turno', 'notas_coordinador', 'tareas', 'tecnico_nombre']
        read_only_fields = ['id']

    def get_tecnico_nombre(self, obj):
        return obj.tecnico.get_full_name()


class ImportRowSerializer(serializers.Serializer):
    """Serializer para cada fila del CSV de importación."""
    nombre_cliente = serializers.CharField()
    nif = serializers.CharField()
    telefono = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    direccion = serializers.CharField(required=False, allow_blank=True)
    ciudad = serializers.CharField(required=False, default='Zaragoza')
    codigo_postal = serializers.CharField(required=False, allow_blank=True)
    zona = serializers.CharField()
    tipo_equipo = serializers.CharField(required=False, default='caldera_gas')
    marca_equipo = serializers.CharField(required=False, allow_blank=True)
    tipo_servicio = serializers.CharField(required=False, default='gas')
    fecha_programada = serializers.CharField()
    hora_estimada = serializers.CharField(required=False, default='09:00')
    duracion_estimada = serializers.IntegerField(required=False, default=45)
    prioridad = serializers.IntegerField(required=False, default=2)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    es_reserva = serializers.BooleanField(required=False, default=False)
    notas = serializers.CharField(required=False, allow_blank=True, default='')
    notas = serializers.CharField(required=False, allow_blank=True)
