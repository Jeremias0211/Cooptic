# Decisiones de diseño · Etapa 6

Respuesta a cada punto de la consigna "Diseño del sistema".

## 1. Funciones indispensables de la primera versión

Se tomaron las historias de usuario de la Parte 3 y el recorrido de los wireframes
(ingresar → panel → nuevo préstamo → registrar devolución):

- Registrar préstamo con persona, elemento, cantidad, fecha límite y estado al prestar.
- Registrar devolución con estado (bueno, dañado, perdido); el stock se actualiza solo.
- Alumno: ver sus préstamos pendientes y fecha límite.
- Docente: consultar disponibilidad antes de la clase y solicitar herramientas.
- Administrador: alta de herramientas con categoría y cantidad; reporte de más prestadas y stock bajo.

Se agregaron, porque los piden las otras actividades: incidencias y reposición (Parte 3, tabla de datos),
reportes (Parte 4, investigación), tablero de KPI y tareas de las comisiones (Actividad KPI)
y actas de reuniones (Reglamento, Capítulo VI).

## 2 y 3. Proyecto y pantallas

Proyecto Vue 3 + Vite + Vue Router, sin TypeScript ni Pinia. Organización en `views/`,
`components/`, `services/`, `store/`, `utils/` y `data/` (ver README). Las pantallas siguen el
recorrido de los wireframes: el pañolero entra, ve activos y vencidos en el panel, toca
"Nuevo préstamo" y luego "Devolución".

## 4. Navegación y roles

Cada ruta declara el permiso que necesita (`router/index.js`) y el menú muestra solo las secciones
del rol (`services/permisos.js`). **En el modo demo los cuatro roles están simulados**: se elige un
usuario de prueba sin contraseña, y el aviso amarillo de arriba lo indica en todas las pantallas.

## 5. Formularios y validación

`utils/validar.js` controla campos obligatorios, formatos (DNI de 7-8 números, código `H-001`,
código de integrante `I-01`) y valores permitidos (cantidad entre 1 y lo disponible, fecha de
devolución no anterior a hoy y máximo 60 días, estados de una lista). Los errores aparecen debajo
de cada campo. La base de datos repite estas reglas con `check` y en las funciones SQL.

## 6. Datos de prueba

`src/data/datosPrueba.js` y `supabase/seed.sql` tienen personas y movimientos ficticios.
Cada listado muestra la etiqueta "Datos de prueba" en modo demo.

## 7. Celular y computadora

Diseño adaptable: menú desplegable en celular, tablas que se transforman en tarjetas,
formularios a una columna, botones de al menos 42 px de alto y estados siempre con texto
(no solo color).

## 8. Registro, consulta, modificación y cancelación

| Registro | Alta | Modificación | Eliminación |
|---|---|---|---|
| Préstamos | ✔ | devolución | **Cancelación** con motivo (no se borra: historial confiable) |
| Herramientas | ✔ | ✔ | **Baja lógica** (`activo = false`), conserva su historial |
| Usuarios | ✔ | rol, curso, activo | **Desactivar** |
| Talleres y categorías | ✔ | ✔ | Desactivar |
| Solicitudes | ✔ | atender / rechazar | Cancelar |
| Pedidos de alumnos | ✔ (alumno) | autorizar / rechazar (docente), entregar (pañol) | Cancelar (alumno) |
| Autorizaciones de clase | ✔ (docente) | — | Cancelar |
| Incidencias | ✔ | resolver | no se borran |
| Tareas y actas | ✔ | ✔ | tareas: cancelar |

En la base de datos no existe ninguna política de DELETE, así que nada se puede borrar desde la app.

## 9. Búsquedas, filtros y estados

Búsqueda por texto (ignora tildes y mayúsculas) y filtros por estado, curso, categoría, taller,
disponibilidad, tipo, comisión y período. Estados: préstamo activo/vencido/devuelto/cancelado
("vencido" se calcula comparando la fecha límite con hoy), stock disponible/bajo/sin stock,
solicitudes pendiente/atendida/rechazada/cancelada, pedidos de alumnos esperando autorización/autorizada/retirada/rechazada/vencida/cancelada ("vencida" se calcula: pasaron 48 h desde la autorización), reposición pendiente/aprobada/recibida/rechazada,
incidencia abierta/resuelta, tarea pendiente/atrasada/completada/cancelada.

