import { Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { DataService } from '../../../services/data.service';
import { ImportService } from '../../../services/import.service';
import { ApiService } from '../../../services/api';
import { Cliente } from '../../../models/interfaces';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './clientes.html',
  styleUrls: ['./clientes.scss'],
})
export class Clientes {
  private dataService = inject(DataService);
  private importService = inject(ImportService);
  private apiService = inject(ApiService);
  authService = inject(AuthService);

  busqueda = signal('');
  zonaFiltro = signal<string>('todas');
  showForm = signal(false);
  editingCliente = signal<Cliente | null>(null);
  dragOver = signal(false);
  importStatus = signal<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  importedCount = signal(0);

  // Zonas disponibles (por ciudad)
  readonly ZONAS = [
    { value: 'todas', label: 'Todas las zonas' },
    { value: 'zaragoza', label: 'Zaragoza' },
    { value: 'huesca', label: 'Huesca' },
    { value: 'pamplona', label: 'Pamplona' },
  ];

  // Clientes ordenados por fecha_registro (más recientes primero)
  clientesOrdenados = computed(() => {
    const q = this.busqueda().toLowerCase();
    const zona = this.zonaFiltro();
    let lista = this.dataService.clientes();

    // Filtro por zona/ciudad
    if (zona !== 'todas') {
      lista = lista.filter(c => c.ciudad.toLowerCase().includes(zona));
    }

    // Filtro por búsqueda
    if (q) {
      lista = lista.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.correo_electronico.toLowerCase().includes(q) ||
        c.telefono.includes(q) ||
        c.direccion.toLowerCase().includes(q) ||
        c.ciudad.toLowerCase().includes(q) ||
        c.nif.toLowerCase().includes(q)
      );
    }
    return [...lista].sort((a, b) => {
      const fa = a.fecha_registro || '1970-01-01';
      const fb = b.fecha_registro || '1970-01-01';
      return fb.localeCompare(fa); // Más reciente primero
    });
  });

  totalClientes = computed(() => this.dataService.clientes().length);

  form: Cliente = this.emptyCliente();

  openNew(): void {
    this.form = this.emptyCliente();
    this.editingCliente.set(null);
    this.showForm.set(true);
  }

  edit(cliente: Cliente): void {
    this.form = { ...cliente };
    this.editingCliente.set(cliente);
    this.showForm.set(true);
  }

  save(): void {
    if (this.editingCliente()) {
      this.dataService.updateCliente(this.form.id!, this.form);
    } else {
      this.dataService.addCliente(this.form);
    }
    this.showForm.set(false);
  }

  delete(id: number): void {
    if (confirm('¿Eliminar este cliente?')) {
      this.dataService.deleteCliente(id);
    }
  }

  cancel(): void {
    this.showForm.set(false);
  }

  // ══════ EXCEL DRAG & DROP ══════
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      this.importStatus.set({ message: `Formato no soportado (${ext}). Usa .xlsx, .xls o .csv`, type: 'error' });
      return;
    }

    this.processFile(file);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.processFile(input.files[0]);
    input.value = ''; // Reset para permitir re-selección
  }

  private processFile(file: File): void {
    this.importStatus.set({ message: `Procesando "${file.name}"...`, type: 'info' });

    const reader = new FileReader();
    reader.onload = () => {
      const contenido = reader.result as string;
      const filas = this.importService.parseCsv(contenido);

      if (filas.length === 0) {
        this.importStatus.set({ message: 'El archivo no contiene datos válidos', type: 'error' });
        return;
      }

      // Enviar al backend real
      this.importService.importar(filas).subscribe({
        next: (resultado) => {
          this.importedCount.set(resultado.clientes_creados);
          this.importStatus.set({
            message: `✓ ${resultado.clientes_creados} clientes nuevos, ${resultado.clientes_actualizados} actualizados desde "${file.name}"`,
            type: 'success'
          });
          // Los datos se refrescan automáticamente vía signals en DataService
          setTimeout(() => this.importStatus.set(null), 5000);
        },
        error: (err) => {
          console.error('Error importando:', err);
          this.importStatus.set({ message: `Error al importar: ${err.message || 'Error de conexión'}`, type: 'error' });
        }
      });
    };
    reader.readAsText(file, 'UTF-8');
  }

  dismissImport(): void {
    this.importStatus.set(null);
  }

  // ══════ RESET ══════
  resetTodo(): void {
    if (!confirm('¿Borrar TODOS los clientes, turnos y asignaciones? Esta acción no se puede deshacer.')) return;
    this.apiService.resetDatos().subscribe({
      next: (res) => {
        this.importStatus.set({ message: `✓ ${res.message || 'Datos eliminados correctamente'}`, type: 'success' });
        this.dataService.cargarTodo();
        setTimeout(() => this.importStatus.set(null), 4000);
      },
      error: (err) => {
        this.importStatus.set({ message: `Error al borrar: ${err.message || 'Error de conexión'}`, type: 'error' });
      }
    });
  }

  // ══════ HELPERS ══════
  getTipoLabel(tipo: string): string {
    const labels: Record<string, string> = {
      caldera_gas: 'Caldera Gas',
      caldera_gasoil: 'Caldera Gasoil',
      termo_electrico: 'Termo Eléctrico',
      aerotermia: 'Aerotermia',
      osmosis: 'Ósmosis',
      descalcificador: 'Descalcificador',
      ozono: 'Ozono',
      clima: 'Aire Acondicionado',
      fotovoltaica: 'Fotovoltaica',
      otro: 'Otro'
    };
    return labels[tipo] || tipo;
  }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      caldera_gas: 'tipo--gas',
      caldera_gasoil: 'tipo--gasoil',
      termo_electrico: 'tipo--electrico',
      aerotermia: 'tipo--aerotermia',
      osmosis: 'tipo--osmosis',
      descalcificador: 'tipo--descal',
      ozono: 'tipo--ozono',
      clima: 'tipo--clima',
      fotovoltaica: 'tipo--fotovoltaica',
      otro: 'tipo--otro'
    };
    return map[tipo] || 'tipo--otro';
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private emptyCliente(): Cliente {
    return {
      nombre: '',
      nif: '',
      correo_electronico: '',
      telefono: '',
      direccion: '',
      ciudad: 'Zaragoza',
      codigo_postal: '',
      notas: '',
      activo: true,
      tipo_equipo: 'caldera_gas',
      marca_equipo: '',
    };
  }

  logout(): void {
    this.authService.logout();
  }
}
