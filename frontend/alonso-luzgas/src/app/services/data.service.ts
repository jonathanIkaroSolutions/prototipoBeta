import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tecnico, Cliente, Turno, TareaTurno, Itinerario, ParadaItinerario, EstadoParada, EstadoConfirmacion, ResumenConfirmaciones, CargaZona } from '../models/interfaces';

/**
 * Servicio de datos que se conecta al backend real (SQLite via Django REST).
 * Usa signals para mantener la reactividad en la UI.
 * Después de cada operación de escritura, refresca los datos desde el backend.
 */
@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8000/api';

  // ═══════════ SIGNALS ═══════════
  private _tecnicos = signal<Tecnico[]>([]);
  private _clientes = signal<Cliente[]>([]);
  private _turnos = signal<Turno[]>([]);
  private _cargaZonas = signal<CargaZona[]>([]);
  private _loading = signal(false);

  readonly tecnicos = this._tecnicos.asReadonly();
  readonly clientes = this._clientes.asReadonly();
  readonly turnos = this._turnos.asReadonly();
  readonly cargaZonas = this._cargaZonas.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor() {
    this.cargarTodo();
  }

  // ═══════════ CARGA DESDE API ═══════════

  cargarTodo(): void {
    this._loading.set(true);
    this.cargarTecnicos();
    this.cargarClientes();
    this.cargarTurnos();
  }

  cargarTecnicos(): void {
    this.http.get<any[]>(`${this.API_URL}/usuarios/?rol=tecnico`).subscribe({
      next: (data) => {
        const tecnicos: Tecnico[] = data.map(u => ({
          id: u.id,
          username: u.username,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          rol: u.rol,
          telefono: u.telefono,
          coordinador_id: u.coordinador_id || 0,
          especialidad: u.especialidad || 'general',
          vehiculo: u.vehiculo || '',
          zona_id: u.zona_id || null,
          zona_nombre: u.zona_nombre || '',
          max_tareas_dia: u.max_tareas_dia || 12,
          foto: u.foto || '',
        }));
        this._tecnicos.set(tecnicos);
      },
      error: (err) => console.error('Error cargando técnicos:', err)
    });
  }

  cargarClientes(): void {
    this.http.get<any[]>(`${this.API_URL}/clientes/`).subscribe({
      next: (data) => {
        const clientes: Cliente[] = data.map(c => ({
          id: c.id,
          nombre: c.nombre,
          nif: c.nif,
          correo_electronico: c.correo_electronico,
          telefono: c.telefono,
          direccion: c.direccion,
          ciudad: c.ciudad,
          codigo_postal: c.codigo_postal,
          notas: c.notas,
          fecha_registro: c.fecha_registro,
          activo: c.activo,
          tipo_equipo: c.tipo_equipo,
          marca_equipo: c.marca_equipo,
          ultima_revision: c.ultima_revision,
          latitud: c.latitud ?? null,
          longitud: c.longitud ?? null,
          direccion_formateada: c.direccion_formateada || '',
          geocodificado: c.geocodificado || false,
          zona_id: c.zona ?? null,
        }));
        this._clientes.set(clientes);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando clientes:', err);
        this._loading.set(false);
      }
    });
  }

  cargarTurnos(): void {
    this.http.get<any[]>(`${this.API_URL}/turnos/`).subscribe({
      next: (data) => {
        const turnos: Turno[] = data.map(t => ({
          id: t.id,
          tecnico_id: t.tecnico,
          fecha: t.fecha,
          tipo_turno: t.tipo_turno,
          notas_coordinador: t.notas_coordinador || '',
          tareas: (t.tareas || []).map((ta: any) => this.mapTarea(ta)),
        }));
        this._turnos.set(turnos);
      },
      error: (err) => console.error('Error cargando turnos:', err)
    });
  }

  private mapTarea(ta: any): TareaTurno {
    return {
      id: ta.id,
      turno_id: ta.turno,
      cliente_id: ta.cliente,
      orden: ta.orden,
      tipo_servicio: ta.tipo_servicio,
      estado: ta.estado,
      hora_estimada: ta.hora_estimada || '',
      hora_inicio: ta.hora_inicio || undefined,
      hora_fin: ta.hora_fin || undefined,
      duracion_estimada: ta.duracion_estimada,
      descripcion: ta.descripcion,
      incidencia: ta.incidencia || undefined,
      prioridad: ta.prioridad,
      confirmacion: ta.confirmacion || 'sin_avisar',
      intentos_contacto: ta.intentos_contacto || 0,
      hora_ultimo_intento: ta.hora_ultimo_intento || undefined,
      notas_confirmacion: ta.notas_confirmacion || undefined,
      es_reserva: ta.es_reserva,
      posicion_reserva: ta.posicion_reserva || undefined,
      promovido_desde_reserva: ta.promovido_desde_reserva || false,
    };
  }

  // ═══════════ ITINERARIOS (computed) ═══════════

  readonly itinerarios = computed<Itinerario[]>(() => {
    return this._tecnicos().map(tecnico => {
      const turno = this._turnos().find(t => t.tecnico_id === tecnico.id && t.fecha === this.getToday()) || null;
      const tareas = turno?.tareas || [];
      const total = tareas.filter(t => !t.es_reserva).length;

      const paradas: ParadaItinerario[] = tareas.map((tarea, idx) => {
        const cliente = this._clientes().find(c => c.id === tarea.cliente_id);

        let estado: EstadoParada = 'pendiente_aviso';
        if (tarea.estado === 'completada') estado = 'realizado';
        else if (tarea.estado === 'en_curso') estado = 'en_servicio';
        else if (tarea.estado === 'incidencia') estado = 'incidencia';
        else if (tarea.confirmacion === 'confirmado') estado = 'confirmado';
        else if (tarea.confirmacion === 'avisado') estado = 'avisado';
        else if (tarea.confirmacion === 'no_contesta' || tarea.confirmacion === 'no_contesta_dia') estado = 'no_confirmado';

        const tiempoRuta = idx === 0 ? 15 : (10 + (idx * 3));

        return {
          id: tarea.id!,
          orden: tarea.orden,
          cliente_id: tarea.cliente_id,
          cliente,
          tarea_id: tarea.id!,
          tipo_servicio: tarea.tipo_servicio,
          descripcion: tarea.descripcion,
          estado,
          hora_estimada_llegada: tarea.hora_estimada,
          duracion_estimada: tarea.duracion_estimada,
          tiempo_ruta_estimado: tiempoRuta,
          hora_aviso: tarea.hora_ultimo_intento,
          hora_confirmacion: tarea.confirmacion === 'confirmado' ? tarea.hora_ultimo_intento : undefined,
          hora_salida_anterior: tarea.hora_inicio ? this.subtractMinutes(tarea.hora_inicio, tiempoRuta) : undefined,
          hora_llegada: tarea.hora_inicio ? this.subtractMinutes(tarea.hora_inicio, 2) : undefined,
          hora_inicio_servicio: tarea.hora_inicio,
          hora_fin_servicio: tarea.hora_fin,
          notas_aviso: tarea.notas_confirmacion,
          motivo_incidencia: tarea.incidencia,
          intentos_contacto: tarea.intentos_contacto,
        };
      });

      const completadas = paradas.filter(p => p.estado === 'realizado').length;

      let estado_actual: Itinerario['estado_actual'] = 'no_iniciado';
      if (paradas.some(p => p.estado === 'en_servicio')) estado_actual = 'en_servicio';
      else if (paradas.some(p => p.estado === 'en_ruta')) estado_actual = 'en_ruta';
      else if (completadas > 0 && completadas < total) estado_actual = 'en_ruta';
      else if (completadas === total && total > 0) estado_actual = 'finalizado';

      return {
        tecnico,
        fecha: this.getToday(),
        turno,
        paradas,
        tareas_completadas: completadas,
        tareas_total: total,
        progreso: total > 0 ? Math.round((completadas / total) * 100) : 0,
        estado_actual,
        hora_ultima_actualizacion: paradas.find(p => p.estado === 'en_servicio')?.hora_inicio_servicio || paradas.filter(p => p.hora_fin_servicio).pop()?.hora_fin_servicio
      };
    });
  });

  readonly stats = computed(() => {
    const turnos = this._turnos();
    const todasTareas = turnos.flatMap(t => t.tareas);
    return {
      total_clientes: this._clientes().length,
      total_tecnicos: this._tecnicos().length,
      tareas_hoy: todasTareas.length,
      completadas_hoy: todasTareas.filter(t => t.estado === 'completada').length,
      en_curso: todasTareas.filter(t => t.estado === 'en_curso').length,
      pendientes: todasTareas.filter(t => t.estado === 'pendiente').length,
      incidencias: todasTareas.filter(t => t.estado === 'incidencia').length,
    };
  });

  // ═══════════ ACCIONES (CRUD con backend + refresh local) ═══════════

  /** Obtener carga de trabajo por zona (para el coordinador) */
  getCargaZonas(): void {
    this.http.get<CargaZona[]>(`${this.API_URL}/carga-zonas/`).subscribe({
      next: (data) => this._cargaZonas.set(data),
      error: (err) => console.error('Error cargando zonas:', err)
    });
  }

  /** Asignar un técnico a una zona */
  asignarTecnicoZona(tecnicoId: number, zonaId: number | null): void {
    this.http.patch(`${this.API_URL}/usuarios/${tecnicoId}/`, { zona_id: zonaId }).subscribe({
      next: () => {
        this.cargarTecnicos();
        this.getCargaZonas();
      },
      error: (err) => console.error('Error asignando zona:', err)
    });
  }

  addCliente(cliente: Cliente): void {
    this.http.post(`${this.API_URL}/clientes/`, {
      nombre: cliente.nombre,
      nif: cliente.nif,
      correo_electronico: cliente.correo_electronico,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      ciudad: cliente.ciudad,
      codigo_postal: cliente.codigo_postal,
      notas: cliente.notas,
      activo: cliente.activo,
      tipo_equipo: cliente.tipo_equipo,
      marca_equipo: cliente.marca_equipo,
    }).subscribe({
      next: () => this.cargarClientes(),
      error: (err) => console.error('Error creando cliente:', err)
    });
  }

  updateCliente(id: number, data: Partial<Cliente>): void {
    this.http.patch(`${this.API_URL}/clientes/${id}/`, data).subscribe({
      next: () => this.cargarClientes(),
      error: (err) => console.error('Error actualizando cliente:', err)
    });
  }

  deleteCliente(id: number): void {
    this.http.delete(`${this.API_URL}/clientes/${id}/`).subscribe({
      next: () => this.cargarClientes(),
      error: (err) => console.error('Error eliminando cliente:', err)
    });
  }

  crearTurno(turno: Omit<Turno, 'id'>): void {
    this.http.post(`${this.API_URL}/turnos/`, {
      tecnico: turno.tecnico_id,
      fecha: turno.fecha,
      tipo_turno: turno.tipo_turno,
      notas_coordinador: turno.notas_coordinador,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error creando turno:', err)
    });
  }

  addTareaToTurno(turnoId: number, tarea: TareaTurno): void {
    this.http.post(`${this.API_URL}/tareas/`, {
      turno: turnoId,
      cliente: tarea.cliente_id,
      orden: tarea.orden,
      tipo_servicio: tarea.tipo_servicio,
      estado: tarea.estado || 'pendiente',
      hora_estimada: tarea.hora_estimada,
      duracion_estimada: tarea.duracion_estimada,
      descripcion: tarea.descripcion,
      prioridad: tarea.prioridad,
      confirmacion: tarea.confirmacion || 'sin_avisar',
      es_reserva: tarea.es_reserva || false,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error añadiendo tarea:', err)
    });
  }

  removeTareaFromTurno(turnoId: number, tareaId: number): void {
    this.http.delete(`${this.API_URL}/tareas/${tareaId}/`).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error eliminando tarea:', err)
    });
  }

  updateTareaEstado(turnoId: number, tareaId: number, estado: TareaTurno['estado'], incidencia?: string): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const data: any = { estado };
    if (estado === 'en_curso') data.hora_inicio = ahora;
    if (estado === 'completada') data.hora_fin = ahora;
    if (estado === 'incidencia') data.incidencia = incidencia || 'Sin especificar';

    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, data).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error actualizando tarea:', err)
    });
  }

  reorderTareas(turnoId: number, tareaIds: number[]): void {
    // Actualizar orden de cada tarea
    tareaIds.forEach((id, i) => {
      this.http.patch(`${this.API_URL}/tareas/${id}/`, { orden: i + 1 }).subscribe();
    });
    // Refresh después de un breve delay para que todo se grabe
    setTimeout(() => this.cargarTurnos(), 500);
  }

  moverTarea(fromTurnoId: number, toTurnoId: number, tareaId: number): void {
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, { turno: toTurnoId }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error moviendo tarea:', err)
    });
  }

  getClientesSinAsignar(): Cliente[] {
    const asignados = new Set(
      this._turnos().flatMap(t => t.tareas.map(ta => ta.cliente_id))
    );
    return this._clientes().filter(c => c.activo && !asignados.has(c.id!));
  }

  // ═══════════ SISTEMA DE CONFIRMACIONES ═══════════

  getResumenConfirmaciones(turnoId: number): ResumenConfirmaciones {
    const turno = this._turnos().find(t => t.id === turnoId);
    if (!turno) return { total_titulares: 0, confirmados: 0, no_contestan: 0, sin_avisar: 0, reservas_disponibles: 0, porcentaje_confirmado: 0 };
    const titulares = turno.tareas.filter(t => !t.es_reserva);
    const reservas = turno.tareas.filter(t => t.es_reserva);
    const confirmados = titulares.filter(t => t.confirmacion === 'confirmado').length;
    const no_contestan = titulares.filter(t => t.confirmacion === 'no_contesta' || t.confirmacion === 'no_contesta_dia').length;
    const sin_avisar = titulares.filter(t => t.confirmacion === 'sin_avisar').length;
    return {
      total_titulares: titulares.length,
      confirmados,
      no_contestan,
      sin_avisar,
      reservas_disponibles: reservas.filter(t => t.confirmacion === 'confirmado' || t.confirmacion === 'avisado').length,
      porcentaje_confirmado: titulares.length > 0 ? Math.round((confirmados / titulares.length) * 100) : 0
    };
  }

  registrarIntento(turnoId: number, tareaId: number, resultado: EstadoConfirmacion, nota?: string): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      confirmacion: resultado,
      intentos_contacto: 1, // Se incrementará en el backend idealmente
      hora_ultimo_intento: ahora,
      notas_confirmacion: nota || '',
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error registrando intento:', err)
    });
  }

  promoverReserva(turnoId: number, tareaNoConfirmadaId: number): void {
    // Buscar la reserva disponible localmente y actualizar en el backend
    const turno = this._turnos().find(t => t.id === turnoId);
    if (!turno) return;

    const tareaFallida = turno.tareas.find(ta => ta.id === tareaNoConfirmadaId);
    if (!tareaFallida) return;

    const reservaDisponible = turno.tareas
      .filter(ta => ta.es_reserva && (ta.confirmacion === 'confirmado' || ta.confirmacion === 'avisado'))
      .sort((a, b) => (a.posicion_reserva || 99) - (b.posicion_reserva || 99))[0];

    if (!reservaDisponible) return;

    // Cancelar la tarea fallida
    this.http.patch(`${this.API_URL}/tareas/${tareaNoConfirmadaId}/`, {
      estado: 'cancelada',
      confirmacion: 'no_contesta_dia'
    }).subscribe();

    // Promover la reserva
    this.http.patch(`${this.API_URL}/tareas/${reservaDisponible.id}/`, {
      es_reserva: false,
      posicion_reserva: null,
      promovido_desde_reserva: true,
      confirmacion: 'promovido',
      orden: tareaFallida.orden,
      hora_estimada: tareaFallida.hora_estimada,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error promoviendo reserva:', err)
    });
  }

  addReserva(turnoId: number, tarea: TareaTurno): void {
    const turno = this._turnos().find(t => t.id === turnoId);
    const reservasActuales = turno ? turno.tareas.filter(ta => ta.es_reserva).length : 0;

    this.http.post(`${this.API_URL}/tareas/`, {
      turno: turnoId,
      cliente: tarea.cliente_id,
      orden: 99,
      tipo_servicio: tarea.tipo_servicio,
      estado: 'pendiente',
      hora_estimada: '',
      duracion_estimada: tarea.duracion_estimada,
      descripcion: tarea.descripcion,
      prioridad: tarea.prioridad,
      confirmacion: 'sin_avisar',
      es_reserva: true,
      posicion_reserva: reservasActuales + 1,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error añadiendo reserva:', err)
    });
  }

  removeReserva(turnoId: number, tareaId: number): void {
    this.http.delete(`${this.API_URL}/tareas/${tareaId}/`).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error eliminando reserva:', err)
    });
  }

  // ═══════════ ITINERARIO STATE MANAGEMENT ═══════════

  avisarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      confirmacion: 'avisado',
      intentos_contacto: 1,
      hora_ultimo_intento: ahora,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error avisando parada:', err)
    });
  }

  confirmarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      confirmacion: 'confirmado',
      hora_ultimo_intento: ahora,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error confirmando parada:', err)
    });
  }

  iniciarRutaParada(turnoId: number, tareaId: number): void {
    // El estado de "en ruta" se maneja a nivel de itinerario, no de tarea directa
    this.cargarTurnos();
  }

  iniciarServicioParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      estado: 'en_curso',
      hora_inicio: ahora,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error iniciando servicio:', err)
    });
  }

  completarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      estado: 'completada',
      hora_fin: ahora,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error completando parada:', err)
    });
  }

  incidenciaParada(turnoId: number, tareaId: number, motivo: string): void {
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, {
      estado: 'incidencia',
      incidencia: motivo,
    }).subscribe({
      next: () => this.cargarTurnos(),
      error: (err) => console.error('Error reportando incidencia:', err)
    });
  }

  // ═══════════ EXTRAS (compatibilidad con la interfaz anterior) ═══════════

  updateParadaData(turnoId: number, tareaId: number, data: any): void {
    // Se maneja directamente vía PATCH
    this.http.patch(`${this.API_URL}/tareas/${tareaId}/`, data).subscribe({
      next: () => this.cargarTurnos(),
    });
  }

  getParadaExtra(turnoId: number, tareaId: number): any {
    return {};
  }

  // ═══════════ HELPERS ═══════════

  private subtractMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m - mins;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}
