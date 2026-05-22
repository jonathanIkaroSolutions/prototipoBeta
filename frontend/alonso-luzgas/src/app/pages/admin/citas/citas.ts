import { Component, signal, computed, inject, effect, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { AuthService } from '../../../services/auth';
import { DataService } from '../../../services/data.service';
import { TareaTurno, Tecnico, Turno, EstadoConfirmacion } from '../../../models/interfaces';

interface TareaSimple {
  id: number;
  turnoId: number;
  clienteNombre: string;
  clienteTelefono: string;
  hora: string;
  confirmacion: EstadoConfirmacion;
  esReserva: boolean;
}

interface ReservaDiaSemana {
  fecha: string;
  diaLabel: string; // "Lun 26", "Mar 27"...
  esHoy: boolean;
  esDiaSeleccionado: boolean;
  reservas: { tecnicoNombre: string; tecnicoId: number; turnoId: number; cliente: TareaSimple; hayFallos: boolean }[];
}

interface TurnoCard {
  turno: Turno;
  tecnico: Tecnico | undefined;
  tecnicoId: number;
  tecnicoNombre: string;
  titulares: TareaSimple[];
  reservas: TareaSimple[];
  hayFallos: boolean;
  puedePromover: boolean;
}

interface DiaCalendario {
  fecha: string;          // YYYY-MM-DD
  dia: number;            // numero del dia
  esHoy: boolean;
  esMesActual: boolean;
  turnos: { tecnicoId: number; hayFallo: boolean }[];   // un punto por tecnico
  totalCitas: number;
  hayReservas: boolean;
}

// Paleta de colores por tecnico (ciclica)
const COLORES = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TitleCasePipe],
  templateUrl: './citas.html',
  styleUrls: ['./citas.scss'],
})
export class Citas implements OnInit {
  private dataService = inject(DataService);
  authService = inject(AuthService);

  turnos = this.dataService.turnos;
  tecnicos = this.dataService.tecnicos;
  clientes = this.dataService.clientes;

  fechaVista = signal<string>(this.toLocalDateStr(new Date()));
  mesVista = signal<string>(this.toLocalDateStr(new Date()).slice(0, 7)); // YYYY-MM
  tecnicoExpandido = signal<number | null>(null);

  ngOnInit(): void {
    this.dataService.cargarTodo();
  }

  constructor() {
    effect(() => {
      const hoy = this.toLocalDateStr(new Date());
      if (this.fechaVista() !== hoy) return;
      const turnos = this.turnos();
      if (turnos.length === 0) return;
      const hayHoy = turnos.some(t => t.fecha === hoy);
      if (!hayHoy) {
        const fechas = turnos.map(t => t.fecha).sort();
        const proxima = fechas.find(f => f >= hoy) || fechas[fechas.length - 1];
        if (proxima) {
          this.fechaVista.set(proxima);
          this.mesVista.set(proxima.slice(0, 7));
        }
      }
    }, { allowSignalWrites: true });
  }

  // ── CALENDARIO MENSUAL ───────────────────────────────────────
  diasDelMes = computed<DiaCalendario[]>(() => {
    const [year, month] = this.mesVista().split('-').map(Number);
    const hoy = this.toLocalDateStr(new Date());
    const turnos = this.turnos();

    const primerDia = new Date(year, month - 1, 1);
    const ultimoDia = new Date(year, month, 0);

    // Empezar desde el lunes de la semana del primer dia
    const inicio = new Date(primerDia);
    const dow = (primerDia.getDay() + 6) % 7; // 0=lunes
    inicio.setDate(primerDia.getDate() - dow);

    const dias: DiaCalendario[] = [];
    const cur = new Date(inicio);

    while (cur <= ultimoDia || dias.length % 7 !== 0 || dias.length < 35) {
      const fechaStr = this.toLocalDateStr(cur);
      const esMes = cur.getMonth() === month - 1;
      const turnosDia = turnos.filter(t => t.fecha === fechaStr);
      const puntos = turnosDia.map(t => ({
        tecnicoId: t.tecnico_id,
        hayFallo: t.tareas.some(ta => !ta.es_reserva && ta.confirmacion === 'rechazado'),
      }));
      const totalCitas = turnosDia.reduce((s, t) => s + t.tareas.filter(ta => !ta.es_reserva).length, 0);
      const hayReservas = turnosDia.some(t => t.tareas.some(ta => ta.es_reserva));

      dias.push({
        fecha: fechaStr,
        dia: cur.getDate(),
        esHoy: fechaStr === hoy,
        esMesActual: esMes,
        turnos: puntos,
        totalCitas,
        hayReservas,
      });

      cur.setDate(cur.getDate() + 1);
      if (dias.length >= 42) break;
    }
    return dias;
  });

