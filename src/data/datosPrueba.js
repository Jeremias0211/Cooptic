// ⚠️ DATOS DE PRUEBA (FICTICIOS)
// Nombres, DNI y movimientos inventados para probar el sistema.
// No representan personas ni mediciones reales de la precooperativa.
// Las fechas se generan en relación con el día de hoy para que siempre haya
// préstamos activos, vencidos y meses anteriores con historial.

export const talleres = [
  { id: 1, nombre: 'Electricidad', plazo_dias: 7, activo: true },
  { id: 2, nombre: 'Carpintería', plazo_dias: 7, activo: true },
  { id: 3, nombre: 'Mecánica', plazo_dias: 5, activo: true },
  { id: 4, nombre: 'Electrónica', plazo_dias: 7, activo: true }
]

export const categorias = [
  { id: 1, nombre: 'Herramientas manuales', activo: true },
  { id: 2, nombre: 'Herramientas eléctricas', activo: true },
  { id: 3, nombre: 'Instrumentos de medición', activo: true },
  { id: 4, nombre: 'Materiales e insumos', activo: true },
  { id: 5, nombre: 'Elementos de seguridad', activo: true }
]

// Rol simulado: en modo demo no hay contraseñas, se elige el usuario de prueba.
export const usuarios = [
  { id: 'u1', nombre: 'Laura Fernández', dni: '20111222', rol: 'admin', curso: null, cursos: [], taller_id: null, activo: true },
  { id: 'u2', nombre: 'Ricardo Gómez', dni: '25333444', rol: 'panolero', curso: null, cursos: [], taller_id: 1, activo: true },
  { id: 'u3', nombre: 'Marta Sosa', dni: '26444555', rol: 'panolero', curso: null, cursos: [], taller_id: 2, activo: true },
  { id: 'u4', nombre: 'Pablo Herrera', dni: '28555666', rol: 'docente', curso: null, cursos: ['5°1', '5°2'], taller_id: 1, activo: true },
  { id: 'u5', nombre: 'Silvia Ríos', dni: '29666777', rol: 'docente', curso: null, cursos: ['6°1', '7°1'], taller_id: 3, activo: true },
  { id: 'u6', nombre: 'Tomás Martínez', dni: '47111222', rol: 'alumno', curso: '5°1', cursos: [], taller_id: null, activo: true },
  { id: 'u7', nombre: 'Lucía Benítez', dni: '47222333', rol: 'alumno', curso: '5°2', cursos: [], taller_id: null, activo: true },
  { id: 'u8', nombre: 'Joaquín Pereyra', dni: '46333444', rol: 'alumno', curso: '6°1', cursos: [], taller_id: null, activo: true },
  { id: 'u9', nombre: 'Valentina Acosta', dni: '45444555', rol: 'alumno', curso: '7°1', cursos: [], taller_id: null, activo: true },
  { id: 'u10', nombre: 'Franco Díaz', dni: '46555666', rol: 'alumno', curso: '6°1', cursos: [], taller_id: null, activo: true },
  { id: 'u11', nombre: 'Camila Romero', dni: '47666777', rol: 'alumno', curso: '5°1', cursos: [], taller_id: null, activo: true },
  { id: 'u12', nombre: 'Mateo Ruiz', dni: '47777888', rol: 'alumno', curso: '5°2', cursos: [], taller_id: null, activo: false }
]

