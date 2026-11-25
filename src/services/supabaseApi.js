// MODO SUPABASE: los datos viven en una base PostgreSQL compartida.
// Las operaciones que cambian stock usan funciones SQL (RPC) para que sean
// atómicas y para que los permisos se controlen en la base de datos.
import { supabase, DOMINIO_DNI } from './supabase'

// ---------- utilidades ----------
function traducir(error) {
  const m = error?.message || 'Error desconocido'
  if (m.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos.'
  if (m.includes('row-level security') || m.includes('permission denied')) return 'No tenés permiso para realizar esta operación.'
  if (m.includes('duplicate key')) return 'Ya existe un registro con ese dato (código o DNI repetido).'
  if (m.includes('Failed to fetch')) return 'No hay conexión con el servidor. Revisá tu internet.'
  return m
}

function ok({ data, error }) {
  if (error) throw new Error(traducir(error))
  return data
}

function uno(x) {
  return Array.isArray(x) ? x[0] || null : x || null
}

async function miId() {
  const { data } = await supabase.auth.getUser()
  if (!data?.user) throw new Error('Tu sesión expiró. Volvé a ingresar.')
  return data.user.id
}

async function cargarPerfil(id) {
  return ok(await supabase.from('perfiles').select('*').eq('id', id).single())
}

// ---------- sesión ----------
export async function iniciarSesion(usuario, contrasena) {
  // Se puede ingresar con DNI (se convierte a DNI@dominio) o con el correo
  const email = usuario.includes('@') ? usuario.trim() : `${usuario.trim()}@${DOMINIO_DNI}`
  const datos = ok(await supabase.auth.signInWithPassword({ email, password: contrasena }))
  const perfil = await cargarPerfil(datos.user.id)
  if (!perfil.activo) {
    await supabase.auth.signOut()
    throw new Error('Tu cuenta todavía no fue activada por el administrador.')
  }
  return perfil
}

export async function sesionActual() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  try {
    const perfil = await cargarPerfil(data.session.user.id)
    return perfil.activo ? perfil : null
  } catch {
    return null
  }
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}

export async function usuariosDePrueba() {
  return [] // en modo Supabase no hay selector de usuarios de prueba
}

// ---------- talleres y categorías ----------
export async function listarTalleres() {
  return ok(await supabase.from('talleres').select('*').order('nombre'))
}
export async function listarCategorias() {
  return ok(await supabase.from('categorias').select('*').order('nombre'))
}
export async function guardarTaller({ id, nombre, plazo_dias, activo }) {
  const fila = { nombre, plazo_dias, activo: activo ?? true }
  ok(id ? await supabase.from('talleres').update(fila).eq('id', id) : await supabase.from('talleres').insert(fila))
}
export async function guardarCategoria({ id, nombre, activo }) {
  const fila = { nombre, activo: activo ?? true }
  ok(id ? await supabase.from('categorias').update(fila).eq('id', id) : await supabase.from('categorias').insert(fila))
}

// ---------- herramientas ----------
export async function listarHerramientas() {
  const filas = ok(await supabase.from('herramientas').select('*, categoria:categorias(nombre), taller:talleres(nombre)').order('codigo'))
  return filas.map(({ categoria, taller, ...h }) => ({ ...h, categoria_nombre: categoria?.nombre || '—', taller_nombre: taller?.nombre || '—' }))
}
export async function guardarHerramienta(h) {
  const fila = {
    codigo: h.codigo, nombre: h.nombre, tipo: h.tipo, categoria_id: h.categoria_id, taller_id: h.taller_id,
    cantidad_total: h.cantidad_total, stock_minimo: h.stock_minimo, estado_general: h.estado_general, ubicacion: h.ubicacion
  }
  if (h.id) {
    // Se mantiene la cantidad prestada/fuera de stock y se ajusta la disponible
    const actual = ok(await supabase.from('herramientas').select('cantidad_total, cantidad_disponible').eq('id', h.id).single())
    const prestadas = actual.cantidad_total - actual.cantidad_disponible
    if (h.cantidad_total < prestadas) throw new Error(`No se puede bajar el total a menos de ${prestadas} (unidades prestadas o fuera de stock).`)
    fila.cantidad_disponible = h.cantidad_total - prestadas
    ok(await supabase.from('herramientas').update(fila).eq('id', h.id))
  } else {
    fila.cantidad_disponible = h.cantidad_total
    ok(await supabase.from('herramientas').insert(fila))
  }
}
export async function cambiarActivoHerramienta(id, activo) {
  ok(await supabase.from('herramientas').update({ activo }).eq('id', id))
}
export async function ajustarStock(id, { cantidad_disponible, estado_general }) {
  ok(await supabase.rpc('ajustar_stock', { p_herramienta: id, p_disponible: cantidad_disponible, p_estado: estado_general }))
}

