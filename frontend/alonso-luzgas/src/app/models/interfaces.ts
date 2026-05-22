export interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  rol: 'coordinador' | 'tecnico';
  telefono: string;
}

export interface Tecnico extends Usuario {
  coordinador_id: number;
  especialidad: 'calderas' | 'gas' | 'electricidad' | 'general';
  vehiculo: string;
  zona_id: number | null;
  zona_nombre: string;
  max_tareas_dia: number;
  foto?: string;
}

export interface Zona {
  id: number;
  nombre: string;
  descripcion: string;
  codigos_postales: string;
  activa: boolean;
  tecnicos_count: number;
  clientes_count: number;
}

export interface CargaZona {
  zona_id: number;
  zona: string;
  clientes_total: number;
  clientes_sin_asignar: number;
  tecnicos_asignados: { id: number; nombre: string }[];
}

export interface Cliente {
  id?: number;
  nombre: string;
  nif: string;
  correo_electronico: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  codigo_postal: string;
  notas: string;
  fecha_registro?: string;
  activo: boolean;
  zona_id?: number | null;
  tipo_equipo: 'caldera_gas' | 'caldera_gasoil' | 'termo_electrico' | 'aerotermia' | 'osmosis' | 'descalcificador' | 'ozono' | 'clima' | 'fotovoltaica' | 'otro';
  marca_equipo: string;
  ultima_revision?: string;
  // Coordenadas geocodificadas
  latitud?: number | null;
  longitud?: number | null;
  direccion_formateada?: string;
  geocodificado?: boolean;
}

export interface Turno {
  id?: number;
  tecnico_id: number;
  tecnico?: Tecnico;
  fecha: string;
  tipo_turno: 'manana' | 'tarde' | 'completo';
  tareas: TareaTurno[];
  notas_coordinador: string;
}

export type EstadoConfirmacion =
  | 'sin_avisar'        // Aún no se ha contactado
  | 'avisado'           // Se llamó, esperando respuesta
  | 'confirmado'        // Cliente confirma asistencia
  | 'no_contesta'       // No cogió el teléfono (día anterior)
  | 'no_contesta_dia'   // Reintento mismo día, sigue sin contestar → se salta
  | 'rechazado'         // Cliente cancela explícitamente
  | 'promovido';        // Era reserva y ha subido a titular

export interface TareaTurno {
  id?: number;
  turno_id?: number;
  cliente_id: number;
  cliente?: Cliente;
  orden: number;
  tipo_servicio: 'luz' | 'gas' | 'osmosis' | 'descal' | 'ozono' | 'clima' | 'fotovoltaica' | 'manitas';
  estado: 'pendiente' | 'en_curso' | 'completada' | 'incidencia' | 'cancelada';
  hora_estimada: string;
  hora_inicio?: string;
  hora_fin?: string;
  duracion_estimada: number; // minutos
  descripcion: string;
  incidencia?: string; // motivo si hay incidencia
  prioridad: 1 | 2 | 3;

  // Sistema de confirmaciones
  confirmacion: EstadoConfirmacion;
  intentos_contacto: number;       // Veces que se ha llamado
  hora_ultimo_intento?: string;    // Hora del último intento de contacto
  notas_confirmacion?: string;     // "No contesta", "Confirma para las 10", etc.

  // Sistema de reservas
  es_reserva: boolean;             // true = cliente de backup
  posicion_reserva?: number;       // Orden dentro de las reservas (1, 2, 3...)
  promovido_desde_reserva?: boolean; // true si subió de reserva a titular
}

export interface Itinerario {
  tecnico: Tecnico;
  fecha: string;
  turno: Turno | null;
  paradas: ParadaItinerario[];
  tareas_completadas: number;
  tareas_total: number;
  progreso: number; // porcentaje
  estado_actual: 'no_iniciado' | 'en_ruta' | 'en_servicio' | 'finalizado';
  hora_ultima_actualizacion?: string;
}

// Estado completo de cada parada del itinerario
export type EstadoParada =
  | 'pendiente_aviso'  // Aún no se ha avisado al cliente (día anterior)
  | 'avisado'          // Se ha llamado al cliente, esperando confirmación
  | 'confirmado'       // Cliente confirma la cita
  | 'no_confirmado'    // Cliente no contesta / rechaza
  | 'en_ruta'          // Técnico en camino hacia este cliente
  | 'en_servicio'      // Técnico trabajando en este cliente
  | 'realizado'        // Servicio completado con éxito
  | 'incidencia';      // Problema (no acceso, fallo, etc.)

export interface ParadaItinerario {
  id: number;
  orden: number;
  cliente_id: number;
  cliente?: Cliente;
  tarea_id: number;            // referencia a la TareaTurno
  tipo_servicio: TareaTurno['tipo_servicio'];
  descripcion: string;
  estado: EstadoParada;

  // Horarios planificados
  hora_estimada_llegada: string;  // e.g. "09:30"
  duracion_estimada: number;      // minutos de servicio
  tiempo_ruta_estimado: number;   // minutos en coche desde parada anterior

  // Horarios reales (se rellenan conforme avanza)
  hora_aviso?: string;           // Cuándo se avisó al cliente
  hora_confirmacion?: string;    // Cuándo confirmó
  hora_salida_anterior?: string; // Cuándo salió del cliente anterior
  hora_llegada?: string;         // Cuándo llegó realmente
  hora_inicio_servicio?: string; // Cuándo empezó el trabajo
  hora_fin_servicio?: string;    // Cuándo terminó

  // Notas e incidencias
  notas_aviso?: string;          // "Avisado a las 18:00 del día anterior"
  motivo_incidencia?: string;
  intentos_contacto: number;     // Número de intentos de llamada
}

// Resumen de confirmaciones para el panel del coordinador
export interface ResumenConfirmaciones {
  total_titulares: number;
  confirmados: number;
  no_contestan: number;
  sin_avisar: number;
  reservas_disponibles: number;
  porcentaje_confirmado: number;
}

export interface LoginResponse {
  token: string;
  user: Usuario;
}
