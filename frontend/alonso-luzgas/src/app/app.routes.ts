import { Routes } from '@angular/router';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then(m => m.Home)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin/dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./pages/admin/clientes/clientes').then(m => m.Clientes)
      },
      {
        path: 'citas',
        loadComponent: () => import('./pages/admin/citas/citas').then(m => m.Citas)
      },
      {
        path: 'turnos',
        loadComponent: () => import('./pages/admin/turnos/turnos').then(m => m.Turnos)
      },
      {
        path: 'itinerario',
        loadComponent: () => import('./pages/admin/itinerario/itinerario').then(m => m.Itinerario)
      }
    ]
  },
  {
    path: 'tecnico',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tecnico/tecnico').then(m => m.TecnicoPage)
  },
  { path: '**', redirectTo: '' }
];