// ---------- usuarios ----------
export async function listarUsuarios() {
  return ok(await supabase.from('perfiles').select('*').order('nombre'))
}
export async function guardarUsuario(u) {
  if (!u.id) {
    // Crear cuentas requiere la clave de administración de Supabase, que no puede estar en el cliente.
    throw new Error('Las cuentas nuevas se crean desde el panel de Supabase (Authentication → Add user). Luego aparecen acá para asignarles rol y activarlas.')
  }
  const fila = { nombre: u.nombre, dni: u.dni, rol: u.rol, curso: u.curso || null, cursos: u.cursos || [], taller_id: u.taller_id || null, activo: u.activo }
  ok(await supabase.from('perfiles').update(fila).eq('id', u.id))
}

// ---------- préstamos ----------
const SELECT_PRESTAMO = `*,
  persona:perfiles!prestamos_persona_id_fkey(nombre, dni),
  panolero:perfiles!prestamos_panolero_id_fkey(nombre),
  herramienta:herramientas(codigo, nombre),
  devolucion:devoluciones(fecha_real, estado_al_devolver, observaciones)`

function normalizarPrestamo({ persona, panolero, herramienta, devolucion, ...p }) {
  return {
    ...p,
    persona_nombre: persona?.nombre || '—',
    persona_dni: persona?.dni || '',
    panolero_nombre: panolero?.nombre || '—',
    herramienta_codigo: herramienta?.codigo,
    herramienta_nombre: herramienta?.nombre,
    devolucion: uno(devolucion)
  }
}

export async function listarPrestamos() {
  // RLS filtra: alumno ve los propios, docente los de sus cursos, pañolero y admin todos
  const filas = ok(await supabase.from('prestamos').select(SELECT_PRESTAMO).order('numero', { ascending: false }))
  return filas.map(normalizarPrestamo)
}
export async function obtenerPrestamo(id) {
  return normalizarPrestamo(ok(await supabase.from('prestamos').select(SELECT_PRESTAMO).eq('id', id).single()))
}
export async function registrarPrestamo(d) {
  return ok(await supabase.rpc('registrar_prestamo', {
    p_persona: d.persona_id, p_herramienta: d.herramienta_id, p_cantidad: d.cantidad,
    p_fecha_limite: d.fecha_limite, p_estado: d.estado_al_prestar, p_solicitud: d.solicitud_id || null,
    p_autorizacion_clase: d.autorizacion_clase_id || null
  }))
}
export async function cancelarPrestamo(id, motivo) {
  ok(await supabase.rpc('cancelar_prestamo', { p_prestamo: id, p_motivo: motivo }))
}
export async function registrarDevolucion(prestamoId, d) {
  ok(await supabase.rpc('registrar_devolucion', { p_prestamo: prestamoId, p_estado: d.estado_al_devolver, p_observaciones: d.observaciones || '' }))
}

// ---------- incidencias ----------
export async function listarIncidencias() {
  const filas = ok(await supabase.from('incidencias')
    .select('*, herramienta:herramientas(codigo, nombre), responsable:perfiles!incidencias_responsable_id_fkey(nombre), prestamo:prestamos(numero)')
    .order('fecha', { ascending: false }))
  return filas.map(({ herramienta, responsable, prestamo, ...i }) => ({
    ...i,
    herramienta_codigo: herramienta?.codigo,
    herramienta_nombre: herramienta?.nombre,
    responsable_nombre: responsable?.nombre || 'Sin responsable',
    prestamo_numero: prestamo?.numero || null
  }))
}
export async function registrarIncidencia(d) {
  ok(await supabase.rpc('registrar_incidencia', {
    p_herramienta: d.herramienta_id, p_tipo: d.tipo, p_cantidad: d.cantidad,
    p_responsable: d.responsable_id || null, p_descripcion: d.descripcion
  }))
}
export async function resolverIncidencia(id, accion, resolucion) {
  ok(await supabase.rpc('resolver_incidencia', { p_incidencia: id, p_accion: accion, p_resolucion: resolucion }))
}

