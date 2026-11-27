# ProyecTIC

Aplicación web tipo Kanban, minimalista, para equipos pequeños. Proyecto de la asignatura **Sistemas Web I** (Universidad CEU San Pablo, curso 2026).

## Equipo

- Álvaro Sánchez Mateos
- Íñigo González Gámez
- Adriana Ramírez Medina
- Vega Yebra Hernández

## Qué hace

- Cada proyecto es un **tablero** con columnas (por defecto Pendiente, En Proceso y Terminado), que el administrador puede añadir, renombrar, reordenar y eliminar.
- Cada tarea es una **tarjeta** que se mueve entre columnas arrastrándola (drag & drop).
- Los cambios se ven **en tiempo real** para todos los miembros que tengan abierto el tablero.
- Solo ves los tableros a los que te han invitado. Cada miembro tiene un **rol** en cada tablero:
  - **Invitado**: solo lectura.
  - **Colaborador**: crea, edita, mueve y borra tarjetas, y comenta.
  - **Administrador** (quien crea el tablero): además invita miembros, cambia sus roles, gestiona las columnas y puede borrar el tablero.


## Cómo arrancarlo

**Requisitos:** Node.js 20.17 o superior (probado con Node 24) y npm.

1. Clonar el repositorio y entrar en la carpeta de la aplicación:

   ```
   git clone https://github.com/alvaroceu/ProyecTIC.git
   cd ProyecTIC/app
   ```

2. Instalar las dependencias:

   ```
   npm install
   ```

3. Crear el archivo `.env` a partir de la plantilla `.env_ex`:

   ```
   cp .env_ex .env
   ```

   En Windows (cmd): `copy .env_ex .env`.

4. Generar un secreto de sesión y pegarlo en `.env` como valor de `SESSION_SECRET`:

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   El archivo queda así:

   ```
   PORT=3000
   SESSION_SECRET=<el valor generado>
   ```

5. Arrancar el servidor (siempre desde la carpeta `app/`):

   ```
   npm start
   ```

6. Abrir http://localhost:3000, registrarse y crear un tablero.

## Notas

- **Base de datos:** se crea sola al arrancar, en `app/proyectic.sqlite`. Para empezar de cero, para el servidor y borra ese archivo.
- **Sesiones:** se guardan en memoria, así que al reiniciar el servidor hay que volver a iniciar sesión.
- **Tiempo real:** para verlo, abre el mismo tablero con dos usuarios a la vez (por ejemplo, uno en una ventana normal y otro en una de incógnito).
- **No se suben al repositorio** `node_modules/`, `.env` ni la base de datos (`*.sqlite`).
- `npm install` puede avisar de 2 vulnerabilidades moderadas en `uuid` (una dependencia interna de Sequelize). No afectan a la aplicación. **No ejecutes `npm audit fix --force`**: bajaría Sequelize a una versión antigua incompatible.

## Estructura

```
ProyecTIC/
├── docs/                 Especificación, sitemap, wireframes y maqueta estática del front-end
└── app/                  Aplicación
    ├── bin/www           Arranca el servidor HTTP y Socket.IO
    ├── app.js            Configuración de Express: middlewares y rutas
    ├── config/           Sesión y constantes de contraseñas
    ├── database/         Conexión con Sequelize y modelos
    ├── middlewares/      Autenticación
    ├── routes/           Rutas
    ├── sockets/          Tiempo real (Socket.IO)
    ├── views/            Vistas EJS
    └── public/           CSS, JavaScript del navegador e imágenes
```
