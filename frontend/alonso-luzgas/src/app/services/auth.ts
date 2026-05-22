import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, of, throwError } from 'rxjs';
import { Usuario, LoginResponse } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = 'http://localhost:8000/api/auth';
  
  private currentUser = signal<Usuario | null>(null);
  
  readonly user = this.currentUser.asReadonly();
  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly isCoordinador = computed(() => this.currentUser()?.rol === 'coordinador');
  readonly isTecnico = computed(() => this.currentUser()?.rol === 'tecnico');

  // Usuario hardcodeado para desarrollo
  private readonly HARDCODED_USER: Usuario = {
    id: 1,
    username: 'jonathanadmin',
    first_name: 'Jonathan',
    last_name: 'Admin',
    email: 'jonathan@alonsoluzgas.es',
    rol: 'coordinador',
    telefono: '663302000'
  };

  // Técnicos para login de desarrollo
  private readonly HARDCODED_TECNICOS: Record<string, Usuario> = {
    'miguel': {
      id: 10,
      username: 'mgarcia',
      first_name: 'Miguel',
      last_name: 'García López',
      email: 'miguel@alonsoluzgas.es',
      rol: 'tecnico',
      telefono: '666111222'
    },
    'andres': {
      id: 11,
      username: 'alopez',
      first_name: 'Andrés',
      last_name: 'López Martín',
      email: 'andres@alonsoluzgas.es',
      rol: 'tecnico',
      telefono: '666333444'
    },
    'pablo': {
      id: 12,
      username: 'pserrano',
      first_name: 'Pablo',
      last_name: 'Serrano Gil',
      email: 'pablo@alonsoluzgas.es',
      rol: 'tecnico',
      telefono: '666555666'
    },
  };

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      this.currentUser.set(JSON.parse(userData));
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    // Login hardcodeado sin backend
    // Coordinador
    if (username === 'jonathanadmin' && password === '123') {
      const response: LoginResponse = {
        token: 'hardcoded-dev-token-12345',
        user: this.HARDCODED_USER
      };
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      this.currentUser.set(response.user);
      return of(response);
    }

    // Técnicos (login con nombre: miguel/123, andres/123, pablo/123)
    const tecnico = this.HARDCODED_TECNICOS[username.toLowerCase()];
    if (tecnico && password === '123') {
      const response: LoginResponse = {
        token: `hardcoded-tech-token-${tecnico.id}`,
        user: tecnico
      };
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_data', JSON.stringify(response.user));
      this.currentUser.set(response.user);
      return of(response);
    }
    
    return throwError(() => ({ error: { detail: 'Credenciales incorrectas' } }));
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
