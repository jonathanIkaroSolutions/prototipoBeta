import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DataService } from '../../services/data.service';
import { TareaTurno, Tecnico, Turno, Cliente } from '../../models/interfaces';

type VistaMovil = 'jornada' | 'detalle-tarea';

@Component({
  selector: 'app-tecnico',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tecnico.html',
  styleUrls: ['./tecnico.scss'],
})
export class TecnicoPage {
  private dataService = inject(DataService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // El técnico logueado (se busca por ID del usuario autenticado)
  tecnicoActual = computed(() => {
    const user = this.authService.user();
    if (user) {
      const found = this.dataService.tecnicos().find(t => t.id === user.id);
      if (found) return found;
    }
    // Fallback: primer técnico (para desarrollo)
    return this.dataService.tecnicos()[0];
  });

  vista = signal<VistaMovil>('jornada');
  tareaSeleccionada = signal<TareaTurno | null>(null);
  turnoSeleccionadoId = signal<number | null>(null);

  // Motivo incidencia
  motivoIncidencia = '';
  notasTecnico = '';

  // Turno del día del técnico actual
  turnoHoy = computed(() => {
    const tech = this.tecnicoActual();
    const hoy = new Date().toISOString().split('T')[0];
    return this.dataService.turnos().find(t => t.tecnico_id === tech.id && t.fecha === hoy) || null;
  });

  // Tareas titulares confirmadas (las que el técnico debe hacer hoy)
  tareasHoy = computed(() => {
    const turno = this.turnoHoy();
    if (!turno) return [];
    return turno.tareas
      .filter(t => !t.es_reserva && t.estado !== 'cancelada')
      .sort((a, b) => a.orden - b.orden);
  });

  // Estadísticas rápidas
  statsHoy = computed(() => {
    const tareas = this.tareasHoy();
    return {
      total: tareas.length,
      completadas: tareas.filter(t => t.estado === 'completada').length,
      enCurso: tareas.filter(t => t.estado === 'en_curso').length,
      pendientes: tareas.filter(t => t.estado === 'pendiente').length,
      incidencias: tareas.filter(t => t.estado === 'incidencia').length,
    };
  });

  // Progreso en porcentaje
  progreso = computed(() => {
    const stats = this.statsHoy();
    if (stats.total === 0) return 0;
    return Math.round((stats.completadas / stats.total) * 100);
  });

  // Tarea activa (en_curso)
  tareaActiva = computed(() => {
    return this.tareasHoy().find(t => t.estado === 'en_curso') || null;
  });

  // Siguiente tarea pendiente
  siguienteTarea = computed(() => {
    return this.tareasHoy().find(t => t.estado === 'pendiente') || null;
  });

  // Hora actual formateada
  horaActual(): string {
    return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // ═══════════ ACCIONES DEL TÉCNICO ═══════════

  // Iniciar trabajo (pasar a en_curso)
  iniciarTrabajo(tarea: TareaTurno): void {
    const turno = this.turnoHoy();
    if (!turno) return;
    this.dataService.updateTareaEstado(turno.id!, tarea.id!, 'en_curso');
  }

  // Finalizar trabajo (pasar a completada)
  finalizarTrabajo(tarea: TareaTurno): void {
    const turno = this.turnoHoy();
    if (!turno) return;
    this.dataService.updateTareaEstado(turno.id!, tarea.id!, 'completada');
    // Volver a vista jornada si estábamos en detalle
    if (this.vista() === 'detalle-tarea') {
      this.vista.set('jornada');
      this.tareaSeleccionada.set(null);
    }
  }

  // Reportar incidencia
  reportarIncidencia(tarea: TareaTurno): void {
    const turno = this.turnoHoy();
    if (!turno || !this.motivoIncidencia.trim()) return;
    this.dataService.updateTareaEstado(turno.id!, tarea.id!, 'incidencia', this.motivoIncidencia.trim());
    this.motivoIncidencia = '';
    if (this.vista() === 'detalle-tarea') {
      this.vista.set('jornada');
      this.tareaSeleccionada.set(null);
    }
  }

  // ═══════════ NAVEGACIÓN ═══════════

  verDetalle(tarea: TareaTurno): void {
    this.tareaSeleccionada.set(tarea);
    this.turnoSeleccionadoId.set(this.turnoHoy()?.id || null);
    this.vista.set('detalle-tarea');
    this.motivoIncidencia = '';
    this.notasTecnico = '';
  }

  volverJornada(): void {
    this.vista.set('jornada');
    this.tareaSeleccionada.set(null);
  }

  // ═══════════ HELPERS ═══════════

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

  getClienteNotas(clienteId: number): string {
    return this.getCliente(clienteId)?.notas || '';
  }

  getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = { luz: 'Alonso LUZ', gas: 'Alonso GAS', osmosis: 'Alonso ÓSMOSIS', descal: 'Alonso DESCAL', ozono: 'Alonso OZONO', clima: 'Alonso CLIMA', fotovoltaica: 'Alonso FOTOVOLTAICA', manitas: 'Alonso MANITAS' };
    return labels[tipo] || tipo;
  }

  getEstadoLabel(estado: string): string {
    const labels: Record<string, string> = { pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada', incidencia: 'Incidencia', cancelada: 'Cancelada' };
    return labels[estado] || estado;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = { pendiente: 'pending', en_curso: 'active', completada: 'done', incidencia: 'error', cancelada: 'cancelled' };
    return map[estado] || 'pending';
  }

  getPrioridadLabel(p: number): string {
    return p === 1 ? 'Alta' : p === 2 ? 'Media' : 'Baja';
  }

  // Abrir navegación GPS al cliente
  abrirNavegacion(clienteId: number): void {
    const c = this.getCliente(clienteId);
    if (!c) return;
    const address = encodeURIComponent(`${c.direccion}, ${c.ciudad}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`, '_blank');
  }

  // Llamar al cliente
  llamarCliente(clienteId: number): void {
    const tel = this.getClienteTelefono(clienteId);
    if (tel) {
      window.open(`tel:${tel}`, '_self');
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