// ---------- solicitudes de préstamo (de docentes) ----------
export async function listarSolicitudes() {
  // Solo las de docentes (alumno_id vacío). Como la tabla tiene varias relaciones con perfiles,
  // se indica cuál usar con el nombre de la clave foránea.
  const filas = ok(await supabase.from('solicitudes_prestamo')
    .select('*, docente:perfiles!solicitudes_prestamo_docente_id_fkey(nombre), herramienta:herramientas(codigo, nombre)')
    .is('alumno_id', null)
    .order('fecha', { ascending: false }))
  return filas.map(({ docente, herramienta, ...s }) => ({
    ...s, docente_nombre: docente?.nombre || '—', herramienta_codigo: herramienta?.codigo, herramienta_nombre: herramienta?.nombre
  }))
}
export async function crearSolicitud(d) {
  const docente_id = await miId()
  ok(await supabase.from('solicitudes_prestamo').insert({
    docente_id, herramienta_id: d.herramienta_id, cantidad: d.cantidad, fecha_clase: d.fecha_clase, curso: d.curso, motivo: d.motivo
  }))
}
export async function cambiarEstadoSolicitud(id, estado, respuesta = '') {
  ok(await supabase.from('solicitudes_prestamo').update({ estado, respuesta }).eq('id', id).eq('estado', 'pendiente'))
}

// ---------- autorización digital del docente (pedidos de alumnos) ----------
// Docentes activos (sin DNI), con una función SQL porque el alumno no puede leer otros perfiles
export async function listarDocentes() {
  return ok(await supabase.rpc('listar_docentes'))
}

function mapaNombres(docentes) {
  return Object.fromEntries(docentes.map((d) => [d.id, d.nombre]))
}

// RLS filtra: alumno las suyas, docente las de sus cursos, pañolero y admin todas
export async function listarSolicitudesAlumnos() {
  const [filas, docentes] = await Promise.all([
    supabase.from('solicitudes_prestamo')
      .select(`*,
        alumno:perfiles!solicitudes_prestamo_alumno_id_fkey(nombre, dni),
        herramienta:herramientas(codigo, nombre),
        prestamo:prestamos!solicitudes_prestamo_prestamo_id_fkey(numero)`)
      .not('alumno_id', 'is', null)
      .order('id', { ascending: false })
      .then(ok),
    listarDocentes()
  ])
  const nombres = mapaNombres(docentes)
  return filas.map(({ alumno, herramienta, prestamo, ...s }) => ({
    ...s,
    alumno_nombre: alumno?.nombre || '—',
    alumno_dni: alumno?.dni || '',
    docente_nombre: nombres[s.docente_id] || '—',
    autorizado_por_nombre: s.autorizado_por ? nombres[s.autorizado_por] || '—' : null,
    herramienta_codigo: herramienta?.codigo,
    herramienta_nombre: herramienta?.nombre,
    prestamo_numero: prestamo?.numero || null
  }))
}
export async function crearSolicitudAlumno(d) {
  const yo = await cargarPerfil(await miId())
  if (!yo.curso) throw new Error('Tu perfil no tiene curso asignado. Pedile al administrador que lo cargue.')
  // La política RLS controla que sea a su nombre, con su curso y un docente de ese curso
  ok(await supabase.from('solicitudes_prestamo').insert({
    alumno_id: yo.id, docente_id: d.docente_id, herramienta_id: d.herramienta_id, cantidad: d.cantidad,
    curso: yo.curso, motivo: d.motivo, estado: 'esperando_autorizacion'
  }))
}
export async function cancelarSolicitudAlumno(id) {
  const filas = ok(await supabase.from('solicitudes_prestamo').update({ estado: 'cancelada' }).eq('id', id).select('id'))
  if (!filas.length) throw new Error('Solo podés cancelar pedidos que esperan autorización o que están autorizados y vigentes.')
}
// Devuelve el código de retiro generado
export async function autorizarSolicitud(id, cantidad, fechaLimite) {
  return ok(await supabase.rpc('autorizar_solicitud', { p_solicitud: id, p_cantidad: cantidad, p_fecha_limite: fechaLimite }))
}
export async function rechazarSolicitud(id, motivo) {
  ok(await supabase.rpc('rechazar_solicitud', { p_solicitud: id, p_motivo: motivo }))
}

