import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DataService } from './data.service';
import { Observable, tap } from 'rxjs';

export interface FilaImportacion {
  nombre_cliente: string;
  nif: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  codigo_postal: string;
  zona: string;
  tipo_equipo: string;
  marca_equipo: string;
  tipo_servicio: string;
  fecha_programada: string;
  hora_estimada: string;
  duracion_estimada: number;
  prioridad: number;
  descripcion: string;
  es_reserva: boolean;
  notas: string;
}

export interface ResultadoImportacion {
  clientes_creados: number;
  clientes_actualizados: number;
  errores: string[];
  resumen_por_zona: { zona_id: number; zona: string; clientes_importados: number }[];
  clientes_sin_zona: number;
}

export interface ResultadoGeneracion {
  tareas_asignadas: number;
  turnos_creados: number;
  reservas_creadas: number;
  errores: string[];
  resumen_por_tecnico: { tecnico_id: number; tecnico: string; zona: string; tareas: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class ImportService {
  private http = inject(HttpClient);
  private dataService = inject(DataService);
  private readonly API_URL = 'http://localhost:8000/api';

  /**
   * Parsea un archivo CSV con separador ; y devuelve las filas
   */
  parseCsv(contenido: string): FilaImportacion[] {
    const lineas = contenido.split('\n').filter(l => l.trim());
    if (lineas.length < 2) return [];

    const cabecera = lineas[0].split(';').map(h => h.trim());
    const filas: FilaImportacion[] = [];

    for (let i = 1; i < lineas.length; i++) {
      const valores = lineas[i].split(';').map(v => v.trim());
      if (valores.length < cabecera.length) continue;

      const fila: any = {};
      cabecera.forEach((col, idx) => {
        fila[col] = valores[idx] || '';
      });

      filas.push({
        nombre_cliente: fila['nombre_cliente'] || '',
        nif: fila['nif'] || '',
        telefono: fila['telefono'] || '',
        email: fila['email'] || '',
        direccion: fila['direccion'] || '',
        ciudad: fila['ciudad'] || '',
        codigo_postal: fila['codigo_postal'] || '',
        zona: fila['zona'] || '',
        tipo_equipo: fila['tipo_equipo'] || 'caldera_gas',
        marca_equipo: fila['marca_equipo'] || '',
        tipo_servicio: fila['tipo_servicio'] || 'gas',
        fecha_programada: fila['fecha_programada'] || '',
        hora_estimada: fila['hora_estimada'] || '09:00',
        duracion_estimada: parseInt(fila['duracion_estimada']) || 45,
        prioridad: parseInt(fila['prioridad']) || 2,
        descripcion: fila['descripcion'] || '',
        es_reserva: fila['es_reserva'] === 'true',
        notas: fila['notas'] || '',
      });
    }

    return filas;
  }

  /**
   * PASO 1: Envía las filas al backend para importar clientes.
   * Solo crea/actualiza clientes y detecta su zona por CP.
   * NO genera turnos aún.
   */
  importar(filas: FilaImportacion[]): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(`${this.API_URL}/importar/`, { filas }).pipe(
      tap(() => {
        this.dataService.cargarClientes();
      })
    );
  }

  /**
   * PASO 2: Genera turnos para una zona con los técnicos asignados.
   * El coordinador elige zona, técnicos y fecha de inicio.
   */
  generarTurnos(zonaId: number, tecnicoIds: number[], fechaInicio: string): Observable<ResultadoGeneracion> {
    return this.http.post<ResultadoGeneracion>(`${this.API_URL}/generar-turnos/`, {
      zona_id: zonaId,
      tecnico_ids: tecnicoIds,
      fecha_inicio: fechaInicio,
    }).pipe(
      tap(() => {
        this.dataService.cargarTurnos();
        this.dataService.cargarTecnicos();
      })
    );
  }
}
