import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cliente, Turno, TareaTurno, Usuario, Itinerario } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly API_URL = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  // Clientes
  getClientes(params?: { activo?: boolean; buscar?: string }): Observable<Cliente[]> {
    let httpParams = new HttpParams();
    if (params?.activo !== undefined) httpParams = httpParams.set('activo', String(params.activo));
    if (params?.buscar) httpParams = httpParams.set('buscar', params.buscar);
    return this.http.get<Cliente[]>(`${this.API_URL}/clientes/`, { params: httpParams });
  }

  getCliente(id: number): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.API_URL}/clientes/${id}/`);
  }

  createCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(`${this.API_URL}/clientes/`, cliente);
  }

  updateCliente(id: number, cliente: Partial<Cliente>): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.API_URL}/clientes/${id}/`, cliente);
  }

  deleteCliente(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/clientes/${id}/`);
  }

  // Tareas
  getTareas(params?: { estado?: string; tecnico?: number; fecha?: string }): Observable<TareaTurno[]> {
    let httpParams = new HttpParams();
    if (params?.estado) httpParams = httpParams.set('estado', params.estado);
    if (params?.tecnico) httpParams = httpParams.set('tecnico', String(params.tecnico));
    if (params?.fecha) httpParams = httpParams.set('fecha', params.fecha);
    return this.http.get<TareaTurno[]>(`${this.API_URL}/tareas/`, { params: httpParams });
  }

  updateTarea(id: number, tarea: Partial<TareaTurno>): Observable<TareaTurno> {
    return this.http.patch<TareaTurno>(`${this.API_URL}/tareas/${id}/`, tarea);
  }

  deleteTarea(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/tareas/${id}/`);
  }

  // Turnos
  getTurnos(params?: { tecnico?: number; fecha?: string }): Observable<Turno[]> {
    let httpParams = new HttpParams();
    if (params?.tecnico) httpParams = httpParams.set('tecnico', String(params.tecnico));
    if (params?.fecha) httpParams = httpParams.set('fecha', params.fecha);
    return this.http.get<Turno[]>(`${this.API_URL}/turnos/`, { params: httpParams });
  }

  createTurno(turno: Turno): Observable<Turno> {
    return this.http.post<Turno>(`${this.API_URL}/turnos/`, turno);
  }

  updateTurno(id: number, turno: Partial<Turno>): Observable<Turno> {
    return this.http.patch<Turno>(`${this.API_URL}/turnos/${id}/`, turno);
  }

  deleteTurno(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/turnos/${id}/`);
  }

  // Usuarios
  getUsuarios(rol?: string): Observable<Usuario[]> {
    let httpParams = new HttpParams();
    if (rol) httpParams = httpParams.set('rol', rol);
    return this.http.get<Usuario[]>(`${this.API_URL}/usuarios/`, { params: httpParams });
  }

  // Itinerario
  getItinerario(tecnicoId: number, fecha?: string): Observable<Itinerario> {
    let httpParams = new HttpParams();
    if (fecha) httpParams = httpParams.set('fecha', fecha);
    return this.http.get<Itinerario>(`${this.API_URL}/itinerario/${tecnicoId}/`, { params: httpParams });
  }

  // Importar CSV
  importarCsv(filas: any[]): Observable<any> {
    return this.http.post(`${this.API_URL}/importar/`, { filas });
  }

  // Reset - borrar todos los datos
  resetDatos(): Observable<any> {
    return this.http.post(`${this.API_URL}/reset/`, {});
  }
}