// ---------- autorizaciones de clase ----------
export async function listarAutorizacionesClase() {
  const [filas, docentes] = await Promise.all([
    supabase.from('autorizaciones_clase')
      .select('*, herramienta:herramientas(codigo, nombre), retiros:prestamos(persona_id, estado)')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
      .then(ok),
    listarDocentes()
  ])
  const nombres = mapaNombres(docentes)
  return filas.map(({ herramienta, retiros, ...a }) => ({
    ...a,
    docente_nombre: nombres[a.docente_id] || '—',
    herramienta_codigo: herramienta?.codigo,
    herramienta_nombre: herramienta?.nombre,
    retirados: (retiros || []).filter((r) => r.estado !== 'cancelado').map((r) => r.persona_id)
  }))
}
export async function crearAutorizacionClase(d) {
  ok(await supabase.rpc('crear_autorizacion_clase', {
    p_curso: d.curso, p_herramienta: d.herramienta_id, p_cantidad: d.cantidad_por_alumno, p_fecha: d.fecha
  }))
}
export async function cancelarAutorizacionClase(id) {
  ok(await supabase.rpc('cancelar_autorizacion_clase', { p_autorizacion: id }))
}

// ---------- reposiciones ----------
export async function listarReposiciones() {
  const filas = ok(await supabase.from('solicitudes_reposicion')
    .select('*, solicitante:perfiles(nombre), herramienta:herramientas(codigo, nombre)')
    .order('fecha', { ascending: false }))
  return filas.map(({ solicitante, herramienta, ...r }) => ({
    ...r, solicitante_nombre: solicitante?.nombre || '—', herramienta_codigo: herramienta?.codigo, herramienta_nombre: herramienta?.nombre
  }))
}
export async function crearReposicion(d) {
  const solicitante_id = await miId()
  ok(await supabase.from('solicitudes_reposicion').insert({ solicitante_id, herramienta_id: d.herramienta_id, cantidad: d.cantidad, motivo: d.motivo }))
}
export async function actualizarReposicion(id, estado, respuesta = '') {
  ok(await supabase.rpc('actualizar_reposicion', { p_reposicion: id, p_estado: estado, p_respuesta: respuesta }))
}

// ---------- tareas ----------
export async function listarTareas() {
  return ok(await supabase.from('tareas').select('*').order('fecha_limite', { ascending: false }))
}
export async function guardarTarea({ id, codigo_integrante, comision, descripcion, fecha_limite }) {
  const fila = { codigo_integrante, comision, descripcion, fecha_limite }
  ok(id ? await supabase.from('tareas').update(fila).eq('id', id) : await supabase.from('tareas').insert(fila))
}
export async function cambiarEstadoTarea(id, estado) {
  const fecha_completada = estado === 'completada' ? new Date().toISOString().slice(0, 10) : null
  ok(await supabase.from('tareas').update({ estado, fecha_completada }).eq('id', id))
}

// ---------- actas ----------
export async function listarActas() {
  return ok(await supabase.from('actas').select('*').order('fecha', { ascending: false }))
}
export async function guardarActa({ id, fecha, participantes, temas, decisiones, responsables }) {
  const fila = { fecha, participantes, temas, decisiones, responsables }
  ok(id ? await supabase.from('actas').update(fila).eq('id', id) : await supabase.from('actas').insert(fila))
}

// ---------- KPI ----------
export async function conteosKpi(mes) {
  return ok(await supabase.rpc('kpi_mes', { p_mes: mes + '-01' }))
}

export async function reiniciarDatosDePrueba() {
  throw new Error('En modo Supabase los datos de prueba se cargan con supabase/seed.sql.')
}
