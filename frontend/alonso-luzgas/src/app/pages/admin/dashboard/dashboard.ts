import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { DataService } from '../../../services/data.service';
import { ImportService, ResultadoImportacion, ResultadoGeneracion } from '../../../services/import.service';
import { ApiService } from '../../../services/api';
import { Cliente, CargaZona, Tecnico, TareaTurno, Turno, EstadoConfirmacion } from '../../../models/interfaces';

export interface DiaTecnico {
  fecha: string;
  diaNombre: string;
  diaNum: number;
  esHoy: boolean;
  tareas: { tarea: TareaTurno; cliente?: Cliente }[];
}

/** Una cita (tarea titular) con el contexto necesario para la vista de Citas */
export interface CitaZonaRow {
  tarea: TareaTurno;
  cliente?: Cliente;
  fecha: string;
  tecnicoId: number;
  turnoId: number;
}

/** Citas de un técnico agrupadas para la vista de Citas */
export interface CitasPorTecnico {
  tecnico: Tecnico;
  citas: CitaZonaRow[];
  confirmadas: number;
  pendientes: number;
  incidencias: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TitleCasePipe],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})
export class Dashboard implements OnInit {
  private dataService = inject(DataService);
  private importService = inject(ImportService);
  private apiService = inject(ApiService);
  authService = inject(AuthService);

  stats = this.dataService.stats;
  itinerarios = this.dataService.itinerarios;
  cargaZonas = this.dataService.cargaZonas;

  tecnicoExpandido = signal<number | null>(null);
  zonaSeleccionada = signal<number | null>(null);

  // ══════ IMPORTACIÓN DE CLIENTES ══════
  dragOver = signal(false);
  mostrarImport = signal(false);
  importando = signal(false);
  importStatus = signal<{ message: string; type: 'success' | 'error' | 'info' | 'warn' } | null>(null);
  resultadoImport = signal<ResultadoImportacion | null>(null);
  resultadoTurnos = signal<ResultadoGeneracion | null>(null);
  zonaDropdownOpen = signal(false);
  vistaActiva = signal<'dashboard' | 'clientes' | 'citas' | 'tecnicos' | 'itinerario'>('dashboard');