  mesLabel = computed(() => {
    const [year, month] = this.mesVista().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  });

  prevMes(): void {
    const [y, m] = this.mesVista().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.mesVista.set(this.toLocalDateStr(d).slice(0, 7));
  }

  nextMes(): void {
    const [y, m] = this.mesVista().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.mesVista.set(this.toLocalDateStr(d).slice(0, 7));
  }

  seleccionarDia(fecha: string): void {
    this.fechaVista.set(fecha);
    this.mesVista.set(fecha.slice(0, 7));
    this.tecnicoExpandido.set(null);
  }

  toggleTecnico(turnoId: number): void {
    this.tecnicoExpandido.set(this.tecnicoExpandido() === turnoId ? null : turnoId);
  }

  // ── DETALLE DEL DIA SELECCIONADO ────────────────────────────
  turnosDelDia = computed<TurnoCard[]>(() => {
    const fecha = this.fechaVista();
    const turnosDia = this.turnos().filter(t => t.fecha === fecha);
    const clientes = this.clientes();
    const tecnicos = this.tecnicos();

    const mapTarea = (ta: TareaTurno, turnoId: number): TareaSimple => {
      const cliente = clientes.find(c => c.id === ta.cliente_id);
      return {
        id: ta.id!,
        turnoId,
        clienteNombre: cliente?.nombre || 'Desconocido',
        clienteTelefono: cliente?.telefono || '',
        hora: ta.hora_estimada,
        confirmacion: ta.confirmacion,
        esReserva: ta.es_reserva,
      };
    };

    return turnosDia.map(turno => {
      const tecnico = tecnicos.find(t => t.id === turno.tecnico_id);
      const titulares = turno.tareas.filter(t => !t.es_reserva).map(t => mapTarea(t, turno.id!)).sort((a, b) => a.hora.localeCompare(b.hora));
      const reservas = turno.tareas.filter(t => t.es_reserva).map(t => mapTarea(t, turno.id!));
      const hayFallos = titulares.some(t => t.confirmacion === 'rechazado');
      return {
        turno,
        tecnico,
        tecnicoId: turno.tecnico_id,
        tecnicoNombre: tecnico ? `${tecnico.first_name} ${tecnico.last_name}` : 'Sin asignar',
        titulares,
        reservas,
        hayFallos,
        puedePromover: hayFallos && reservas.length > 0,
      };
    }).sort((a, b) => a.tecnicoNombre.localeCompare(b.tecnicoNombre));
  });

  alertasTurnos = computed(() => this.turnosDelDia().filter(tc => tc.puedePromover));

  // ── INCIDENCIAS DEL DIA (citas fallidas/canceladas) ─────────
  incidenciasDelDia = computed<{ tarea: TareaSimple; tecnicoNombre: string; tecnicoId: number }[]>(() => {
    const resultado: { tarea: TareaSimple; tecnicoNombre: string; tecnicoId: number }[] = [];
    for (const tc of this.turnosDelDia()) {
      for (const cita of tc.titulares) {
        if (cita.confirmacion === 'rechazado') {
          resultado.push({ tarea: cita, tecnicoNombre: tc.tecnicoNombre, tecnicoId: tc.tecnicoId });
        }
      }
    }
    return resultado;
  });

  // ── RESERVAS DEL DIA (zona principal) ───────────────────────
  reservasDelDia = computed<{ tecnicoNombre: string; tecnicoId: number; turnoId: number; reservas: TareaSimple[]; hayFallos: boolean }[]>(() => {
    return this.turnosDelDia()
      .filter(tc => tc.reservas.length > 0)
      .map(tc => ({ tecnicoNombre: tc.tecnicoNombre, tecnicoId: tc.tecnicoId, turnoId: tc.turno.id!, reservas: tc.reservas, hayFallos: tc.hayFallos }));
  });