// cantidad_disponible se calcula al cargar los préstamos de prueba
export const herramientas = [
  { id: 1, codigo: 'H-001', nombre: 'Taladro percutor', tipo: 'herramienta', categoria_id: 2, taller_id: 1, cantidad_total: 4, stock_minimo: 1, estado_general: 'bueno', ubicacion: 'Estante A1' },
  { id: 2, codigo: 'H-002', nombre: 'Destornillador plano', tipo: 'herramienta', categoria_id: 1, taller_id: 1, cantidad_total: 15, stock_minimo: 4, estado_general: 'bueno', ubicacion: 'Cajón B2' },
  { id: 3, codigo: 'H-003', nombre: 'Pinza universal', tipo: 'herramienta', categoria_id: 1, taller_id: 1, cantidad_total: 12, stock_minimo: 3, estado_general: 'bueno', ubicacion: 'Cajón B3' },
  { id: 4, codigo: 'H-004', nombre: 'Multímetro digital', tipo: 'herramienta', categoria_id: 3, taller_id: 4, cantidad_total: 8, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Armario E1' },
  { id: 5, codigo: 'H-005', nombre: 'Calibre', tipo: 'herramienta', categoria_id: 3, taller_id: 3, cantidad_total: 6, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Armario M1' },
  { id: 6, codigo: 'H-006', nombre: 'Sierra caladora', tipo: 'herramienta', categoria_id: 2, taller_id: 2, cantidad_total: 3, stock_minimo: 1, estado_general: 'regular', ubicacion: 'Estante C1' },
  { id: 7, codigo: 'H-007', nombre: 'Martillo', tipo: 'herramienta', categoria_id: 1, taller_id: 2, cantidad_total: 10, stock_minimo: 3, estado_general: 'bueno', ubicacion: 'Panel C2' },
  { id: 8, codigo: 'H-008', nombre: 'Soldador de estaño', tipo: 'herramienta', categoria_id: 2, taller_id: 4, cantidad_total: 8, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Armario E2' },
  { id: 9, codigo: 'H-009', nombre: 'Llave inglesa', tipo: 'herramienta', categoria_id: 1, taller_id: 3, cantidad_total: 6, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Panel M2' },
  { id: 10, codigo: 'H-010', nombre: 'Amoladora angular', tipo: 'herramienta', categoria_id: 2, taller_id: 3, cantidad_total: 2, stock_minimo: 1, estado_general: 'en_reparacion', ubicacion: 'Estante M3' },
  { id: 11, codigo: 'H-011', nombre: 'Pinza pelacables', tipo: 'herramienta', categoria_id: 1, taller_id: 1, cantidad_total: 8, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Cajón B4' },
  { id: 12, codigo: 'H-012', nombre: 'Antiparras de seguridad', tipo: 'herramienta', categoria_id: 5, taller_id: 3, cantidad_total: 20, stock_minimo: 6, estado_general: 'bueno', ubicacion: 'Armario S1' },
  { id: 13, codigo: 'H-013', nombre: 'Cinta métrica 5 m', tipo: 'herramienta', categoria_id: 3, taller_id: 2, cantidad_total: 10, stock_minimo: 3, estado_general: 'bueno', ubicacion: 'Cajón C3' },
  { id: 14, codigo: 'H-014', nombre: 'Serrucho', tipo: 'herramienta', categoria_id: 1, taller_id: 2, cantidad_total: 6, stock_minimo: 2, estado_general: 'bueno', ubicacion: 'Panel C4' },
  { id: 15, codigo: 'H-015', nombre: 'Pistola de calor', tipo: 'herramienta', categoria_id: 2, taller_id: 4, cantidad_total: 2, stock_minimo: 1, estado_general: 'bueno', ubicacion: 'Armario E3' },
  { id: 16, codigo: 'M-001', nombre: 'Cable unipolar 2,5 mm (rollo)', tipo: 'material', categoria_id: 4, taller_id: 1, cantidad_total: 10, stock_minimo: 3, estado_general: 'bueno', ubicacion: 'Depósito D1' },
  { id: 17, codigo: 'M-002', nombre: 'Estaño (carrete)', tipo: 'material', categoria_id: 4, taller_id: 4, cantidad_total: 12, stock_minimo: 4, estado_general: 'bueno', ubicacion: 'Depósito D2' },
  { id: 18, codigo: 'M-003', nombre: 'Lija grano 120 (pliego)', tipo: 'material', categoria_id: 4, taller_id: 2, cantidad_total: 40, stock_minimo: 10, estado_general: 'bueno', ubicacion: 'Depósito D3' },
  { id: 19, codigo: 'M-004', nombre: 'Tornillos (caja x100)', tipo: 'material', categoria_id: 4, taller_id: 2, cantidad_total: 25, stock_minimo: 5, estado_general: 'bueno', ubicacion: 'Depósito D4' },
  { id: 20, codigo: 'H-016', nombre: 'Guantes de trabajo (par)', tipo: 'herramienta', categoria_id: 5, taller_id: 3, cantidad_total: 20, stock_minimo: 6, estado_general: 'bueno', ubicacion: 'Armario S2' }
]

// Préstamos de prueba:
// [persona, herramienta, cantidad, díasAtrás(salida), plazoDías, devolución]
// devolución: null = sigue activo | 'cancelado' | [díasDespuésDeSalida, estado, observaciones]
export const prestamos = [
  // hace 3 meses
  ['u6', 1, 1, 95, 7, [6, 'bueno']],
  ['u7', 2, 3, 93, 7, [7, 'bueno']],
  ['u8', 5, 1, 92, 5, [9, 'bueno', 'Devuelto tarde, sin daños.']],
  ['u9', 4, 2, 90, 7, [5, 'bueno']],
  ['u4', 3, 6, 88, 7, [7, 'bueno']],
  ['u10', 7, 2, 86, 7, [6, 'danado', 'Mango de un martillo partido.']],
  ['u11', 1, 1, 84, 7, [10, 'bueno']],
  // hace 2 meses
  ['u6', 4, 1, 64, 7, [6, 'bueno']],
  ['u7', 8, 2, 62, 7, [7, 'bueno']],
  ['u8', 9, 1, 61, 5, [4, 'bueno']],
  ['u5', 12, 10, 60, 5, [5, 'bueno']],
  ['u9', 1, 1, 58, 7, [12, 'bueno', 'Devuelto con demora.']],
  ['u10', 13, 1, 57, 7, [7, 'perdido', 'El alumno no la encuentra.']],
  ['u11', 2, 2, 55, 7, [6, 'bueno']],
  ['u6', 16, 1, 54, 7, [7, 'bueno']],
  ['u4', 11, 4, 53, 7, [7, 'bueno']],
  // mes pasado
  ['u7', 1, 1, 34, 7, [7, 'bueno']],
  ['u8', 5, 2, 33, 5, [5, 'bueno']],
  ['u9', 8, 1, 32, 7, [9, 'danado', 'Punta del soldador dañada.']],
  ['u6', 3, 2, 31, 7, [6, 'bueno']],
  ['u10', 4, 1, 30, 7, [11, 'bueno', 'Devuelto fuera de término.']],
  ['u11', 14, 1, 29, 7, [7, 'bueno']],
  ['u5', 20, 8, 28, 5, [5, 'bueno']],
  ['u7', 2, 2, 27, 7, ['cancelado']],
  ['u8', 1, 1, 26, 7, [7, 'bueno']],
  ['u4', 17, 3, 25, 7, [6, 'bueno']],
  // este mes / activos
  ['u6', 1, 1, 12, 7, null], // vencido
  ['u9', 4, 1, 10, 7, [8, 'bueno']],
  ['u10', 3, 1, 9, 5, null], // vencido
  ['u11', 7, 1, 6, 7, [5, 'bueno']],
  ['u7', 8, 1, 5, 7, null],
  ['u8', 9, 1, 3, 5, null],
  ['u4', 2, 5, 2, 7, null],
  ['u6', 13, 1, 1, 7, null],
  ['u9', 5, 1, 0, 7, null]
]

// Solicitudes de préstamo hechas por docentes para su clase
// [docente, herramienta, cantidad, díasAtrás, curso, estado, respuesta]
export const solicitudesPrestamo = [
  ['u4', 3, 6, 89, '5°1', 'atendida', ''],
  ['u5', 12, 10, 61, '6°1', 'atendida', ''],
  ['u4', 11, 4, 54, '5°2', 'atendida', ''],
  ['u5', 10, 2, 50, '7°1', 'rechazada', 'Amoladoras en reparación.'],
  ['u5', 20, 8, 29, '6°1', 'atendida', ''],
  ['u4', 17, 3, 26, '5°1', 'atendida', ''],
  ['u4', 1, 4, 24, '5°2', 'rechazada', 'No hay stock suficiente de taladros.'],
  ['u4', 2, 5, 3, '5°1', 'atendida', ''],
  ['u5', 5, 4, 2, '7°1', 'pendiente', ''],
  ['u5', 15, 2, 1, '6°1', 'pendiente', '']
]

// [herramienta, cantidad, solicitante, díasAtrás, motivo, estado, respuesta]
export const reposiciones = [
  [7, 2, 'u3', 80, 'Reponer martillo roto.', 'recibida', 'Comprado con fondos de la cooperativa.'],
  [13, 2, 'u4', 50, 'Falta una cinta métrica y hay mucha demanda.', 'aprobada', 'Se compra el mes próximo.'],
  [1, 2, 'u2', 20, 'Los taladros no alcanzan para una clase completa.', 'pendiente', ''],
  [18, 20, 'u4', 6, 'Lijas para el trabajo práctico de 5° año.', 'pendiente', '']
]

// Tareas de los integrantes (KPI 4). Se usan códigos internos, no nombres.
// [código, comisión, descripción, díasLímite (negativo = pasado), díasCompletada (null = pendiente)]
export const tareas = [
  ['I-01', 'Relevamiento', 'Revisión física del estante A', -70, -72],
  ['I-02', 'Documentación y Comunicación', 'Cartel con normas de devolución', -68, -69],
  ['I-03', 'Desarrollo y Diseño', 'Pantalla de nuevo préstamo', -65, -60],
  ['I-04', 'Relevamiento', 'Etiquetar herramientas de carpintería', -62, -63],
  ['I-01', 'Relevamiento', 'Control de stock de materiales', -40, -41],
  ['I-05', 'Documentación y Comunicación', 'Manual de uso para pañoleros', -38, -38],
  ['I-03', 'Desarrollo y Diseño', 'Reporte de stock bajo', -36, -37],
  ['I-06', 'Desarrollo y Diseño', 'Pruebas en celulares', -33, -30],
  ['I-02', 'Documentación y Comunicación', 'Aviso de vencimientos por curso', -31, -32],
  ['I-04', 'Relevamiento', 'Inventario de taller de mecánica', -29, -29],
  ['I-01', 'Relevamiento', 'Revisión de herramientas dañadas', -8, -9],
  ['I-05', 'Documentación y Comunicación', 'Acta de la reunión mensual', -5, -5],
  ['I-03', 'Desarrollo y Diseño', 'Tablero de indicadores', -2, null],
  ['I-06', 'Desarrollo y Diseño', 'Conexión con Supabase', 6, null],
  ['I-04', 'Relevamiento', 'Control de fin de mes', 10, null]
]

// [díasAtrás, participantes, temas, decisiones, responsables y plazos]
export const actas = [
  [75, 'Directivo (L. F.), 2 profesores, 6 alumnos de las comisiones', 'Organización del pañol y normas de préstamo.', 'Se aprueba el plazo de 7 días para préstamos (5 en Mecánica). Se registran todas las roturas en el sistema.', 'Comisión de Documentación: cartel de normas (2 semanas).'],
  [40, '2 profesores, 5 alumnos', 'Revisión de KPI del mes y herramientas dañadas.', 'Se pide reponer una cinta métrica. Se acuerda avisar vencimientos un día antes.', 'Relevamiento: lista de herramientas a reparar (1 semana).'],
  [8, 'Directivo, 3 profesores, 7 alumnos', 'Demanda de taladros y conexión del sistema con base de datos.', 'Se evalúa comprar 2 taladros. Desarrollo comienza la conexión con Supabase.', 'Desarrollo y Diseño: primera versión conectada (fin de mes).']
]

// AUTORIZACIÓN DIGITAL DEL DOCENTE: pedidos de alumnos (reemplazan la notita en papel)
// [alumno, docente, herramienta, cantidad, horasDesdeElPedido, estado, horasDesdeLaRespuesta, código, cantidadAutorizada, motivo, respuesta]
// - La de Joaquín quedó "autorizada" hace 72 h: como pasaron más de 48 h se muestra VENCIDA.
// - La de Valentina está "retirada" y se vincula con su préstamo de hoy (calibre).
export const solicitudesAlumnos = [
  ['u6', 'u4', 11, 1, 3, 'esperando_autorizacion', null, null, null, 'Práctica de empalmes en el taller', ''],
  ['u11', 'u4', 4, 1, 20, 'esperando_autorizacion', null, null, null, 'Medir tensión en el tablero didáctico', ''],
  ['u7', 'u4', 2, 3, 5, 'autorizada', 2, 'K7MP', 2, 'Armado del tablero del trabajo práctico', ''],
  ['u8', 'u5', 20, 2, 80, 'autorizada', 72, 'R4TX', 2, 'Práctica de ajuste en el banco de trabajo', ''],
  ['u10', 'u5', 10, 1, 30, 'rechazada', 26, null, null, 'Corte de perfiles para el proyecto', 'La amoladora está en reparación. Usá la sierra de mano con supervisión.'],
  ['u9', 'u5', 5, 1, 26, 'retirada', 20, 'W8HB', 1, 'Medición de piezas torneadas', '']
]

// Autorización de CLASE activa hoy: todo 6°1 puede retirar 1 par de antiparras (Prof. Silvia Ríos)
// [docente, curso, herramienta, cantidadPorAlumno, díasDesdeHoy]
export const autorizacionesClase = [
  ['u5', '6°1', 12, 1, 0]
]