## 10. Qué se conserva y qué se comparte

- **Se conserva y se comparte entre usuarios y dispositivos:** inventario, préstamos, devoluciones,
  incidencias, solicitudes, reposiciones, usuarios, tareas y actas. El pañolero registra desde una
  computadora y el alumno consulta desde su celular: todos deben ver lo mismo.
- **Solo en el dispositivo:** la sesión iniciada (token de Supabase en el navegador).
- **No se guarda:** filtros y búsquedas de las pantallas.

## 11. ¿Hace falta backend?

Sí. Varios usuarios en distintos dispositivos comparten los mismos datos, las contraseñas deben
guardarse cifradas y los permisos deben aplicarse aunque alguien modifique la página.
Se usa **Supabase** como backend (PostgreSQL + Auth + políticas RLS), sin programar un servidor propio.

El **modo demo** funciona sin backend: guarda todo en `localStorage`. Limitaciones:
los datos quedan solo en ese navegador, no los ven otras personas, se pierden al borrar el navegador,
no hay contraseñas y los permisos solo se controlan en el código del cliente.

## 12. Tablas, claves y relaciones

- `talleres` (1) → (N) `herramientas`, `perfiles`
- `categorias` (1) → (N) `herramientas`
- `perfiles` (id = `auth.users.id`) (1) → (N) `prestamos` como persona y como pañolero
- `herramientas` (1) → (N) `prestamos`, `incidencias`, `solicitudes_prestamo`, `solicitudes_reposicion`
- `prestamos` (1) → (0..1) `devoluciones` (`prestamo_id` único)
- `prestamos` (1) → (N) `incidencias`
- `solicitudes_prestamo` (1) ↔ (0..1) `prestamos` (cuando se atiende o se retira)
- `solicitudes_prestamo.alumno_id` → `perfiles`: pedido de un alumno (vacío = pedido de docente); `autorizado_por` → docente que respondió
- `autorizaciones_clase` (1) → (N) `prestamos` (`autorizacion_clase_id`; un retiro por alumno)
- `tareas` y `actas` son independientes (usan códigos I-01 en lugar de nombres)

Claves primarias numéricas autoincrementales; `perfiles` usa el UUID de la cuenta.
Únicos: código de herramienta, DNI, número de préstamo, nombre de taller y de categoría.

## 13. Script SQL

`supabase/schema.sql` crea todo y se puede volver a ejecutar. `supabase/seed.sql` carga los registros simulados.
Ambos se probaron en PostgreSQL 16 simulando el entorno de Supabase.

## 14. Conexión con Supabase

`services/api.js` elige la fuente de datos: si existe `.env` usa `supabaseApi.js` (consultas a la base);
si no, `demoApi.js`. Las vistas no cambian. Las operaciones que mueven stock (prestar, devolver, cancelar,
registrar o resolver incidencias, recibir reposición) son funciones SQL llamadas con `supabase.rpc()`:
se ejecutan completas o no se ejecutan, y bloquean la fila para que dos pañoleros no presten la última unidad a la vez.

## 15. Autenticación y permisos sobre los datos

Supabase Auth con correo `DNI@dominio` y contraseña. Toda cuenta nueva nace como **alumno inactivo**
y el administrador la activa y le asigna rol (nadie puede darse permisos a sí mismo).
Las políticas RLS repiten la tabla "quién consulta / quién modifica" de la Parte 3:
el alumno solo lee sus préstamos, el docente los de sus cursos, el pañolero opera préstamos pero no
resuelve incidencias ni cambia roles, y solo el administrador modifica usuarios, herramientas y configuración.
El KPI se calcula con una función que devuelve solo cantidades, sin datos personales.

Crear cuentas nuevas requiere la clave `service_role`, que no puede estar en el cliente; por eso
las cuentas se crean desde el panel de Supabase y la app solo asigna rol y activa.

## 16. Mensajes y seguridad

Cada pantalla muestra "Cargando…", los botones cambian a "Guardando…", hay confirmación antes de
acciones importantes (dar de baja, cancelar, registrar rotura) y avisos de éxito o error en español.
En el código y en la documentación solo aparecen la URL y la clave pública (anon), que se cargan
desde `.env` (excluido del repositorio con `.gitignore`). No hay contraseñas ni claves de administración.
