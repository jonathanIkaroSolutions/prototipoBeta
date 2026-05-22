import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { DataService } from '../../../services/data.service';
import { ImportService, FilaImportacion, ResultadoImportacion } from '../../../services/import.service';
import { TareaTurno, Tecnico, Turno, Cliente, EstadoConfirmacion } from '../../../models/interfaces';

type VistaActual = 'tecnicos' | 'turnos' | 'confirmaciones';

@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive, TitleCasePipe],
  templateUrl: './turnos.html',
  styleUrls: ['./turnos.scss'],
})
export class Turnos implements OnInit {
  private dataService = inject(DataService);
  private importService = inject(ImportService);
  authService = inject(AuthService);

  turnos = this.dataService.turnos;
  tecnicos = this.dataService.tecnicos;
  clientesSinAsignar = computed(() => this.dataService.getClientesSinAsignar());

  // Vista actual
  vistaActual = signal<VistaActual>('tecnicos');
  selectedTecnico = signal<Tecnico | null>(null);
  showAssignModal = signal(false);
  showReservaModal = signal(false);
  selectedTurnoId = signal<number | null>(null);

  // Nota de confirmación temporal
  notaConfirmacion = '';

  ngOnInit(): void {
    // Refrescar datos al entrar en la vista para evitar datos vacíos
    this.dataService.cargarTodo();
  }

  // Turnos del tecnico seleccionado
  turnosTecnico = computed(() => {
    const tech = this.selectedTecnico();
    if (!tech) return [];
    return this.turnos().filter(t => t.tecnico_id === tech.id);
  });

  // Para el panel de confirmaciones: tareas titulares pendientes de confirmar
  tareasPendientesConfirmar = computed(() => {
    const tech = this.selectedTecnico();
    if (!tech) return [];
    const turnos = this.turnos().filter(t => t.tecnico_id === tech.id);
    return turnos.flatMap(t =>
      t.tareas
        .filter(ta => !ta.es_reserva && (ta.confirmacion === 'sin_avisar' || ta.confirmacion === 'avisado' || ta.confirmacion === 'no_contesta'))
        .map(ta => ({ ...ta, _turnoId: t.id! }))
    );
  });

  // Tareas confirmadas
  tareasConfirmadas = computed(() => {
    const tech = this.selectedTecnico();
    if (!tech) return [];
    const turnos = this.turnos().filter(t => t.tecnico_id === tech.id);
    return turnos.flatMap(t =>
      t.tareas
        .filter(ta => !ta.es_reserva && ta.confirmacion === 'confirmado')
        .map(ta => ({ ...ta, _turnoId: t.id! }))
    );
  });

  // Tareas que no confirmaron (saltadas)
  tareasNoConfirmadas = computed(() => {
    const tech = this.selectedTecnico();
    if (!tech) return [];
    const turnos = this.turnos().filter(t => t.tecnico_id === tech.id);
    return turnos.flatMap(t =>
      t.tareas
        .filter(ta => !ta.es_reserva && (ta.confirmacion === 'no_contesta_dia' || ta.confirmacion === 'rechazado'))
        .map(ta => ({ ...ta, _turnoId: t.id! }))
    );
  });

  // Reservas del técnico seleccionado
  reservasTecnico = computed(() => {
    const tech = this.selectedTecnico();
    if (!tech) return [];
    const turnos = this.turnos().filter(t => t.tecnico_id === tech.id);
    return turnos.flatMap(t =>
      t.tareas
        .filter(ta => ta.es_reserva)
        .sort((a, b) => (a.posicion_reserva || 99) - (b.posicion_reserva || 99))
        .map(ta => ({ ...ta, _turnoId: t.id! }))
    );
  });

  // Tareas titulares (no reservas) para la vista normal de turnos
  getTareasTitulares(turno: Turno): TareaTurno[] {
    return turno.tareas.filter(t => !t.es_reserva).sort((a, b) => a.orden - b.orden);
  }

  getReservasTurno(turno: Turno): TareaTurno[] {
    return turno.tareas.filter(t => t.es_reserva).sort((a, b) => (a.posicion_reserva || 0) - (b.posicion_reserva || 0));
  }

  // Estadísticas por técnico
  getTecnicoStats(tecnicoId: number): { tareas: number; completadas: number; pendientes: number; incidencias: number; sinConfirmar: number } {
    const turnosTech = this.turnos().filter(t => t.tecnico_id === tecnicoId);
    let tareas = 0, completadas = 0, pendientes = 0, incidencias = 0, sinConfirmar = 0;
    turnosTech.forEach(turno => {
      turno.tareas.filter(t => !t.es_reserva).forEach(t => {
        tareas++;
        if (t.estado === 'completada') completadas++;
        if (t.estado === 'pendiente') pendientes++;
        if (t.estado === 'incidencia') incidencias++;
        if (t.confirmacion !== 'confirmado' && t.estado === 'pendiente') sinConfirmar++;
      });
    });
    return { tareas, completadas, pendientes, incidencias, sinConfirmar };
  }

