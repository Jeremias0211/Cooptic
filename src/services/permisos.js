// Roles del sistema (Parte 3 – Tipos de usuario) y lo que puede hacer cada uno.
// La interfaz usa este mapa para mostrar/ocultar opciones.
// En modo Supabase, los mismos permisos se aplican SOBRE LOS DATOS con RLS (supabase/schema.sql).

export const ROLES = {
  admin: 'Administrador',
  panolero: 'Pañolero',
  docente: 'Docente',
  alumno: 'Alumno'
}

export const PERMISOS = {
  verPanel: ['admin', 'panolero', 'docente', 'alumno'],
  verInventario: ['admin', 'panolero', 'docente', 'alumno'],
  editarHerramientas: ['admin'], // alta, modificación y baja
  ajustarStock: ['admin', 'panolero'], // solo stock y estado
  verPrestamos: ['admin', 'panolero', 'docente', 'alumno'],
  gestionarPrestamos: ['panolero', 'admin'], // registrar, devolver, cancelar
  verIncidencias: ['admin', 'panolero'],
  registrarIncidencias: ['admin', 'panolero'],
  resolverIncidencias: ['admin'],
  verSolicitudes: ['admin', 'panolero', 'docente'],
  crearSolicitudPrestamo: ['docente'],
  atenderSolicitudes: ['admin', 'panolero'],
  // Autorización digital del docente (reemplaza la notita en papel)
  pedirPrestamoAlumno: ['alumno'], // el alumno pide y elige qué docente lo autoriza
  autorizarPedidos: ['docente'], // el docente autoriza o rechaza pedidos de sus cursos
  verListasParaRetirar: ['panolero', 'admin'], // el pañol entrega lo autorizado
  autorizacionesClase: ['docente'], // autorización para todo un curso en un día
  verReposiciones: ['admin', 'panolero', 'docente'],
  crearReposicion: ['admin', 'panolero', 'docente'],
  aprobarReposicion: ['admin'],
  gestionarUsuarios: ['admin'],
  configurar: ['admin'], // categorías, talleres y plazos
  verReportes: ['admin'],
  verTableroKpi: ['admin', 'panolero', 'docente'],
  verTableroResumido: ['alumno'],
  verTareas: ['admin', 'panolero', 'docente'],
  gestionarTareas: ['admin'],
  verActas: ['admin', 'panolero', 'docente'],
  gestionarActas: ['admin']
}

export function puede(rol, permiso) {
  return !!rol && (PERMISOS[permiso] || []).includes(rol)
}

// Textos de estados (se guardan sin tildes, se muestran con tildes)
export const ESTADOS_ELEMENTO = { bueno: 'Bueno', danado: 'Dañado', perdido: 'Perdido' }
export const ESTADO_GENERAL = {
  bueno: 'Bueno',
  regular: 'Regular',
  en_reparacion: 'En reparación',
  fuera_de_servicio: 'Fuera de servicio'
}
export const ESTADO_PRESTAMO = { activo: 'Activo', vencido: 'Vencido', devuelto: 'Devuelto', cancelado: 'Cancelado' }
export const ESTADO_SOLICITUD = {
  pendiente: 'Pendiente',
  atendida: 'Atendida',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  // pedidos de alumnos
  esperando_autorizacion: 'Esperando autorización',
  autorizada: 'Autorizada',
  retirada: 'Retirada',
  vencida: 'Vencida'
}
export const HORAS_VIGENCIA_AUTORIZACION = 48
export const ESTADO_REPOSICION = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', recibida: 'Recibida' }
export const TIPO_INCIDENCIA = { rotura: 'Rotura', perdida: 'Pérdida' }
export const COMISIONES = ['Relevamiento', 'Documentación y Comunicación', 'Desarrollo y Diseño']