  totalReservas = computed(() => this.reservasDelDia().reduce((sum, g) => sum + g.reservas.length, 0));

  // ── RESERVAS DE LA SEMANA (panel derecho) ───────────────────
  reservasDeLaSemana = computed<ReservaDiaSemana[]>(() => {
    const fechaSel = this.fechaVista();
    const hoy = this.toLocalDateStr(new Date());
    const turnos = this.turnos();
    const clientes = this.clientes();
    const tecnicos = this.tecnicos();

    // Calcular lunes de la semana del dia seleccionado
    const d = new Date(fechaSel + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7; // 0=lunes
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - dow);

    const diasSemana: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const resultado: ReservaDiaSemana[] = [];

    for (let i = 0; i < 7; i++) {
      const cur = new Date(lunes);
      cur.setDate(lunes.getDate() + i);
      const fecha = this.toLocalDateStr(cur);
      const turnosDia = turnos.filter(t => t.fecha === fecha);

      const reservas: ReservaDiaSemana['reservas'] = [];
      for (const turno of turnosDia) {
        const tecnico = tecnicos.find(t => t.id === turno.tecnico_id);
        const tecNombre = tecnico ? `${tecnico.first_name} ${tecnico.last_name}` : 'Sin asignar';
        const hayFallos = turno.tareas.some(ta => !ta.es_reserva && ta.confirmacion === 'rechazado');
        for (const ta of turno.tareas.filter(t => t.es_reserva)) {
          const cliente = clientes.find(c => c.id === ta.cliente_id);
          reservas.push({
            tecnicoNombre: tecNombre,
            tecnicoId: turno.tecnico_id,
            turnoId: turno.id!,
            hayFallos,
            cliente: {
              id: ta.id!,
              turnoId: turno.id!,
              clienteNombre: cliente?.nombre || 'Desconocido',
              clienteTelefono: cliente?.telefono || '',
              hora: ta.hora_estimada,
              confirmacion: ta.confirmacion,
              esReserva: true,
            },
          });
        }
      }

      resultado.push({
        fecha,
        diaLabel: `${diasSemana[i]} ${cur.getDate()}`,
        esHoy: fecha === hoy,
        esDiaSeleccionado: fecha === fechaSel,
        reservas,
      });
    }
    return resultado;
  });

  totalReservasSemana = computed(() => this.reservasDeLaSemana().reduce((sum, d) => sum + d.reservas.length, 0));

  semanaLabel = computed(() => {
    const fechaSel = this.fechaVista();
    const d = new Date(fechaSel + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7;
    const lunes = new Date(d);
    lunes.setDate(d.getDate() - dow);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    const fmt = (dt: Date) => dt.getDate() + ' ' + dt.toLocaleDateString('es-ES', { month: 'short' });
    return `${fmt(lunes)} - ${fmt(domingo)}`;
  });

  // ── ACCIONES ─────────────────────────────────────────────────
  marcarFallo(turnoId: number, tareaId: number): void {
    this.dataService.registrarIntento(turnoId, tareaId, 'rechazado', 'Cliente no disponible');
  }

  promoverReserva(turnoId: number, reservaTareaId: number): void {
    this.dataService.promoverReserva(turnoId, reservaTareaId);
  }

  // ── HELPERS ──────────────────────────────────────────────────
  getColorTecnico(tecnicoId: number): string {
    const idx = this.tecnicos().findIndex(t => t.id === tecnicoId);
    return COLORES[(idx >= 0 ? idx : tecnicoId) % COLORES.length];
  }

  getTecnicoImg(tecnicoId: number): string {
    return `https://randomuser.me/api/portraits/men/${(tecnicoId * 13) % 70}.jpg`;
  }

  formatFechaVista(): string {
    return new Date(this.fechaVista() + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  esDiaSeleccionado(fecha: string): boolean {
    return this.fechaVista() === fecha;
  }

  /** Formatea Date a YYYY-MM-DD en hora local (evita desfase UTC) */
  private toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getConfirmacionLabel(conf: string): string {
    const map: Record<string, string> = {
      sin_avisar: 'Pendiente', avisado: 'Avisado', confirmado: 'Confirmado',
      no_contesta: 'No contesta', rechazado: 'Cancelado', promovido: 'Promovido',
    };
    return map[conf] || conf;
  }

  logout(): void { this.authService.logout(); }
}
