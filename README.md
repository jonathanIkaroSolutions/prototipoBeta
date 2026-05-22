# Prototipo Beta - Alonso Luz&Gas

## Descripción
Prototipo de gestión interna para la empresa **Alonso Luz&Gas** (https://alonsoluzgas.es/).  
Incluye una home pública y un panel de administración para coordinar citas y técnicos.

## Estructura del proyecto

```
prototipoBeta/
├── backend/          # Django REST API
│   ├── core/         # Settings y configuración
│   ├── api/          # App con modelos, vistas, serializers
│   └── manage.py
├── frontend/         # Angular 19 (standalone components)
│   └── alonso-luzgas/
│       └── src/app/
│           ├── pages/home/          # Home pública
│           ├── pages/login/         # Login
│           ├── pages/admin/         # Panel de administración
│           │   ├── dashboard/       # Dashboard con estadísticas
│           │   ├── clientes/        # CRUD de clientes
│           │   ├── citas/           # Gestión de citas
│           │   ├── turnos/          # Turnos de técnicos
│           │   └── itinerario/      # Itinerario diario
│           ├── services/            # Servicios (Auth, API)
│           ├── guards/              # Auth guard
│           ├── interceptors/        # HTTP interceptor
│           └── models/              # Interfaces TypeScript
└── .venv/            # Virtual environment Python
```

## Funcionalidades

### Home pública
- Landing page inspirada en alonsoluzgas.es
- Secciones: Servicios, Por qué elegirnos, Contacto
- Acceso al panel de administración

### Panel de Administración
- **Login**: Autenticación con token
- **Dashboard**: Estadísticas generales
- **Clientes**: CRUD completo (nombre, NIF, email, dirección, teléfono)
- **Citas**: Gestión de citas con asignación de técnicos y estados
- **Turnos**: Asignación de turnos a técnicos (mañana/tarde/completo)
- **Itinerario**: Vista del itinerario diario de cada técnico

### Roles
- **Coordinador**: Gestiona citas, asigna técnicos, crea itinerarios
- **Técnico**: Visualiza su itinerario y citas asignadas

## Cómo ejecutar

### Backend (Django)
```bash
cd backend
# Activar entorno virtual
..\.venv\Scripts\activate   # Windows
# Ejecutar servidor
python manage.py runserver
```

### Frontend (Angular)
```bash
cd frontend/alonso-luzgas
ng serve
```

### Acceso
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

### Credenciales de prueba
- **Usuario**: admin
- **Contraseña**: admin123
- **Rol**: Coordinador

## Tecnologías
- **Backend**: Python 3.11+, Django 6, Django REST Framework
- **Frontend**: Angular 19 (standalone), TypeScript, SCSS
- **Base de datos**: SQLite (desarrollo)
- **Autenticación**: Token-based (DRF TokenAuthentication)

## Design Tokens
El proyecto usa un sistema de variables CSS con dos niveles:
- **Primitivas**: Colores, espaciado, tipografía base
- **Semánticas**: Uso contextual (primary, surface, text, etc.)

Definidas en `frontend/alonso-luzgas/src/styles.scss`
