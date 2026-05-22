import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { DataService } from '../../../services/data.service';
import { Itinerario as ItinerarioModel, ParadaItinerario, EstadoParada, Tecnico } from '../../../models/interfaces';

interface AlertaTrafico {
  id: number;
  tipo: 'atasco' | 'accidente' | 'obras' | 'ruta_alternativa' | 'retraso';
  mensaje: string;
  hora: string;
  severidad: 'info' | 'warning' | 'danger';
  paradaAfectada?: number; // orden
}

interface PosicionTecnico {
  paradaActual: number; // orden de la parada actual/destino
  progreso: number; // 0-100 entre parada anterior y actual
  enMovimiento: boolean;
  velocidad: 'normal' | 'lento' | 'detenido';
  ultimaActualizacion: string;
}

@Component({
  selector: 'app-itinerario',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './itinerario.html',
  styleUrls: ['./itinerario.scss'],
})
export class Itinerario implements OnDestroy {
  private dataService = inject(DataService);
  authService = inject(AuthService);

  itinerarios = this.dataService.itinerarios;

  // Vista: null = lista técnicos, Tecnico = detalle itinerario
  selectedTecnico = signal<Tecnico | null>(null);
  
  // Modo seguimiento en vivo
  liveTrackingActive = signal(false);
  posicionTecnico = signal<PosicionTecnico>({
    paradaActual: 2,
    progreso: 65,
    enMovimiento: true,
    velocidad: 'normal',
    ultimaActualizacion: this.getHoraActual()
  });
  alertasTrafico = signal<AlertaTrafico[]>([]);
  etasActualizadas = signal<Record<number, { original: string, nueva: string, retraso: number }>>({});
  
  private simulationInterval: any = null;
  private alertaIdCounter = 0;

  itinerarioActual = computed<ItinerarioModel | null>(() => {
    const tech = this.selectedTecnico();
    if (!tech) return null;
    return this.itinerarios().find(it => it.tecnico.id === tech.id) || null;
  });

