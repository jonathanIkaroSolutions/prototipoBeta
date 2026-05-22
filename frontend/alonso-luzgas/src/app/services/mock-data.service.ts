import { Injectable, signal, computed } from '@angular/core';
import { Tecnico, Cliente, Turno, TareaTurno, Itinerario, ParadaItinerario, EstadoParada, EstadoConfirmacion, ResumenConfirmaciones } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class MockDataService {

  // ═══════════ TÉCNICOS (3 por coordinador) ═══════════
  private _tecnicos = signal<Tecnico[]>([
    {
      id: 10, username: 'mgarcia', first_name: 'Miguel', last_name: 'García López',
      email: 'miguel@alonsoluzgas.es', rol: 'tecnico', telefono: '666111222',
      coordinador_id: 1, especialidad: 'calderas', vehiculo: 'Citroën Berlingo - 4521 GHJ',
      zona_id: 1, zona_nombre: 'Centro', max_tareas_dia: 12
    },
    {
      id: 11, username: 'alopez', first_name: 'Andrés', last_name: 'López Martín',
      email: 'andres@alonsoluzgas.es', rol: 'tecnico', telefono: '666333444',
      coordinador_id: 1, especialidad: 'gas', vehiculo: 'Renault Kangoo - 8834 KLM',
      zona_id: 2, zona_nombre: 'Universidad / Romareda', max_tareas_dia: 12
    },
    {
      id: 12, username: 'pserrano', first_name: 'Pablo', last_name: 'Serrano Gil',
      email: 'pablo@alonsoluzgas.es', rol: 'tecnico', telefono: '666555666',
      coordinador_id: 1, especialidad: 'general', vehiculo: 'Peugeot Partner - 2290 BNX',
      zona_id: 6, zona_nombre: 'Sur / Periferia', max_tareas_dia: 12
    },
  ]);

  // ═══════════ CLIENTES ═══════════
  private _clientes = signal<Cliente[]>([
    {
      id: 1, nombre: 'María Fernández Ruiz', nif: '12345678A',
      correo_electronico: 'maria.fernandez@gmail.com', telefono: '976112233',
      direccion: 'Calle Alfonso I, 15, 3ºB', ciudad: 'Zaragoza', codigo_postal: '50003',
      notas: 'Llamar antes de ir. Tiene perro.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Junkers Cerapur', ultima_revision: '2025-11-20',
      fecha_registro: '2026-05-19'
    },
    {
      id: 2, nombre: 'Pedro Jiménez Sánchez', nif: '87654321B',
      correo_electronico: 'pjimenez@hotmail.com', telefono: '976445566',
      direccion: 'Av. Goya, 42, 5ºA', ciudad: 'Zaragoza', codigo_postal: '50006',
      notas: 'Solo disponible por las mañanas.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Vaillant EcoTEC', ultima_revision: '2025-09-10',
      fecha_registro: '2026-05-19'
    },
    {
      id: 3, nombre: 'Carmen Ortiz Blasco', nif: '11223344C',
      correo_electronico: 'carmen.ortiz@yahoo.es', telefono: '976778899',
      direccion: 'Paseo Independencia, 8, 2ºD', ciudad: 'Zaragoza', codigo_postal: '50001',
      notas: '', activo: true,
      tipo_equipo: 'caldera_gasoil', marca_equipo: 'Ferroli Atlas', ultima_revision: '2024-12-05',
      fecha_registro: '2026-05-20'
    },
    {
      id: 4, nombre: 'José Antonio Millán', nif: '55667788D',
      correo_electronico: 'jamillan@gmail.com', telefono: '976223344',
      direccion: 'C/ San Miguel, 22, 1ºIzq', ciudad: 'Zaragoza', codigo_postal: '50001',
      notas: 'Portero automático no funciona, llamar al móvil.', activo: true,
      tipo_equipo: 'aerotermia', marca_equipo: 'Daikin Altherma', ultima_revision: '2025-06-15',
      fecha_registro: '2026-05-21'
    },
    {
      id: 5, nombre: 'Laura Pérez Domínguez', nif: '99887766E',
      correo_electronico: 'laura.perez@outlook.com', telefono: '976556677',
      direccion: 'C/ Delicias, 55, Bajo B', ciudad: 'Zaragoza', codigo_postal: '50017',
      notas: 'Caldera hace ruidos. Urgente.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Baxi Platinum', ultima_revision: '2025-01-22',
      fecha_registro: '2026-05-21'
    },
    {
      id: 6, nombre: 'Francisco Navarro Esteban', nif: '44556677F',
      correo_electronico: 'fnavarro@gmail.com', telefono: '976889900',
      direccion: 'Av. Cataluña, 102, 4ºC', ciudad: 'Zaragoza', codigo_postal: '50014',
      notas: '', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Saunier Duval Thelia', ultima_revision: '2025-03-18',
      fecha_registro: '2026-05-22'
    },
    {
      id: 7, nombre: 'Ana Belén Castro Ramos', nif: '33445566G',
      correo_electronico: 'abcastro@gmail.com', telefono: '976334455',
      direccion: 'C/ Tenor Fleta, 18, 6ºA', ciudad: 'Zaragoza', codigo_postal: '50007',
      notas: 'Tiene contrato de mantenimiento anual.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Junkers Ceraclass', ultima_revision: '2025-08-30',
      fecha_registro: '2026-05-22'
    },
    {
      id: 8, nombre: 'Roberto Lázaro Muñoz', nif: '22334455H',
      correo_electronico: 'rlazaro@hotmail.com', telefono: '976667788',
      direccion: 'C/ Corona de Aragón, 5, 3ºB', ciudad: 'Zaragoza', codigo_postal: '50009',
      notas: 'Instalación nueva. Montaje caldera.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Vaillant EcoTEC Plus', ultima_revision: undefined,
      fecha_registro: '2026-05-23'
    },
    {
      id: 9, nombre: 'Pilar Hernández Gómez', nif: '66778899I',
      correo_electronico: 'pilar.hg@gmail.com', telefono: '976112244',
      direccion: 'C/ Gran Vía, 30, 7ºD', ciudad: 'Zaragoza', codigo_postal: '50005',
      notas: 'No contesta al teléfono desde ayer.', activo: true,
      tipo_equipo: 'termo_electrico', marca_equipo: 'Ariston Pro Eco', ultima_revision: '2025-05-10',
      fecha_registro: '2026-05-18'
    },
    {
      id: 10, nombre: 'Ángel Martínez Soria', nif: '11229988J',
      correo_electronico: 'amartinez@yahoo.es', telefono: '976998877',
      direccion: 'Camino de las Torres, 88, 2ºA', ciudad: 'Zaragoza', codigo_postal: '50008',
      notas: '', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Ferroli Bluehelix', ultima_revision: '2025-10-02',
      fecha_registro: '2026-05-18'
    },
    {
      id: 11, nombre: 'Comunidad Prop. Edificio Sol', nif: 'H50123456',
      correo_electronico: 'admfincas.sol@gmail.com', telefono: '976445511',
      direccion: 'C/ Compromiso de Caspe, 12', ciudad: 'Zaragoza', codigo_postal: '50002',
      notas: 'Comunidad. Contactar con presidente: Sr. Ruiz 666123456', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Roca Victoria 20/20', ultima_revision: '2025-07-14',
      fecha_registro: '2026-05-20'
    },
    {
      id: 12, nombre: 'Elena Gracia Pardo', nif: '77889900K',
      correo_electronico: 'elena.gracia@gmail.com', telefono: '976223399',
      direccion: 'C/ Fernando el Católico, 60, 1ºD', ciudad: 'Zaragoza', codigo_postal: '50006',
      notas: 'Revisión anual. Todo OK la última vez.', activo: true,
      tipo_equipo: 'caldera_gas', marca_equipo: 'Vaillant TurboMAG', ultima_revision: '2024-11-28',
      fecha_registro: '2026-05-24'
    },
  ]);

  // ═══════════ TURNOS DE HOY ═══════════
  private _turnos = signal<Turno[]>([
    {
      id: 1,
      tecnico_id: 10,
      fecha: this.getToday(),
      tipo_turno: 'completo',
      notas_coordinador: 'Priorizar cliente 5 (urgente). Cliente 9 no contesta, intentar de nuevo.',
      tareas: [
        {
          id: 1, turno_id: 1, cliente_id: 1, orden: 1,
          tipo_servicio: 'gas', estado: 'completada',
          hora_estimada: '08:30', hora_inicio: '08:35', hora_fin: '09:20',
          duracion_estimada: 45,
          descripcion: 'Revisión anual caldera Junkers Cerapur', prioridad: 2,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:00',
          notas_confirmacion: 'Confirma sin problema', es_reserva: false
        },
        {
          id: 2, turno_id: 1, cliente_id: 5, orden: 2,
          tipo_servicio: 'gas', estado: 'en_curso',
          hora_estimada: '09:45', hora_inicio: '10:05', hora_fin: undefined,
          duracion_estimada: 60,
          descripcion: 'Caldera hace ruidos anormales. Posible fallo en ventilador.', prioridad: 1,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:15',
          notas_confirmacion: 'Urgente, confirma enseguida', es_reserva: false
        },
        {
          id: 3, turno_id: 1, cliente_id: 9, orden: 3,
          tipo_servicio: 'luz', estado: 'incidencia',
          hora_estimada: '11:00', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 30,
          descripcion: 'Revisión termo eléctrico.',
          incidencia: 'Cliente no contesta al teléfono. Intentado 3 veces.', prioridad: 2,
          confirmacion: 'no_contesta_dia', intentos_contacto: 3, hora_ultimo_intento: '07:20',
          notas_confirmacion: 'No contesta ni día anterior ni hoy. Se salta.', es_reserva: false
        },
        {
          id: 4, turno_id: 1, cliente_id: 6, orden: 4,
          tipo_servicio: 'gas', estado: 'pendiente',
          hora_estimada: '12:00', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 45,
          descripcion: 'Mantenimiento anual caldera Saunier Duval.', prioridad: 3,
          confirmacion: 'confirmado', intentos_contacto: 2, hora_ultimo_intento: '07:10',
          notas_confirmacion: 'No contestó ayer. Confirmó hoy a las 7:10.', es_reserva: false
        },
        // ═══ RESERVAS turno Miguel ═══
        {
          id: 20, turno_id: 1, cliente_id: 11, orden: 99,
          tipo_servicio: 'gas', estado: 'pendiente',
          hora_estimada: '', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 60,
          descripcion: 'Revisión caldera comunitaria.', prioridad: 3,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:30',
          notas_confirmacion: 'Presidente comunidad confirma acceso', es_reserva: true, posicion_reserva: 1
        },
        {
          id: 21, turno_id: 1, cliente_id: 10, orden: 99,
          tipo_servicio: 'gas', estado: 'pendiente',
          hora_estimada: '', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 30,
          descripcion: 'Revisión caldera Ferroli Bluehelix.', prioridad: 3,
          confirmacion: 'avisado', intentos_contacto: 1, hora_ultimo_intento: '18:45',
          notas_confirmacion: 'Llamado, dice que le viene bien cualquier hora', es_reserva: true, posicion_reserva: 2
        },
      ]
    },
    {
      id: 2,
      tecnico_id: 11,
      fecha: this.getToday(),
      tipo_turno: 'manana',
      notas_coordinador: 'Montaje nuevo en cliente 8. Llevar kit completo Vaillant.',
      tareas: [
        {
          id: 5, turno_id: 2, cliente_id: 8, orden: 1,
          tipo_servicio: 'clima', estado: 'en_curso',
          hora_estimada: '08:00', hora_inicio: '08:10', hora_fin: undefined,
          duracion_estimada: 180,
          descripcion: 'Montaje caldera Vaillant EcoTEC Plus. Instalación completa desde cero.', prioridad: 1,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '17:30',
          notas_confirmacion: 'Confirma. Estará en casa todo el día.', es_reserva: false
        },
        {
          id: 6, turno_id: 2, cliente_id: 4, orden: 2,
          tipo_servicio: 'clima', estado: 'pendiente',
          hora_estimada: '12:00', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 45,
          descripcion: 'Revisión sistema aerotermia Daikin.', prioridad: 2,
          confirmacion: 'no_contesta', intentos_contacto: 2, hora_ultimo_intento: '19:00',
          notas_confirmacion: 'No contesta ayer. Pendiente reintento hoy.', es_reserva: false
        },
        // ═══ RESERVA turno Andrés ═══
        {
          id: 22, turno_id: 2, cliente_id: 12, orden: 99,
          tipo_servicio: 'gas', estado: 'pendiente',
          hora_estimada: '', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 40,
          descripcion: 'Mantenimiento caldera Vaillant TurboMAG.', prioridad: 3,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:20',
          notas_confirmacion: 'Disponible si hay hueco', es_reserva: true, posicion_reserva: 1
        },
      ]
    },
    {
      id: 3,
      tecnico_id: 12,
      fecha: this.getToday(),
      tipo_turno: 'completo',
      notas_coordinador: 'Zona sur hoy. Ruta: Delicias → Utebo.',
      tareas: [
        {
          id: 7, turno_id: 3, cliente_id: 2, orden: 1,
          tipo_servicio: 'gas', estado: 'completada',
          hora_estimada: '08:30', hora_inicio: '08:30', hora_fin: '09:10',
          duracion_estimada: 40,
          descripcion: 'Mantenimiento caldera Vaillant EcoTEC.', prioridad: 2,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:00',
          notas_confirmacion: 'OK', es_reserva: false
        },
        {
          id: 8, turno_id: 3, cliente_id: 3, orden: 2,
          tipo_servicio: 'gas', estado: 'completada',
          hora_estimada: '09:30', hora_inicio: '09:40', hora_fin: '10:45',
          duracion_estimada: 60,
          descripcion: 'Reparación caldera gasoil. Sustituir quemador.', prioridad: 1,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:10',
          notas_confirmacion: 'Confirma', es_reserva: false
        },
        {
          id: 9, turno_id: 3, cliente_id: 7, orden: 3,
          tipo_servicio: 'gas', estado: 'en_curso',
          hora_estimada: '11:00', hora_inicio: '11:10', hora_fin: undefined,
          duracion_estimada: 45,
          descripcion: 'Revisión anual caldera Junkers. Contrato mantenimiento.', prioridad: 2,
          confirmacion: 'confirmado', intentos_contacto: 1, hora_ultimo_intento: '18:20',
          notas_confirmacion: 'Tiene contrato, siempre confirma', es_reserva: false
        },
        {
          id: 10, turno_id: 3, cliente_id: 10, orden: 4,
          tipo_servicio: 'luz', estado: 'pendiente',
          hora_estimada: '12:15', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 30,
          descripcion: 'Revisión caldera Ferroli Bluehelix.', prioridad: 3,
          confirmacion: 'avisado', intentos_contacto: 1, hora_ultimo_intento: '18:30',
          notas_confirmacion: 'Llamado, dice que cree que sí pero no seguro', es_reserva: false
        },
        {
          id: 11, turno_id: 3, cliente_id: 12, orden: 5,
          tipo_servicio: 'gas', estado: 'pendiente',
          hora_estimada: '13:00', hora_inicio: undefined, hora_fin: undefined,
          duracion_estimada: 40,
          descripcion: 'Mantenimiento caldera Vaillant TurboMAG.', prioridad: 3,
          confirmacion: 'sin_avisar', intentos_contacto: 0,
          notas_confirmacion: '', es_reserva: false
        },
      ]
    }
  ]);

  // ═══════════ GETTERS ═══════════
  readonly tecnicos = this._tecnicos.asReadonly();
  readonly clientes = this._clientes.asReadonly();
  readonly turnos = this._turnos.asReadonly();

  readonly itinerarios = computed<Itinerario[]>(() => {
    return this._tecnicos().map(tecnico => {
      const turno = this._turnos().find(t => t.tecnico_id === tecnico.id && t.fecha === this.getToday()) || null;
      const tareas = turno?.tareas || [];
      const total = tareas.length;

      // Generar paradas del itinerario con estado enriquecido
      const paradas: ParadaItinerario[] = tareas.map((tarea, idx) => {
        const cliente = this._clientes().find(c => c.id === tarea.cliente_id);

        // Mapear estado TareaTurno -> EstadoParada para datos mock
        let estado: EstadoParada = 'pendiente_aviso';
        if (tarea.estado === 'completada') estado = 'realizado';
        else if (tarea.estado === 'en_curso') estado = 'en_servicio';
        else if (tarea.estado === 'incidencia') estado = 'incidencia';
        else if (idx === 0 || tareas[idx - 1]?.estado === 'completada') {
          // Si el anterior está completado o es el primero, simula estados avanzados
          estado = 'confirmado';
        } else {
          estado = idx < 2 ? 'confirmado' : (idx < 3 ? 'avisado' : 'pendiente_aviso');
        }

        // Tiempo ruta estimado (mock: 8-20 min entre paradas)
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
          hora_aviso: estado !== 'pendiente_aviso' ? '18:00' : undefined,
          hora_confirmacion: ['confirmado', 'en_ruta', 'en_servicio', 'realizado'].includes(estado) ? '18:30' : undefined,
          hora_salida_anterior: tarea.hora_inicio ? this.subtractMinutes(tarea.hora_inicio, tiempoRuta) : undefined,
          hora_llegada: tarea.hora_inicio ? this.subtractMinutes(tarea.hora_inicio, 2) : undefined,
          hora_inicio_servicio: tarea.hora_inicio,
          hora_fin_servicio: tarea.hora_fin,
          notas_aviso: estado !== 'pendiente_aviso' ? 'Avisado dia anterior a las 18:00' : undefined,
          motivo_incidencia: tarea.incidencia,
          intentos_contacto: tarea.incidencia ? 3 : (estado === 'pendiente_aviso' ? 0 : 1),
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

  private subtractMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m - mins;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  }

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

  // ═══════════ ACCIONES ═══════════

  addCliente(cliente: Cliente): void {
    const current = this._clientes();
    const newId = Math.max(...current.map(c => c.id || 0)) + 1;
    this._clientes.set([...current, { ...cliente, id: newId, fecha_registro: this.getToday() }]);
  }

  updateCliente(id: number, data: Partial<Cliente>): void {
    this._clientes.update(list => list.map(c => c.id === id ? { ...c, ...data } : c));
  }

  deleteCliente(id: number): void {
    this._clientes.update(list => list.filter(c => c.id !== id));
  }

  // Crear un nuevo turno y devolver su ID
  crearTurno(turno: Omit<Turno, 'id'>): number {
    const current = this._turnos();
    const newId = Math.max(...current.map(t => t.id || 0), 0) + 1;
    this._turnos.set([...current, { ...turno, id: newId } as Turno]);
    return newId;
  }

  // Asignar cliente a un turno de un técnico
  addTareaToTurno(turnoId: number, tarea: TareaTurno): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareasNoReserva = t.tareas.filter(ta => !ta.es_reserva);
        const newOrden = tareasNoReserva.length + 1;
        return { ...t, tareas: [...t.tareas, { ...tarea, orden: newOrden, id: Date.now(), confirmacion: tarea.confirmacion || 'sin_avisar', intentos_contacto: 0, es_reserva: false }] };
      }
      return t;
    }));
  }

  // Quitar tarea de un turno
  removeTareaFromTurno(turnoId: number, tareaId: number): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.filter(ta => ta.id !== tareaId)
          .map((ta, i) => ({ ...ta, orden: i + 1 }));
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Cambiar estado de una tarea
  updateTareaEstado(turnoId: number, tareaId: number, estado: TareaTurno['estado'], incidencia?: string): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => {
          if (ta.id === tareaId) {
            const update: Partial<TareaTurno> = { estado };
            if (estado === 'en_curso') update.hora_inicio = ahora;
            if (estado === 'completada') update.hora_fin = ahora;
            if (estado === 'incidencia') update.incidencia = incidencia || 'Sin especificar';
            return { ...ta, ...update };
          }
          return ta;
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Reordenar tareas dentro de un turno
  reorderTareas(turnoId: number, tareaIds: number[]): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = tareaIds.map((id, i) => {
          const tarea = t.tareas.find(ta => ta.id === id)!;
          return { ...tarea, orden: i + 1 };
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Mover tarea de un técnico a otro
  moverTarea(fromTurnoId: number, toTurnoId: number, tareaId: number): void {
    let tarea: TareaTurno | undefined;
    this._turnos.update(turnos => {
      return turnos.map(t => {
        if (t.id === fromTurnoId) {
          tarea = t.tareas.find(ta => ta.id === tareaId);
          const tareas = t.tareas.filter(ta => ta.id !== tareaId).map((ta, i) => ({ ...ta, orden: i + 1 }));
          return { ...t, tareas };
        }
        if (t.id === toTurnoId && tarea) {
          const newOrden = t.tareas.length + 1;
          return { ...t, tareas: [...t.tareas, { ...tarea, orden: newOrden, turno_id: toTurnoId }] };
        }
        return t;
      });
    });
  }

  // Clientes sin asignar hoy
  getClientesSinAsignar(): Cliente[] {
    const asignados = new Set(
      this._turnos().flatMap(t => t.tareas.map(ta => ta.cliente_id))
    );
    return this._clientes().filter(c => c.activo && !asignados.has(c.id!));
  }

  // ═══════════ SISTEMA DE CONFIRMACIONES ═══════════

  // Obtener resumen de confirmaciones de un turno
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

  // Registrar intento de contacto
  registrarIntento(turnoId: number, tareaId: number, resultado: EstadoConfirmacion, nota?: string): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => {
          if (ta.id === tareaId) {
            return {
              ...ta,
              confirmacion: resultado,
              intentos_contacto: ta.intentos_contacto + 1,
              hora_ultimo_intento: ahora,
              notas_confirmacion: nota || ta.notas_confirmacion
            };
          }
          return ta;
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Promover reserva: un cliente de reserva sube a titular en la posición del que no confirmó
  promoverReserva(turnoId: number, tareaNoConfirmadaId: number): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareaFallida = t.tareas.find(ta => ta.id === tareaNoConfirmadaId);
        if (!tareaFallida) return t;

        // Buscar primera reserva confirmada
        const reservaDisponible = t.tareas
          .filter(ta => ta.es_reserva && (ta.confirmacion === 'confirmado' || ta.confirmacion === 'avisado'))
          .sort((a, b) => (a.posicion_reserva || 99) - (b.posicion_reserva || 99))[0];

        if (!reservaDisponible) return t;

        const tareas = t.tareas.map(ta => {
          // Marcar la tarea fallida como cancelada/saltada
          if (ta.id === tareaNoConfirmadaId) {
            return { ...ta, estado: 'cancelada' as const, confirmacion: 'no_contesta_dia' as EstadoConfirmacion };
          }
          // Promover la reserva: pasa a titular con el horario del que falló
          if (ta.id === reservaDisponible.id) {
            return {
              ...ta,
              es_reserva: false,
              posicion_reserva: undefined,
              promovido_desde_reserva: true,
              confirmacion: 'promovido' as EstadoConfirmacion,
              orden: tareaFallida.orden,
              hora_estimada: tareaFallida.hora_estimada,
            };
          }
          return ta;
        });

        // Reordenar reservas restantes
        let reservaOrden = 1;
        const tareasFinales = tareas.map(ta => {
          if (ta.es_reserva) {
            return { ...ta, posicion_reserva: reservaOrden++ };
          }
          return ta;
        });

        return { ...t, tareas: tareasFinales };
      }
      return t;
    }));
  }

  // Añadir cliente como reserva a un turno
  addReserva(turnoId: number, tarea: TareaTurno): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const reservasActuales = t.tareas.filter(ta => ta.es_reserva).length;
        return {
          ...t,
          tareas: [...t.tareas, {
            ...tarea,
            es_reserva: true,
            posicion_reserva: reservasActuales + 1,
            orden: 99,
            id: Date.now(),
            confirmacion: 'sin_avisar' as EstadoConfirmacion,
            intentos_contacto: 0
          }]
        };
      }
      return t;
    }));
  }

  // Quitar reserva
  removeReserva(turnoId: number, tareaId: number): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.filter(ta => ta.id !== tareaId);
        // Reordenar reservas
        let reservaOrden = 1;
        const tareasFinales = tareas.map(ta => {
          if (ta.es_reserva) return { ...ta, posicion_reserva: reservaOrden++ };
          return ta;
        });
        return { ...t, tareas: tareasFinales };
      }
      return t;
    }));
  }

  // ═══════════ ITINERARIO STATE MANAGEMENT ═══════════
  // Avisar a un cliente (día anterior)
  avisarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => ta.id === tareaId ? { ...ta } : ta);
        return { ...t, tareas };
      }
      return t;
    }));
    // Nota: el estado de parada se recalcula en itinerarios computed
    // Aquí actualizamos la tarea para que el computed detecte cambio
    this.updateParadaData(turnoId, tareaId, { estado_aviso: 'avisado', hora_aviso: ahora });
  }

  // Confirmar cita de un cliente
  confirmarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.updateParadaData(turnoId, tareaId, { estado_aviso: 'confirmado', hora_confirmacion: ahora });
  }

  // Marcar en ruta (técnico sale hacia cliente)
  iniciarRutaParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.updateParadaData(turnoId, tareaId, { estado_aviso: 'en_ruta', hora_salida: ahora });
  }

  // Llegar al cliente y comenzar servicio
  iniciarServicioParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => {
          if (ta.id === tareaId) return { ...ta, estado: 'en_curso' as const, hora_inicio: ahora };
          return ta;
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Completar servicio (realizado)
  completarParada(turnoId: number, tareaId: number): void {
    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => {
          if (ta.id === tareaId) return { ...ta, estado: 'completada' as const, hora_fin: ahora };
          return ta;
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Reportar incidencia en parada
  incidenciaParada(turnoId: number, tareaId: number, motivo: string): void {
    this._turnos.update(turnos => turnos.map(t => {
      if (t.id === turnoId) {
        const tareas = t.tareas.map(ta => {
          if (ta.id === tareaId) return { ...ta, estado: 'incidencia' as const, incidencia: motivo };
          return ta;
        });
        return { ...t, tareas };
      }
      return t;
    }));
  }

  // Helper interno para datos adicionales de parada en signal separado
  private _paradaExtras = signal<Record<string, any>>({});

  updateParadaData(turnoId: number, tareaId: number, data: any): void {
    const key = `${turnoId}_${tareaId}`;
    this._paradaExtras.update(extras => ({ ...extras, [key]: { ...(extras[key] || {}), ...data } }));
  }

  getParadaExtra(turnoId: number, tareaId: number): any {
    return this._paradaExtras()[`${turnoId}_${tareaId}`] || {};
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }
}