  /** Solo se puede clicar un técnico si tiene al menos un turno asignado */
  tecnicoTieneTurnos(tecnicoId: number): boolean {
    return this.turnos().some(t => t.tecnico_id === tecnicoId);
  }

  getEspecialidadLabel(esp: string): string {
    const labels: Record<string, string> = {
      calderas: 'Calderas',
      gas: 'Gas',
      electricidad: 'Electricidad',
      general: 'General'
    };
    return labels[esp] || esp;
  }

  /** Formatea fecha ISO (2026-05-25) → "Lunes 25/05/2026" */
  formatFechaConDia(fechaStr: string): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const [y, m, d] = fechaStr.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    const dia = dias[fecha.getDay()];
    return `${dia} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
  }

  // Foto del técnico (placeholder con randomuser.me)
  getTecnicoImg(tecnicoId: number): string {
    return `https://randomuser.me/api/portraits/men/${(tecnicoId * 13) % 70}.jpg`;
  }

  // ═══════════ NAVEGACIÓN ═══════════

  selectTecnico(tecnico: Tecnico): void {
    this.selectedTecnico.set(tecnico);
    this.vistaActual.set('turnos');
  }

  goBack(): void {
    if (this.vistaActual() === 'confirmaciones') {
      this.vistaActual.set('turnos');
    } else {
      this.selectedTecnico.set(null);
      this.vistaActual.set('tecnicos');
    }
  }

  openConfirmaciones(): void {
    this.vistaActual.set('confirmaciones');
  }

  // ═══════════ CONFIRMACIONES ═══════════

  marcarConfirmado(turnoId: number, tareaId: number): void {
    const nota = this.notaConfirmacion.trim() || 'Confirma cita';
    this.dataService.registrarIntento(turnoId, tareaId, 'confirmado', nota);
    this.notaConfirmacion = '';
  }

  marcarNoContesta(turnoId: number, tareaId: number): void {
    const nota = this.notaConfirmacion.trim() || 'No contesta al teléfono';
    this.dataService.registrarIntento(turnoId, tareaId, 'no_contesta', nota);
    this.notaConfirmacion = '';
  }

  marcarNoContestaDia(turnoId: number, tareaId: number): void {
    const nota = this.notaConfirmacion.trim() || 'No contesta reintento del mismo día';
    this.dataService.registrarIntento(turnoId, tareaId, 'no_contesta_dia', nota);
    this.notaConfirmacion = '';
  }

  marcarRechazado(turnoId: number, tareaId: number): void {
    const nota = this.notaConfirmacion.trim() || 'Cliente cancela la cita';
    this.dataService.registrarIntento(turnoId, tareaId, 'rechazado', nota);
    this.notaConfirmacion = '';
  }

  marcarAvisado(turnoId: number, tareaId: number): void {
    const nota = this.notaConfirmacion.trim() || 'Llamado, esperando confirmación';
    this.dataService.registrarIntento(turnoId, tareaId, 'avisado', nota);
    this.notaConfirmacion = '';
  }

  promoverReserva(turnoId: number, tareaNoConfirmadaId: number): void {
    this.dataService.promoverReserva(turnoId, tareaNoConfirmadaId);
  }

  getConfirmacionLabel(estado: EstadoConfirmacion): string {
    const labels: Record<EstadoConfirmacion, string> = {
      sin_avisar: 'Sin avisar',
      avisado: 'Avisado',
      confirmado: 'Confirmado',
      no_contesta: 'No contesta',
      no_contesta_dia: 'No contesta (día)',
      rechazado: 'Rechazado',
      promovido: 'Promovido'
    };
    return labels[estado] || estado;
  }

  getConfirmacionClass(estado: EstadoConfirmacion): string {
    const map: Record<EstadoConfirmacion, string> = {
      sin_avisar: 'default',
      avisado: 'warning',
      confirmado: 'success',
      no_contesta: 'danger',
      no_contesta_dia: 'danger',
      rechazado: 'danger',
      promovido: 'info'
    };
    return map[estado] || 'default';
  }

  // ═══════════ HELPERS DE CLIENTE ═══════════

  getCliente(clienteId: number): Cliente | undefined {
    return this.dataService.clientes().find(c => c.id === clienteId);
  }

  getClienteName(clienteId: number): string {
    return this.getCliente(clienteId)?.nombre || 'Desconocido';
  }

  getClienteDireccion(clienteId: number): string {
    return this.getCliente(clienteId)?.direccion || '';
  }

  getClienteTelefono(clienteId: number): string {
    return this.getCliente(clienteId)?.telefono || '';
  }

  getClienteCiudad(clienteId: number): string {
    return this.getCliente(clienteId)?.ciudad || '';
  }

  getClienteEquipo(clienteId: number): string {
    const c = this.getCliente(clienteId);
    if (!c) return '';
    const labels: Record<string, string> = {
      caldera_gas: 'Caldera Gas',
      caldera_gasoil: 'Caldera Gasoil',
      termo_electrico: 'Termo Eléctrico',
      aerotermia: 'Aerotermia',
      otro: 'Otro'
    };
    const tipo = labels[c.tipo_equipo] || c.tipo_equipo;
    return c.marca_equipo ? `${tipo} - ${c.marca_equipo}` : tipo;
  }

  // ═══════════ RUTA MAPS ═══════════

  openRouteMap(turnoId: number): void {
    const turno = this.turnos().find(t => t.id === turnoId);
    if (!turno || turno.tareas.length === 0) return;
    const addresses = turno.tareas
      .filter(t => !t.es_reserva && t.confirmacion === 'confirmado')
      .map(t => {
        const c = this.dataService.clientes().find(cl => cl.id === t.cliente_id);
        if (!c) return '';
        if (c.latitud && c.longitud) return `${c.latitud},${c.longitud}`;
        const dir = c.direccion_formateada || c.direccion || '';
        return encodeURIComponent(`${dir}, ${c.codigo_postal || ''} ${c.ciudad}, España`);
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

  // ═══════════ ASIGNACIÓN DE TAREAS ═══════════

  newTarea: Partial<TareaTurno> = {
    cliente_id: 0,
    tipo_servicio: 'gas',
    duracion_estimada: 45,
    descripcion: '',
    prioridad: 2,
    hora_estimada: '09:00',
    estado: 'pendiente',
    confirmacion: 'sin_avisar',
    intentos_contacto: 0,
    es_reserva: false,
  };

  openAssign(turnoId: number): void {
    this.selectedTurnoId.set(turnoId);
    this.newTarea = {
      cliente_id: 0,
      tipo_servicio: 'gas',
      duracion_estimada: 45,
      descripcion: '',
      prioridad: 2,
      hora_estimada: '09:00',
      estado: 'pendiente',
      confirmacion: 'sin_avisar',
      intentos_contacto: 0,
      es_reserva: false,
    };
    this.showAssignModal.set(true);
  }

  openAddReserva(turnoId: number): void {
    this.selectedTurnoId.set(turnoId);
    this.newTarea = {
      cliente_id: 0,
      tipo_servicio: 'gas',
      duracion_estimada: 45,
      descripcion: '',
      prioridad: 3,
      hora_estimada: '',
      estado: 'pendiente',
      confirmacion: 'sin_avisar',
      intentos_contacto: 0,
      es_reserva: true,
    };
    this.showReservaModal.set(true);
  }

  assignTarea(): void {
    const turnoId = this.selectedTurnoId();
    if (!turnoId || !this.newTarea.cliente_id) return;

    const cliente = this.dataService.clientes().find(c => c.id === this.newTarea.cliente_id);
    this.dataService.addTareaToTurno(turnoId, {
      ...this.newTarea as TareaTurno,
      cliente,
      orden: 0,
    });
    this.showAssignModal.set(false);
  }

  assignReserva(): void {
    const turnoId = this.selectedTurnoId();
    if (!turnoId || !this.newTarea.cliente_id) return;

    this.dataService.addReserva(turnoId, this.newTarea as TareaTurno);
    this.showReservaModal.set(false);
  }

  removeTarea(turnoId: number, tareaId: number): void {
    if (confirm('¿Quitar esta tarea del turno?')) {
      this.dataService.removeTareaFromTurno(turnoId, tareaId);
    }
  }

  removeReserva(turnoId: number, tareaId: number): void {
    if (confirm('¿Quitar este cliente de reserva?')) {
      this.dataService.removeReserva(turnoId, tareaId);
    }
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

  getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = { luz: 'Alonso LUZ', gas: 'Alonso GAS', osmosis: 'Alonso ÓSMOSIS', descal: 'Alonso DESCAL', ozono: 'Alonso OZONO', clima: 'Alonso CLIMA', fotovoltaica: 'Alonso FOTOVOLTAICA', manitas: 'Alonso MANITAS' };
    return labels[tipo] || tipo;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = { pendiente: 'default', en_curso: 'info', completada: 'success', incidencia: 'danger', cancelada: 'warning' };
    return map[estado] || 'default';
  }

  cancel(): void {
    this.showAssignModal.set(false);
    this.showReservaModal.set(false);
  }

  // ═══════════ IMPORTACIÓN EXCEL/CSV ═══════════
  showImportModal = signal(false);
  importFileName = signal('');
  importFilasCount = signal(0);
  importPreview = signal<FilaImportacion[]>([]);
  importResultado = signal<ResultadoImportacion | null>(null);
  private importFilas: FilaImportacion[] = [];

  openImportModal(): void {
    this.showImportModal.set(true);
    this.importFileName.set('');
    this.importFilasCount.set(0);
    this.importPreview.set([]);
    this.importResultado.set(null);
    this.importFilas = [];
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.importFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const contenido = reader.result as string;
      this.importFilas = this.importService.parseCsv(contenido);
      this.importFilasCount.set(this.importFilas.length);
      this.importPreview.set(this.importFilas.slice(0, 5));
    };
    reader.readAsText(file, 'UTF-8');
  }

  ejecutarImportacion(): void {
    if (this.importFilas.length === 0) return;
    this.importService.importar(this.importFilas).subscribe({
      next: (resultado) => this.importResultado.set(resultado),
      error: (err) => console.error('Error importando:', err)
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