  /** Nombre de la zona activa para mostrar en el título */
  zonaNombre = computed(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return '';
    const z = this.cargaZonas().find(x => x.zona_id === zid);
    return z ? z.zona : '';
  });

  /** Info completa de la zona seleccionada */
  zonaInfo = computed(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return null;
    return this.cargaZonas().find(x => x.zona_id === zid) || null;
  });

  /** Itinerarios filtrados por zona seleccionada */
  itinerariosZona = computed(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];
    return this.itinerarios().filter(it => it.tecnico.zona_id === zid);
  });

  /** Búsqueda en la vista de clientes */
  busquedaCliente = signal('');

  /** Búsqueda en la vista de técnicos */
  busquedaTecnico = signal('');

  /** Técnico seleccionado en la vista Técnicos */
  tecnicoSeleccionado = signal<number | null>(null);

  /** Itinerario del técnico seleccionado (solo hoy, para progreso) */
  itinerarioTecnicoSeleccionado = computed(() => {
    const tid = this.tecnicoSeleccionado();
    if (!tid) return null;
    return this.itinerariosZona().find(it => it.tecnico.id === tid) || null;
  });

  /** Semana completa del técnico seleccionado, agrupada por día */
  semanaTecnicoSeleccionado = computed<DiaTecnico[]>(() => {
    const tid = this.tecnicoSeleccionado();
    if (!tid) return [];

    const turnos = this.dataService.turnos().filter(t => t.tecnico_id === tid);
    const clientes = this.dataService.clientes();
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Calcular lunes de esta semana
    const lunes = new Date(hoy);
    const dayOfWeek = hoy.getDay() || 7;
    lunes.setDate(hoy.getDate() - dayOfWeek + 1);

    const nombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dias: DiaTecnico[] = [];

    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes);
      dia.setDate(lunes.getDate() + i);
      const fechaStr = dia.toISOString().split('T')[0];

      const turnosDia = turnos.filter(t => t.fecha === fechaStr);
      const tareasDia: { tarea: TareaTurno; cliente?: Cliente }[] = [];
      turnosDia.forEach(turno => {
        turno.tareas
          .filter(ta => !ta.es_reserva)
          .sort((a, b) => a.orden - b.orden)
          .forEach(tarea => {
            tareasDia.push({
              tarea,
              cliente: clientes.find(c => c.id === tarea.cliente_id),
            });
          });
      });

      // Incluir TODOS los días de la semana, también los que no tienen citas
      dias.push({
        fecha: fechaStr,
        diaNombre: nombres[i],
        diaNum: dia.getDate(),
        esHoy: fechaStr === hoyStr,
        tareas: tareasDia,
      });
    }
    return dias;
  });

  /** Técnico info del seleccionado */
  tecnicoSeleccionadoInfo = computed<Tecnico | null>(() => {
    const tid = this.tecnicoSeleccionado();
    if (!tid) return null;
    return this.dataService.tecnicos().find(t => t.id === tid) || null;
  });

  /** URL de Google Maps con itinerario del día de hoy para el técnico seleccionado */
  googleMapsUrl = computed<string>(() => {
    const it = this.itinerarioTecnicoSeleccionado();
    if (!it || it.paradas.length === 0) return '';

    const waypoints = it.paradas
      .filter(p => p.cliente?.direccion)
      .map(p => encodeURIComponent(`${p.cliente!.direccion}, ${p.cliente!.ciudad || ''}`));

    if (waypoints.length === 0) return '';

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const waypointsStr = waypoints.length > 2
      ? '&waypoints=' + waypoints.slice(1, -1).join('|')
      : '';

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsStr}&travelmode=driving`;
  });

  toggleTecnicoSeleccionado(id: number): void {
    this.tecnicoSeleccionado.update(v => v === id ? null : id);
  }

  /** Turnos del técnico seleccionado, ordenados por fecha */
  turnosTecnicoSeleccionado = computed<Turno[]>(() => {
    const tid = this.tecnicoSeleccionado();
    if (!tid) return [];
    return this.dataService.turnos()
      .filter(t => t.tecnico_id === tid)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  // ══════ Helpers estilo "turnos" para la vista de detalle ══════
  getTareasTitulares(turno: Turno): TareaTurno[] {
    return turno.tareas.filter(t => !t.es_reserva).sort((a, b) => a.orden - b.orden);
  }

  getReservasTurno(turno: Turno): TareaTurno[] {
    return turno.tareas.filter(t => t.es_reserva).sort((a, b) => (a.posicion_reserva || 0) - (b.posicion_reserva || 0));
  }

  formatFechaConDia(fechaStr: string): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    return `${dias[fecha.getDay()]} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
  }

  getCliente(clienteId: number): Cliente | undefined {
    return this.dataService.clientes().find(c => c.id === clienteId);
  }
  getClienteName(clienteId: number): string { return this.getCliente(clienteId)?.nombre || 'Desconocido'; }
  getClienteDireccion(clienteId: number): string { return this.getCliente(clienteId)?.direccion || ''; }
  getClienteTelefono(clienteId: number): string { return this.getCliente(clienteId)?.telefono || ''; }
  getClienteCiudad(clienteId: number): string { return this.getCliente(clienteId)?.ciudad || ''; }
  getClienteEquipo(clienteId: number): string {
    const c = this.getCliente(clienteId);
    if (!c) return '';
    const labels: Record<string, string> = {
      caldera_gas: 'Caldera Gas', caldera_gasoil: 'Caldera Gasoil', termo_electrico: 'Termo Eléctrico',
      aerotermia: 'Aerotermia', osmosis: 'Ósmosis', descalcificador: 'Descalcificador', ozono: 'Ozono',
      clima: 'Clima', fotovoltaica: 'Fotovoltaica', otro: 'Otro'
    };
    const tipo = labels[c.tipo_equipo] || c.tipo_equipo;
    return c.marca_equipo ? `${tipo} - ${c.marca_equipo}` : tipo;
  }

  getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = { luz: 'Alonso LUZ', gas: 'Alonso GAS', osmosis: 'Alonso ÓSMOSIS', descal: 'Alonso DESCAL', ozono: 'Alonso OZONO', clima: 'Alonso CLIMA', fotovoltaica: 'Alonso FOTOVOLTAICA', manitas: 'Alonso MANITAS' };
    return labels[tipo] || tipo;
  }

  getConfirmacionLabel(estado: EstadoConfirmacion): string {
    const labels: Record<EstadoConfirmacion, string> = {
      sin_avisar: 'Sin avisar', avisado: 'Avisado', confirmado: 'Confirmado',
      no_contesta: 'No contesta', no_contesta_dia: 'No contesta (día)', rechazado: 'Rechazado', promovido: 'Promovido'
    };
    return labels[estado] || estado;
  }

  getConfirmacionClass(estado: EstadoConfirmacion): string {
    const map: Record<EstadoConfirmacion, string> = {
      sin_avisar: 'default', avisado: 'warning', confirmado: 'success',
      no_contesta: 'danger', no_contesta_dia: 'danger', rechazado: 'danger', promovido: 'info'
    };
    return map[estado] || 'default';
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = { pendiente: 'default', en_curso: 'info', completada: 'success', incidencia: 'danger', cancelada: 'warning' };
    return map[estado] || 'default';
  }

  changeEstado(turnoId: number, tareaId: number, estado: TareaTurno['estado']): void {
    if (estado === 'incidencia') {
      const motivo = prompt('Motivo de la incidencia:');
      if (!motivo) return;
      this.dataService.updateTareaEstado(turnoId, tareaId, estado, motivo);
    } else {
      this.dataService.updateTareaEstado(turnoId, tareaId, estado);
    }
  }

  removeTarea(turnoId: number, tareaId: number): void {
    if (confirm('¿Quitar esta tarea del turno?')) {
      this.dataService.removeTareaFromTurno(turnoId, tareaId);
    }
  }

  openRouteMapTurno(turnoId: number): void {
    const turno = this.dataService.turnos().find(t => t.id === turnoId);
    if (!turno || turno.tareas.length === 0) return;
    const addresses = turno.tareas
      .filter(t => !t.es_reserva)
      .sort((a, b) => a.orden - b.orden)
      .map(t => {
        const c = this.dataService.clientes().find(cl => cl.id === t.cliente_id);
        if (!c) return '';
        if (c.latitud && c.longitud) return `${c.latitud},${c.longitud}`;
        const dir = c.direccion_formateada || c.direccion || '';
        return encodeURIComponent(`${dir}, ${c.codigo_postal || ''} ${c.ciudad || ''}, España`);
      }).filter(a => a);
    if (addresses.length === 0) return;
    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    let url: string;
    if (addresses.length <= 2) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    } else {
      const waypoints = addresses.slice(1, -1).join('%7C');
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    }
    window.open(url, '_blank');
  }

  /** Técnicos de la zona seleccionada con filtro */
  tecnicosZona = computed(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];
    const q = this.busquedaTecnico().toLowerCase().trim();
    const todos = this.dataService.tecnicos().filter(t => t.zona_id === zid);
    if (!q) return todos;
    return todos.filter(t =>
      `${t.first_name} ${t.last_name}`.toLowerCase().includes(q) ||
      t.vehiculo.toLowerCase().includes(q) ||
      t.especialidad.toLowerCase().includes(q)
    );
  });

  /** Clientes de la zona seleccionada, con filtro de búsqueda */
  clientesZona = computed(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];
    const q = this.busquedaCliente().toLowerCase().trim();
    const todos = this.dataService.clientes().filter(c => c.zona_id === zid);
    if (!q) return todos;
    return todos.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.direccion.toLowerCase().includes(q) ||
      c.telefono.includes(q) ||
      c.nif.toLowerCase().includes(q)
    );
  });

  // ══════ VISTA CITAS (gestión de citas de la zona) ══════
  citasBusqueda = signal('');
  citasFiltroTecnico = signal<number | null>(null);
  citasFiltroFecha = signal('');
  citasFiltroConfirmacion = signal('');

  readonly CONFIRMACIONES_OPC: { value: EstadoConfirmacion; label: string }[] = [
    { value: 'sin_avisar', label: 'Sin avisar' },
    { value: 'avisado', label: 'Avisado' },
    { value: 'confirmado', label: 'Confirmado' },
    { value: 'no_contesta', label: 'No contesta' },
    { value: 'no_contesta_dia', label: 'No contesta (día)' },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'promovido', label: 'Promovido' },
  ];

  /** Todas las citas (titulares) de la zona, aplicando filtros, ordenadas por fecha+hora */
  citasZonaRows = computed<CitaZonaRow[]>(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];

    const tecnicosZonaIds = new Set(
      this.dataService.tecnicos().filter(t => t.zona_id === zid).map(t => t.id)
    );
    const clientes = this.dataService.clientes();
    const fTec = this.citasFiltroTecnico();
    const fFecha = this.citasFiltroFecha();
    const fConf = this.citasFiltroConfirmacion();
    const q = this.citasBusqueda().toLowerCase().trim();

    const rows: CitaZonaRow[] = [];
    for (const turno of this.dataService.turnos()) {
      if (!tecnicosZonaIds.has(turno.tecnico_id)) continue;
      if (fTec && turno.tecnico_id !== fTec) continue;
      if (fFecha && turno.fecha !== fFecha) continue;

      for (const tarea of turno.tareas) {
        if (tarea.es_reserva) continue;
        if (fConf && tarea.confirmacion !== fConf) continue;

        const cliente = clientes.find(c => c.id === tarea.cliente_id);
        if (q) {
          const coincide =
            cliente?.nombre.toLowerCase().includes(q) ||
            cliente?.telefono.includes(q) ||
            cliente?.direccion.toLowerCase().includes(q) ||
            cliente?.nif.toLowerCase().includes(q);
          if (!coincide) continue;
        }

        rows.push({ tarea, cliente, fecha: turno.fecha, tecnicoId: turno.tecnico_id, turnoId: turno.id! });
      }
    }

    return rows.sort((a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (a.tarea.hora_estimada || '').localeCompare(b.tarea.hora_estimada || '')
    );
  });

  /** Citas de la zona agrupadas por técnico (solo técnicos con citas tras los filtros) */
  citasZonaPorTecnico = computed<CitasPorTecnico[]>(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];
    const rows = this.citasZonaRows();
    const tecnicos = this.dataService.tecnicos().filter(t => t.zona_id === zid);

    return tecnicos
      .map(tecnico => {
        const citas = rows.filter(r => r.tecnicoId === tecnico.id);
        return {
          tecnico,
          citas,
          confirmadas: citas.filter(r => r.tarea.confirmacion === 'confirmado').length,
          pendientes: citas.filter(r => r.tarea.confirmacion === 'sin_avisar' || r.tarea.confirmacion === 'avisado').length,
          incidencias: citas.filter(r => r.tarea.estado === 'incidencia' || r.tarea.confirmacion === 'rechazado').length,
        };
      })
      .filter(g => g.citas.length > 0)
      .sort((a, b) => `${a.tecnico.first_name} ${a.tecnico.last_name}`.localeCompare(`${b.tecnico.first_name} ${b.tecnico.last_name}`));
  });

  /** Resumen numérico de las citas de la zona (con filtros aplicados) */
  citasZonaStats = computed(() => {
    const rows = this.citasZonaRows();
    return {
      total: rows.length,
      confirmadas: rows.filter(r => r.tarea.confirmacion === 'confirmado').length,
      pendientes: rows.filter(r => r.tarea.confirmacion === 'sin_avisar' || r.tarea.confirmacion === 'avisado').length,
      incidencias: rows.filter(r => r.tarea.estado === 'incidencia' || r.tarea.confirmacion === 'rechazado').length,
    };
  });

  /** Fechas con citas en la zona (para el desplegable de filtro), ignorando el filtro de fecha */
  citasZonaFechasDisponibles = computed<string[]>(() => {
    const zid = this.zonaSeleccionada();
    if (!zid) return [];
    const tecnicosZonaIds = new Set(
      this.dataService.tecnicos().filter(t => t.zona_id === zid).map(t => t.id)
    );
    const fechas = new Set<string>();
    for (const turno of this.dataService.turnos()) {
      if (tecnicosZonaIds.has(turno.tecnico_id) && turno.tareas.some(ta => !ta.es_reserva)) {
        fechas.add(turno.fecha);
      }
    }
    return Array.from(fechas).sort();
  });

  limpiarFiltrosCitas(): void {
    this.citasBusqueda.set('');
    this.citasFiltroTecnico.set(null);
    this.citasFiltroFecha.set('');
    this.citasFiltroConfirmacion.set('');
  }

  getIniciales(nombre: string, apellido: string): string {
    return `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase();
  }

  ngOnInit(): void {
    this.dataService.cargarTodo();
    this.dataService.getCargaZonas();
  }

  seleccionarZona(zonaId: number): void {
    this.zonaSeleccionada.set(zonaId);
    this.vistaActiva.set('dashboard');
    this.semanaOffset.set(0);
    this.tecnicoExpandido.set(null);
    this.zonaDropdownOpen.set(false);
  }

  cambiarZona(zonaId: number): void {
    this.zonaSeleccionada.set(zonaId);
    this.vistaActiva.set('dashboard');
    this.semanaOffset.set(0);
    this.tecnicoExpandido.set(null);
    this.zonaDropdownOpen.set(false);
  }

  volverAlPanel(): void {
    this.zonaSeleccionada.set(null);
    this.vistaActiva.set('dashboard');
  }

  toggleTecnico(id: number): void {
    this.tecnicoExpandido.update(v => v === id ? null : id);
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      realizado: 'Completada',
      en_servicio: 'En curso',
      incidencia: 'Incidencia',
      confirmado: 'Confirmado',
      avisado: 'Avisado',
      no_confirmado: 'No contesta',
      pendiente_aviso: 'Pendiente',
    };
    return map[estado] || estado;
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      realizado: 'badge--success',
      en_servicio: 'badge--info',
      incidencia: 'badge--danger',
      confirmado: 'badge--primary',
      avisado: 'badge--warning',
      no_confirmado: 'badge--muted',
      pendiente_aviso: 'badge--default',
    };
    return 'badge ' + (map[estado] || 'badge--default');
  }

  // ══════ CALENDARIO SEMANAL (citas programadas) ══════
  semanaOffset = signal(0);

  diasSemana = computed(() => {
    const hoy = new Date();
    const offset = this.semanaOffset();
    const lunes = new Date(hoy);
    const dayOfWeek = hoy.getDay() || 7;
    lunes.setDate(hoy.getDate() - dayOfWeek + 1 + (offset * 7));

    const nombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const allClientes = this.dataService.clientes();
    const turnos = this.dataService.turnos();
    const zonaId = this.zonaSeleccionada();

    // Filtrar turnos por zona (tecnico de la zona seleccionada)
    const tecnicosZona = zonaId
      ? new Set(this.dataService.tecnicos().filter(t => t.zona_id === zonaId).map(t => t.id))
      : null;
    const turnosFiltrados = tecnicosZona
      ? turnos.filter(t => tecnicosZona.has(t.tecnico_id))
      : turnos;

    const dias: { fecha: string; diaNum: number; diaNombre: string; esHoy: boolean; clientes: Cliente[] }[] = [];

    for (let i = 0; i < 7; i++) {
      const dia = new Date(lunes);
      dia.setDate(lunes.getDate() + i);
      const fechaStr = dia.toISOString().split('T')[0];
      const esHoy = fechaStr === hoy.toISOString().split('T')[0];

      // Clientes con tarea programada este día
      const turnosDia = turnosFiltrados.filter(t => t.fecha === fechaStr);
      const clienteIds = new Set<number>();
      turnosDia.forEach(t => t.tareas.filter(ta => !ta.es_reserva).forEach(ta => clienteIds.add(ta.cliente_id)));
      const clientesDia = allClientes.filter(c => c.id !== undefined && clienteIds.has(c.id!));

      dias.push({
        fecha: fechaStr,
        diaNum: dia.getDate(),
        diaNombre: nombres[i],
        esHoy,
        clientes: clientesDia
      });
    }
    return dias;
  });

  semanaLabel = computed(() => {
    const dias = this.diasSemana();
    if (dias.length < 7) return '';
    const inicio = new Date(dias[0].fecha);
    const fin = new Date(dias[6].fecha);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${inicio.toLocaleDateString('es-ES', opts)} – ${fin.toLocaleDateString('es-ES', { ...opts, year: 'numeric' })}`;
  });

  citasSemana = computed(() => this.diasSemana().reduce((s, d) => s + d.clientes.length, 0));

  semanaAnterior(): void { this.semanaOffset.update(v => v - 1); }
  semanaSiguiente(): void { this.semanaOffset.update(v => v + 1); }
  semanaActual(): void { this.semanaOffset.set(0); }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      caldera_gas: 'tipo--gas',
      caldera_gasoil: 'tipo--gasoil',
      termo_electrico: 'tipo--electrico',
      aerotermia: 'tipo--aerotermia',
    };
    return 'week-client__dot ' + (map[tipo] || '');
  }

  logout(): void {
    this.authService.logout();
  }

  // ══════ IMPORTACIÓN ══════
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    this._processFile(files[0]);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this._processFile(input.files[0]);
    input.value = '';
  }

  private _processFile(file: File): void {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      this.importStatus.set({ message: `Formato no soportado (${ext}). Usa .csv`, type: 'error' });
      return;
    }
    this.importando.set(true);
    this.importStatus.set({ message: `Procesando "${file.name}"...`, type: 'info' });
    this.resultadoImport.set(null);
    this.resultadoTurnos.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      const contenido = reader.result as string;
      const filas = this.importService.parseCsv(contenido);
      if (filas.length === 0) {
        this.importando.set(false);
        this.importStatus.set({ message: 'El archivo no contiene datos válidos', type: 'error' });
        return;
      }
      this.importService.importar(filas).subscribe({
        next: (res) => {
          this.resultadoImport.set(res);
          this.importStatus.set({
            message: `✓ ${res.clientes_creados} clientes importados, ${res.clientes_actualizados} actualizados`,
            type: 'success'
          });
          // Ahora generar turnos automáticamente para la zona activa
          this._generarTurnosZona();
        },
        error: (err) => {
          this.importando.set(false);
          this.importStatus.set({ message: `Error al importar: ${err.message || 'Error de conexión'}`, type: 'error' });
        }
      });
    };
    reader.readAsText(file, 'UTF-8');
  }

  private _generarTurnosZona(): void {
    const zonaId = this.zonaSeleccionada();
    if (!zonaId) { this.importando.set(false); return; }

    const tecnicos = this.dataService.tecnicos().filter(t => t.zona_id === zonaId);
    if (tecnicos.length === 0) { this.importando.set(false); return; }

    const tecnicoIds = tecnicos.map(t => t.id!).filter(Boolean);
    const hoy = new Date().toISOString().split('T')[0];

    this.importStatus.set({ message: '⚙ Generando turnos para los técnicos...', type: 'info' });
    this.importService.generarTurnos(zonaId, tecnicoIds, hoy).subscribe({
      next: (res) => {
        this.importando.set(false);
        this.resultadoTurnos.set(res);
        this.importStatus.set({
          message: `✓ ${res.tareas_asignadas} tareas asignadas en ${res.turnos_creados} turnos a ${res.resumen_por_tecnico.length} técnicos`,
          type: 'success'
        });
        setTimeout(() => this.importStatus.set(null), 6000);
      },
      error: (err) => {
        this.importando.set(false);
        this.importStatus.set({ message: `Clientes importados. Error al generar turnos: ${err.message || ''}`, type: 'warn' });
      }
    });
  }

  dismissImport(): void {
    this.importStatus.set(null);
    this.resultadoImport.set(null);
    this.resultadoTurnos.set(null);
  }

  resetTodo(): void {
    if (!confirm('¿Borrar TODOS los clientes, turnos y asignaciones? Esta acción no se puede deshacer.')) return;
    this.apiService.resetDatos().subscribe({
      next: (res) => {
        this.importStatus.set({ message: `✓ ${res.message || 'Datos eliminados correctamente'}`, type: 'success' });
        this.dataService.cargarTodo();
        this.dataService.getCargaZonas();
        setTimeout(() => this.importStatus.set(null), 4000);
      },
      error: (err) => {
        this.importStatus.set({ message: `Error al borrar: ${err.message || 'Error de conexión'}`, type: 'error' });
      }
    });
  }
}
