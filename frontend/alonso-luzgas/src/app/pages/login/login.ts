import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class Login {
  username = '';
  password = '';
  error = signal('');
  loading = signal(false);

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.loading.set(true);
    this.error.set('');
    
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        // Redirigir según el rol
        if (response.user.rol === 'tecnico') {
          this.router.navigate(['/tecnico']);
        } else {
          this.router.navigate(['/admin']);
        }
      },
      error: () => {
        this.error.set('Usuario o contraseña incorrectos');
        this.loading.set(false);
      }
    });
  }
}