  // Google Maps URL para la ruta con marcadores visibles en cada parada
  googleMapsUrl = computed(() => {
    const it = this.itinerarioActual();
    if (!it || it.paradas.length === 0) return '';
    // Usar coordenadas si están disponibles, sino fallback a dirección texto
    const addresses = it.paradas.map(p => {
      if (p.cliente?.latitud && p.cliente?.longitud) {
        return `${p.cliente.latitud},${p.cliente.longitud}`;
      }
      const dir = p.cliente?.direccion_formateada || p.cliente?.direccion || '';
      const ciudad = p.cliente?.ciudad || 'Zaragoza';
      const cp = p.cliente?.codigo_postal || '';
      return encodeURIComponent(`${dir}, ${cp} ${ciudad}, España`);
    });
    // Formato con origin/destination/waypoints muestra marcadores A, B, C grandes
    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    if (addresses.length === 1) {
      // Solo 1 parada: abrir ubicación directamente
      return `https://www.google.com/maps/search/?api=1&query=${origin}`;
    }
    if (addresses.length <= 2) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    }
    const waypoints = addresses.slice(1, -1).join('%7C');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  });

  // URL alternativa: formato /dir/ con todos los puntos (muestra ruta completa)
  googleMapsUrlAlternative = computed(() => {
    const it = this.itinerarioActual();
    if (!it || it.paradas.length === 0) return '';
    const points = it.paradas.map(p => {
      if (p.cliente?.latitud && p.cliente?.longitud) {
        return encodeURIComponent(`${p.cliente.latitud},${p.cliente.longitud}`);
      }
      const dir = p.cliente?.direccion_formateada || p.cliente?.direccion || '';
      const ciudad = p.cliente?.ciudad || 'Zaragoza';
      const cp = p.cliente?.codigo_postal || '';
      return encodeURIComponent(`${dir}, ${cp} ${ciudad}, España`);
    });
    return `https://www.google.com/maps/dir/${points.join('/')}`;
  });

  // ETA total restante con tráfico
  etaTotalRestante = computed(() => {
    const it = this.itinerarioActual();
    if (!it) return 0;
    const etas = this.etasActualizadas();
    let total = 0;
    it.paradas.forEach(p => {
      if (p.estado !== 'realizado') {
        const retraso = etas[p.orden]?.retraso || 0;
        total += p.tiempo_ruta_estimado + p.duracion_estimada + retraso;
      }
    });
    return total;
  });

  selectTecnico(tecnico: Tecnico): void {
    this.selectedTecnico.set(tecnico);
  }

  goBack(): void {
    this.selectedTecnico.set(null);
    this.stopLiveTracking();
  }

  // ═══════ LIVE TRACKING ═══════

  toggleLiveTracking(): void {
    if (this.liveTrackingActive()) {
      this.stopLiveTracking();
    } else {
      this.startLiveTracking();
    }
  }

  private startLiveTracking(): void {
    this.liveTrackingActive.set(true);
    // Inicializar posición basada en el itinerario actual
    const it = this.itinerarioActual();
    if (it) {
      const enCurso = it.paradas.find(p => p.estado === 'en_servicio' || p.estado === 'en_ruta');
      this.posicionTecnico.set({
        paradaActual: enCurso?.orden || 2,
        progreso: enCurso?.estado === 'en_ruta' ? 45 : (enCurso?.estado === 'en_servicio' ? 100 : 0),
        enMovimiento: enCurso?.estado === 'en_ruta',
        velocidad: 'normal',
        ultimaActualizacion: this.getHoraActual()
      });
    }
    
    // Simular movimiento cada 3 segundos
    this.simulationInterval = setInterval(() => {
      this.simulateMovement();
    }, 3000);

    // Generar primera alerta tras 5 seg
    setTimeout(() => {
      if (this.liveTrackingActive()) this.generateTrafficAlert();
    }, 5000);
  }

  private stopLiveTracking(): void {
    this.liveTrackingActive.set(false);
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  private simulateMovement(): void {
    const pos = this.posicionTecnico();
    if (!pos.enMovimiento) return;
    
    // Calcular avance según velocidad
    let avance = 8; // normal
    if (pos.velocidad === 'lento') avance = 3;
    if (pos.velocidad === 'detenido') avance = 0;

    let newProgreso = pos.progreso + avance;
    let newParada = pos.paradaActual;
    let enMovimiento = true;

    if (newProgreso >= 100) {
      // Llegó a la parada - queda quieto unos ciclos
      newProgreso = 100;
      enMovimiento = false;
      // Después de "llegar", restart movement to next stop
      setTimeout(() => {
        const it = this.itinerarioActual();
        if (it && this.liveTrackingActive()) {
          const nextOrder = pos.paradaActual + 1;
          if (nextOrder <= it.paradas.length) {
            this.posicionTecnico.set({
              paradaActual: nextOrder,
              progreso: 0,
              enMovimiento: true,
              velocidad: Math.random() > 0.7 ? 'lento' : 'normal',
              ultimaActualizacion: this.getHoraActual()
            });
            // Posible alerta de tráfico
            if (Math.random() > 0.5) this.generateTrafficAlert();
          }
        }
      }, 8000);
    }

    this.posicionTecnico.set({
      ...pos,
      progreso: Math.min(newProgreso, 100),
      enMovimiento,
      ultimaActualizacion: this.getHoraActual()
    });
  }

  private generateTrafficAlert(): void {
    const alertTypes: Array<{ tipo: AlertaTrafico['tipo']; mensajes: string[]; severidad: AlertaTrafico['severidad'] }> = [
      { tipo: 'atasco', mensajes: ['Tráfico denso en Av. Independencia - +8 min', 'Retenciones en Paseo Sagasta zona centro - +5 min', 'Congestión en Ronda Hispanidad - +12 min'], severidad: 'warning' },
      { tipo: 'accidente', mensajes: ['Accidente en A-2 km 315 - carril cortado', 'Colisión menor en Gran Vía - desvío recomendado'], severidad: 'danger' },
      { tipo: 'obras', mensajes: ['Obras en C/ San Miguel - corte parcial', 'Zona en obras: Pza. España, desvío por C/ Alfonso'], severidad: 'info' },
      { tipo: 'ruta_alternativa', mensajes: ['Ruta alternativa encontrada: -4 min por C/ Tenor Fleta', 'Ruta más rápida disponible via Autovía del Tercer Milenio'], severidad: 'info' },
      { tipo: 'retraso', mensajes: ['Retraso estimado de 10 min en próxima parada', 'ETA actualizado: +7 min por tráfico'], severidad: 'warning' }
    ];
    
    const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const mensaje = alertType.mensajes[Math.floor(Math.random() * alertType.mensajes.length)];
    const it = this.itinerarioActual();
    const paradaAfectada = it ? Math.min(this.posicionTecnico().paradaActual + 1, it.paradas.length) : undefined;

    const newAlerta: AlertaTrafico = {
      id: ++this.alertaIdCounter,
      tipo: alertType.tipo,
      mensaje,
      hora: this.getHoraActual(),
      severidad: alertType.severidad,
      paradaAfectada
    };

    this.alertasTrafico.update(alerts => [newAlerta, ...alerts].slice(0, 8));

    // Actualizar ETAs si es un retraso
    if (alertType.tipo === 'atasco' || alertType.tipo === 'retraso' || alertType.tipo === 'accidente') {
      const retraso = Math.floor(Math.random() * 12) + 3;
      if (paradaAfectada && it) {
        const parada = it.paradas.find(p => p.orden === paradaAfectada);
        if (parada) {
          this.etasActualizadas.update(etas => ({
            ...etas,
            [paradaAfectada]: {
              original: parada.hora_estimada_llegada,
              nueva: this.addMinutes(parada.hora_estimada_llegada, retraso),
              retraso
            }
          }));
        }
      }
      // Simular velocidad lenta
      this.posicionTecnico.update(pos => ({ ...pos, velocidad: 'lento' }));
      // Recuperar velocidad tras unos segundos
      setTimeout(() => {
        if (this.liveTrackingActive()) {
          this.posicionTecnico.update(pos => ({ ...pos, velocidad: 'normal' }));
        }
      }, 12000);
    } else if (alertType.tipo === 'ruta_alternativa') {
      // Ruta alternativa: reducir retrasos existentes
      const etas = this.etasActualizadas();
      const updated = { ...etas };
      Object.keys(updated).forEach(key => {
        const k = Number(key);
        if (updated[k].retraso > 3) {
          updated[k] = { ...updated[k], retraso: updated[k].retraso - 3, nueva: this.addMinutes(updated[k].original, updated[k].retraso - 3) };
        }
      });
      this.etasActualizadas.set(updated);
    }
  }

  dismissAlerta(id: number): void {
    this.alertasTrafico.update(alerts => alerts.filter(a => a.id !== id));
  }

  openGoogleMaps(): void {
    const url = this.googleMapsUrl();
    if (url) window.open(url, '_blank');
  }

  // Convierte índice a letra de marcador Google Maps (A, B, C...)
  getLetter(index: number): string {
    return String.fromCharCode(65 + index); // A=65
  }

  getAlertaIcon(tipo: AlertaTrafico['tipo']): string {
    const icons: Record<string, string> = {
      atasco: '🚗',
      accidente: '⚠️',
      obras: '🚧',
      ruta_alternativa: '🗺️',
      retraso: '⏱️'
    };
    return icons[tipo] || '📍';
  }

  private getHoraActual(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  private addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }

  formatEta(mins: number): string {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  ngOnDestroy(): void {
    this.stopLiveTracking();
  }

  // ═══════ ACCIONES DEL ITINERARIO ═══════

  avisar(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.avisarParada(it.turno.id!, parada.tarea_id);
    // Forzar recalcular actualizando la tarea
    this.dataService.updateParadaData(it.turno.id!, parada.tarea_id, { estado_aviso: 'avisado' });
  }

  confirmar(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.confirmarParada(it.turno.id!, parada.tarea_id);
  }

  marcarNoConfirmado(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.incidenciaParada(it.turno.id!, parada.tarea_id, 'Cliente no confirma / no contesta');
  }

  iniciarRuta(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.iniciarRutaParada(it.turno.id!, parada.tarea_id);
  }

  iniciarServicio(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.iniciarServicioParada(it.turno.id!, parada.tarea_id);
  }

  completar(parada: ParadaItinerario): void {
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.completarParada(it.turno.id!, parada.tarea_id);
  }

  reportarIncidencia(parada: ParadaItinerario): void {
    const motivo = prompt('Motivo de la incidencia:');
    if (!motivo) return;
    const it = this.itinerarioActual();
    if (!it?.turno) return;
    this.dataService.incidenciaParada(it.turno.id!, parada.tarea_id, motivo);
  }

  // ═══════ HELPERS DE ESTADO ═══════

  getEstadoLabel(estado: EstadoParada): string {
    const labels: Record<EstadoParada, string> = {
      pendiente_aviso: 'Pendiente aviso',
      avisado: 'Avisado',
      confirmado: 'Confirmado',
      no_confirmado: 'No confirmado',
      en_ruta: 'En ruta',
      en_servicio: 'En servicio',
      realizado: 'Realizado',
      incidencia: 'Incidencia'
    };
    return labels[estado] || estado;
  }

  getEstadoClass(estado: EstadoParada): string {
    const map: Record<EstadoParada, string> = {
      pendiente_aviso: 'pendiente',
      avisado: 'avisado',
      confirmado: 'confirmado',
      no_confirmado: 'no-confirmado',
      en_ruta: 'en-ruta',
      en_servicio: 'en-servicio',
      realizado: 'realizado',
      incidencia: 'incidencia'
    };
    return map[estado] || 'pendiente';
  }

  getItinerarioEstadoLabel(estado: ItinerarioModel['estado_actual']): string {
    const labels: Record<string, string> = {
      no_iniciado: 'No iniciado',
      en_ruta: 'En ruta',
      en_servicio: 'En servicio',
      finalizado: 'Finalizado'
    };
    return labels[estado] || estado;
  }

  getItinerarioEstadoClass(estado: ItinerarioModel['estado_actual']): string {
    const map: Record<string, string> = {
      no_iniciado: 'default',
      en_ruta: 'info',
      en_servicio: 'warning',
      finalizado: 'success'
    };
    return map[estado] || 'default';
  }

  getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = { luz: 'Alonso LUZ', gas: 'Alonso GAS', osmosis: 'Alonso ÓSMOSIS', descal: 'Alonso DESCAL', ozono: 'Alonso OZONO', clima: 'Alonso CLIMA', fotovoltaica: 'Alonso FOTOVOLTAICA', manitas: 'Alonso MANITAS' };
    return labels[tipo] || tipo;
  }

  // Verificar si se puede hacer la siguiente acción
  canAvisar(parada: ParadaItinerario): boolean {
    return parada.estado === 'pendiente_aviso';
  }

  canConfirmar(parada: ParadaItinerario): boolean {
    return parada.estado === 'avisado';
  }

  canIniciarRuta(parada: ParadaItinerario): boolean {
    return parada.estado === 'confirmado';
  }

  canIniciarServicio(parada: ParadaItinerario): boolean {
    return parada.estado === 'en_ruta' || parada.estado === 'confirmado';
  }

  canCompletar(parada: ParadaItinerario): boolean {
    return parada.estado === 'en_servicio';
  }

  // Progreso visual del estado
  getProgresoEstado(estado: EstadoParada): number {
    const progreso: Record<EstadoParada, number> = {
      pendiente_aviso: 0,
      avisado: 20,
      confirmado: 40,
      no_confirmado: 0,
      en_ruta: 60,
      en_servicio: 80,
      realizado: 100,
      incidencia: 0
    };
    return progreso[estado] || 0;
  }

  getTecnicoStats(tecnicoId: number) {
    const it = this.itinerarios().find(i => i.tecnico.id === tecnicoId);
    if (!it) return { total: 0, realizados: 0, enServicio: 0, pendientes: 0, incidencias: 0 };
    return {
      total: it.paradas.length,
      realizados: it.paradas.filter(p => p.estado === 'realizado').length,
      enServicio: it.paradas.filter(p => p.estado === 'en_servicio').length,
      pendientes: it.paradas.filter(p => ['pendiente_aviso', 'avisado', 'confirmado'].includes(p.estado)).length,
      incidencias: it.paradas.filter(p => p.estado === 'incidencia').length,
    };
  }

  logout(): void {
    this.authService.logout();
  }
}
