// MODO DEMO: los datos se guardan en el navegador (localStorage).
// Sirve para probar el sistema sin internet y sin base de datos.
// Limitación: los datos NO se comparten entre usuarios ni dispositivos,
// y cualquiera puede borrarlos limpiando el navegador. Los roles están SIMULADOS.
import * as prueba from '../data/datosPrueba'
import { hoyISO, sumarDias, aISO } from '../utils/fechas'
import { contarKpi } from './kpi'

const CLAVE_DB = 'cooptic-demo-db-v2' // v2: autorización digital del docente
const CLAVE_SESION = 'cooptic-demo-sesion'
const HORAS_VIGENCIA = 48 // una autorización vale 48 horas para retirar
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O ni 1/I para no confundirlos

let db = null

// ---------- utilidades internas ----------
function guardar() {
  localStorage.setItem(CLAVE_DB, JSON.stringify(db))
}

function cargar() {
  if (db) return db
  try {
    db = JSON.parse(localStorage.getItem(CLAVE_DB))
  } catch {
    db = null
  }
  if (!db) {
    db = crearBaseDePrueba()
    guardar()
  }
  return db
}

function copia(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function nuevoId(tabla) {
  db.seq[tabla] = (db.seq[tabla] || 0) + 1
  return db.seq[tabla]
}

// Simula una pequeña demora de red para que se vean los mensajes de carga
function esperar(ms = 250) {
  return new Promise((r) => setTimeout(r, ms))
}

function usuarioActual() {
  const id = localStorage.getItem(CLAVE_SESION)
  return cargar().perfiles.find((p) => p.id === id && p.activo) || null
}

// Simula las políticas de acceso (en Supabase las aplica la base de datos con RLS)
function exigir(...roles) {
  const u = usuarioActual()
  if (!u) throw new Error('Tu sesión expiró. Volvé a ingresar.')
  if (!roles.includes(u.rol)) throw new Error('No tenés permiso para realizar esta operación.')
  return u
}

function buscar(tabla, id) {
  const fila = db[tabla].find((f) => f.id === Number(id) || f.id === id)
  if (!fila) throw new Error('El registro no existe.')
  return fila
}

// ---------- reglas de negocio (iguales a las funciones SQL) ----------
// controlarAutorizacion = true en los préstamos que registra el pañolero desde la app
// (los préstamos históricos de la base de prueba se cargan sin ese control)
function _registrarPrestamo(datos, panoleroId, fechaSalida = hoyISO(), controlarAutorizacion = false) {
  const persona = db.perfiles.find((p) => p.id === datos.persona_id)
  if (!persona || !persona.activo) throw new Error('La persona no existe o está inactiva.')
  const h = buscar('herramientas', datos.herramienta_id)
  if (!h.activo) throw new Error('La herramienta está dada de baja.')
  const cantidad = Number(datos.cantidad)
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser al menos 1.')
  if (h.cantidad_disponible < cantidad) {
    throw new Error(`Stock insuficiente: hay ${h.cantidad_disponible} disponibles de "${h.nombre}".`)
  }
  let solicitud = datos.solicitud_id ? buscar('solicitudesPrestamo', datos.solicitud_id) : null
  let clase = null
  if (controlarAutorizacion) {
    if (persona.rol === 'alumno') {
      // Igual que registrar_prestamo en SQL: el alumno necesita autorización vigente de un docente
      ;({ solicitud, clase } = _autorizacionDelAlumno(persona, h, cantidad, datos))
    } else {
      if (datos.autorizacion_clase_id) throw new Error('Las autorizaciones de clase son solo para alumnos.')
      if (solicitud && solicitud.alumno_id) throw new Error('Esa solicitud es de un alumno: el préstamo tiene que ser a su nombre.')
    }
  }
  db.seq.numero = (db.seq.numero || 100) + 1
  const prestamo = {
    id: nuevoId('prestamos'),
    numero: db.seq.numero,
    persona_id: persona.id,
    curso: persona.curso || (persona.cursos && persona.cursos[0]) || null,
    herramienta_id: h.id,
    cantidad,
    fecha_salida: fechaSalida,
    fecha_limite: datos.fecha_limite,
    estado_al_prestar: datos.estado_al_prestar,
    estado: 'activo',
    panolero_id: panoleroId,
    motivo_cancelacion: null,
    solicitud_id: solicitud ? solicitud.id : null,
    autorizacion_clase_id: clase ? clase.id : null
  }
  db.prestamos.push(prestamo)
  h.cantidad_disponible -= cantidad // el stock baja automáticamente
  // docente: pendiente → atendida | alumno: autorizada → retirada
  if (solicitud && ['pendiente', 'autorizada'].includes(solicitud.estado)) {
    solicitud.estado = solicitud.alumno_id ? 'retirada' : 'atendida'
    solicitud.prestamo_id = prestamo.id
  }
  return prestamo
}

// Busca (o controla) la autorización con la que retira un alumno:
// a) solicitud autorizada a su nombre, no vencida, misma herramienta y cantidad no mayor, o
// b) autorización de clase activa de hoy para su curso que todavía no usó.
function _autorizacionDelAlumno(persona, h, cantidad, datos) {
  const ahora = new Date()
  if (datos.solicitud_id) {
    const s = buscar('solicitudesPrestamo', datos.solicitud_id)
    if (s.alumno_id !== persona.id) throw new Error('La autorización no corresponde a este alumno.')
    if (s.estado !== 'autorizada') throw new Error('Esa solicitud no está autorizada para retirar.')
    if (new Date(s.vence) < ahora) throw new Error('La autorización venció: pasaron más de 48 horas sin retirarla.')
    if (s.herramienta_id !== h.id) throw new Error('La autorización es para otra herramienta.')
    if (cantidad > s.cantidad_autorizada) throw new Error(`El docente autorizó como máximo ${s.cantidad_autorizada} unidad(es).`)
    return { solicitud: s, clase: null }
  }
  if (datos.autorizacion_clase_id) {
    const a = buscar('autorizacionesClase', datos.autorizacion_clase_id)
    if (a.estado !== 'activa' || a.fecha !== hoyISO()) throw new Error('La autorización de clase no está vigente hoy.')
    if (a.curso !== persona.curso) throw new Error(`La autorización de clase es para otro curso (${a.curso}).`)
    if (a.herramienta_id !== h.id) throw new Error('La autorización de clase es para otra herramienta.')
    if (cantidad > a.cantidad_por_alumno) throw new Error(`La autorización de clase permite ${a.cantidad_por_alumno} unidad(es) por alumno.`)
    if (yaRetiroConClase(a.id, persona.id)) throw new Error('Este alumno ya retiró con esta autorización de clase.')
    return { solicitud: null, clase: a }
  }
  // No se indicó: se busca primero una solicitud autorizada y después una autorización de clase
  const s = db.solicitudesPrestamo.find((x) => x.alumno_id === persona.id && x.estado === 'autorizada' && new Date(x.vence) >= ahora &&
    x.herramienta_id === h.id && x.cantidad_autorizada >= cantidad)
  if (s) return { solicitud: s, clase: null }
  const a = db.autorizacionesClase.find((x) => x.estado === 'activa' && x.fecha === hoyISO() && x.curso === persona.curso &&
    x.herramienta_id === h.id && x.cantidad_por_alumno >= cantidad && !yaRetiroConClase(x.id, persona.id))
  if (a) return { solicitud: null, clase: a }
  throw new Error('El alumno no tiene autorización vigente de un docente.')
}

function yaRetiroConClase(autorizacionId, personaId) {
  return db.prestamos.some((p) => p.autorizacion_clase_id === autorizacionId && p.persona_id === personaId && p.estado !== 'cancelado')
}

function _registrarDevolucion(prestamoId, datos, panoleroId, fechaReal = hoyISO()) {
  const p = buscar('prestamos', prestamoId)
  if (p.estado !== 'activo') throw new Error('Este préstamo ya fue cerrado.')
  const h = buscar('herramientas', p.herramienta_id)
  db.devoluciones.push({
    id: nuevoId('devoluciones'),
    prestamo_id: p.id,
    fecha_real: fechaReal,
    estado_al_devolver: datos.estado_al_devolver,
    observaciones: datos.observaciones || '',
    panolero_id: panoleroId
  })
  p.estado = 'devuelto'
  if (datos.estado_al_devolver === 'bueno') {
    h.cantidad_disponible += p.cantidad // vuelve al stock
  } else {
    // dañado o perdido: no vuelve al stock y queda registrado para reposición
    db.incidencias.push({
      id: nuevoId('incidencias'),
      tipo: datos.estado_al_devolver === 'danado' ? 'rotura' : 'perdida',
      herramienta_id: h.id,
      prestamo_id: p.id,
      responsable_id: p.persona_id,
      cantidad: p.cantidad,
      fecha: fechaReal,
      descripcion: datos.observaciones || '',
      estado: 'abierta',
      accion: null,
      resolucion: '',
      fecha_resolucion: null
    })
  }
}

function _resolverIncidencia(id, accion, resolucion, fecha = hoyISO()) {
  const inc = buscar('incidencias', id)
  if (inc.estado !== 'abierta') throw new Error('La incidencia ya está resuelta.')
  const h = buscar('herramientas', inc.herramienta_id)
  if (accion === 'baja') {
    h.cantidad_total -= inc.cantidad // se da de baja la unidad
  } else {
    h.cantidad_disponible += inc.cantidad // reparada o repuesta
  }
  Object.assign(inc, { estado: 'resuelta', accion, resolucion, fecha_resolucion: fecha })
}

// ---------- creación de la base de prueba ----------
function crearBaseDePrueba() {
  const hoy = hoyISO()
  db = {
    seq: { numero: 100 },
    talleres: copia(prueba.talleres),
    categorias: copia(prueba.categorias),
    perfiles: copia(prueba.usuarios),
    herramientas: prueba.herramientas.map((h) => ({ ...h, cantidad_disponible: h.cantidad_total, activo: true })),
    prestamos: [],
    devoluciones: [],
    incidencias: [],
    solicitudesPrestamo: [],
    autorizacionesClase: [],
    reposiciones: [],
    tareas: [],
    actas: []
  }
  db.seq.talleres = db.talleres.length
  db.seq.categorias = db.categorias.length
  db.seq.herramientas = db.herramientas.length
  db.seq.perfiles = db.perfiles.length

  // Solicitudes de docentes
  for (const [docente, herr, cant, atras, curso, estado, respuesta] of prueba.solicitudesPrestamo) {
    db.solicitudesPrestamo.push({
      id: nuevoId('solicitudesPrestamo'), docente_id: docente, herramienta_id: herr, cantidad: cant,
      fecha: sumarDias(hoy, -atras), fecha_clase: sumarDias(hoy, -atras + 1), curso,
      motivo: 'Clase práctica', estado, respuesta, prestamo_id: null
    })
  }

  // Préstamos y devoluciones: se "reproducen" en orden para que el stock quede coherente
  const eventos = []
  prueba.prestamos.forEach((fila, i) => {
    const [, , , atras, , dev] = fila
    eventos.push({ dia: -atras, orden: 0, tipo: 'prestamo', i })
    if (dev && dev[0] !== 'cancelado') eventos.push({ dia: -atras + dev[0], orden: 1, tipo: 'devolucion', i })
    if (dev && dev[0] === 'cancelado') eventos.push({ dia: -atras, orden: 1, tipo: 'cancelar', i })
  })
  eventos.sort((a, b) => a.dia - b.dia || a.orden - b.orden)
  const creados = {}
  prueba.prestamos.forEach(([persona], i) => {
    // vincula préstamos de docentes con su solicitud atendida
    const f = prueba.prestamos[i]
    if (persona.startsWith('u4') || persona.startsWith('u5')) {
      const s = db.solicitudesPrestamo.find((x) => x.docente_id === persona && x.herramienta_id === f[1] && x.estado === 'atendida' && !x._usada)
      if (s) { s._usada = true; f._solicitud = s.id }
    }
  })
  for (const ev of eventos) {
    const [persona, herr, cant, atras, plazo, dev] = prueba.prestamos[ev.i]
    const salida = sumarDias(hoy, -atras)
    const panolero = ev.i % 2 === 0 ? 'u2' : 'u3'
    if (ev.tipo === 'prestamo') {
      const sol = prueba.prestamos[ev.i]._solicitud
      creados[ev.i] = _registrarPrestamo(
        { persona_id: persona, herramienta_id: herr, cantidad: cant, fecha_limite: sumarDias(salida, plazo), estado_al_prestar: 'bueno' },
        panolero, salida
      )
      if (sol) {
        const s = db.solicitudesPrestamo.find((x) => x.id === sol)
        s.prestamo_id = creados[ev.i].id
      }
    } else if (ev.tipo === 'devolucion') {
      _registrarDevolucion(creados[ev.i].id, { estado_al_devolver: dev[1], observaciones: dev[2] || '' }, panolero, sumarDias(salida, dev[0]))
    } else {
      const p = creados[ev.i]
      p.estado = 'cancelado'
      p.motivo_cancelacion = 'Error de carga: se registró dos veces.'
      buscar('herramientas', p.herramienta_id).cantidad_disponible += p.cantidad
    }
  }
  db.solicitudesPrestamo.forEach((s) => delete s._usada)

  // Pedidos de alumnos con autorización digital del docente
  const haceHoras = (horas) => new Date(Date.now() - horas * 3600000)
  for (const [alumno, docente, herr, cant, hPedido, estado, hResp, codigo, cantAut, motivo, respuesta] of prueba.solicitudesAlumnos) {
    const pedido = aISO(haceHoras(hPedido))
    const conCodigo = ['autorizada', 'retirada'].includes(estado)
    const s = {
      id: nuevoId('solicitudesPrestamo'), docente_id: docente, alumno_id: alumno, herramienta_id: herr, cantidad: cant,
      fecha: pedido, fecha_clase: pedido, curso: db.perfiles.find((p) => p.id === alumno).curso, motivo, estado, respuesta,
      prestamo_id: null,
      autorizado_por: hResp === null ? null : docente,
      fecha_autorizacion: hResp === null ? null : haceHoras(hResp).toISOString(),
      vence: conCodigo ? haceHoras(hResp - HORAS_VIGENCIA).toISOString() : null, // autorización + 48 h
      codigo_retiro: codigo,
      cantidad_autorizada: cantAut,
      fecha_limite: conCodigo ? sumarDias(hoy, 7) : null
    }
    if (estado === 'retirada') {
      const p = db.prestamos.find((x) => x.persona_id === alumno && x.herramienta_id === herr && x.fecha_salida === hoy)
      if (p) {
        s.prestamo_id = p.id
        p.solicitud_id = s.id
      }
    }
    db.solicitudesPrestamo.push(s)
  }
  for (const [docente, curso, herr, cant, dias] of prueba.autorizacionesClase) {
    db.autorizacionesClase.push({
      id: nuevoId('autorizacionesClase'), docente_id: docente, curso, herramienta_id: herr,
      cantidad_por_alumno: cant, fecha: sumarDias(hoy, dias), estado: 'activa', creado: new Date().toISOString()
    })
  }

  // Una incidencia resuelta (martillo dado de baja) y otra cargada sin préstamo
  const incMartillo = db.incidencias.find((x) => x.herramienta_id === 7)
  if (incMartillo) _resolverIncidencia(incMartillo.id, 'baja', 'Sin arreglo posible. Se repuso por compra.', sumarDias(hoy, -79))
  const amoladora = buscar('herramientas', 10)
  amoladora.cantidad_disponible -= 1
  db.incidencias.push({
    id: nuevoId('incidencias'), tipo: 'rotura', herramienta_id: 10, prestamo_id: null, responsable_id: null,
    cantidad: 1, fecha: sumarDias(hoy, -51), descripcion: 'Falla del motor detectada en revisión del pañol.',
    estado: 'abierta', accion: null, resolucion: '', fecha_resolucion: null
  })

  // Reposiciones (la recibida suma al stock)
  for (const [herr, cant, quien, atras, motivo, estado, respuesta] of prueba.reposiciones) {
    db.reposiciones.push({ id: nuevoId('reposiciones'), herramienta_id: herr, cantidad: cant, solicitante_id: quien, fecha: sumarDias(hoy, -atras), motivo, estado, respuesta })
    if (estado === 'recibida') {
      const h = buscar('herramientas', herr)
      h.cantidad_total += cant
      h.cantidad_disponible += cant
    }
  }

  for (const [codigo, comision, descripcion, limite, completada] of prueba.tareas) {
    db.tareas.push({
      id: nuevoId('tareas'), codigo_integrante: codigo, comision, descripcion,
      fecha_limite: sumarDias(hoy, limite),
      fecha_completada: completada === null ? null : sumarDias(hoy, completada),
      estado: completada === null ? 'pendiente' : 'completada'
    })
  }

  for (const [atras, participantes, temas, decisiones, responsables] of prueba.actas) {
    db.actas.push({ id: nuevoId('actas'), fecha: sumarDias(hoy, -atras), participantes, temas, decisiones, responsables })
  }
  return db
}

export function reiniciarDatosDePrueba() {
  db = crearBaseDePrueba()
  guardar()
}

// ---------- uniones para devolver datos "listos para mostrar" ----------
function nombrePersona(id) {
  return db.perfiles.find((p) => p.id === id)?.nombre || '—'
}

function unirHerramienta(h) {
  return {
    ...h,
    categoria_nombre: db.categorias.find((c) => c.id === h.categoria_id)?.nombre || '—',
    taller_nombre: db.talleres.find((t) => t.id === h.taller_id)?.nombre || '—'
  }
}

function unirPrestamo(p) {
  const h = db.herramientas.find((x) => x.id === p.herramienta_id) || {}
  const persona = db.perfiles.find((x) => x.id === p.persona_id) || {}
  const d = db.devoluciones.find((x) => x.prestamo_id === p.id) || null
  return {
    ...p,
    persona_nombre: persona.nombre || '—',
    persona_dni: persona.dni || '',
    herramienta_codigo: h.codigo,
    herramienta_nombre: h.nombre,
    panolero_nombre: nombrePersona(p.panolero_id),
    devolucion: d ? { ...d } : null
  }
}

// ---------- API pública (misma forma que supabaseApi.js) ----------
export async function iniciarSesion(usuario) {
  await esperar()
  cargar()
  const u = db.perfiles.find((p) => p.dni === String(usuario).trim())
  if (!u) throw new Error('No existe un usuario de prueba con ese DNI.')
  if (!u.activo) throw new Error('Tu cuenta todavía no fue activada por el administrador.')
  localStorage.setItem(CLAVE_SESION, u.id)
  return copia(u)
}

export async function sesionActual() {
  cargar()
  const u = usuarioActual()
  return u ? copia(u) : null
}

export async function cerrarSesion() {
  localStorage.removeItem(CLAVE_SESION)
}

export async function usuariosDePrueba() {
  cargar()
  return copia(db.perfiles.filter((p) => p.activo))
}

// Talleres y categorías
export async function listarTalleres() {
  cargar()
  return copia(db.talleres)
}
export async function listarCategorias() {
  cargar()
  return copia(db.categorias)
}
export async function guardarTaller(t) {
  await esperar(); exigir('admin')
  if (t.id) Object.assign(buscar('talleres', t.id), t)
  else db.talleres.push({ ...t, id: nuevoId('talleres'), activo: true })
  guardar()
}
export async function guardarCategoria(c) {
  await esperar(); exigir('admin')
  if (c.id) Object.assign(buscar('categorias', c.id), c)
  else db.categorias.push({ ...c, id: nuevoId('categorias'), activo: true })
  guardar()
}

// Herramientas y materiales
export async function listarHerramientas() {
  await esperar(); cargar()
  return copia(db.herramientas.map(unirHerramienta))
}
export async function guardarHerramienta(h) {
  await esperar(); exigir('admin')
  if (db.herramientas.some((x) => x.codigo === h.codigo && x.id !== h.id)) throw new Error('Ya existe una herramienta con ese código.')
  if (h.id) {
    const actual = buscar('herramientas', h.id)
    const prestadas = actual.cantidad_total - actual.cantidad_disponible
    if (h.cantidad_total < prestadas) throw new Error(`No se puede bajar el total a menos de ${prestadas} (unidades prestadas o fuera de stock).`)
    Object.assign(actual, h, { cantidad_disponible: h.cantidad_total - prestadas })
  } else {
    db.herramientas.push({ ...h, id: nuevoId('herramientas'), cantidad_disponible: h.cantidad_total, activo: true })
  }
  guardar()
}
// Baja lógica: no se borra para conservar el historial de préstamos
export async function cambiarActivoHerramienta(id, activo) {
  await esperar(); exigir('admin')
  buscar('herramientas', id).activo = activo
  guardar()
}
export async function ajustarStock(id, { cantidad_disponible, estado_general }) {
  await esperar(); exigir('admin', 'panolero')
  const h = buscar('herramientas', id)
  if (cantidad_disponible < 0 || cantidad_disponible > h.cantidad_total) throw new Error('La cantidad disponible debe estar entre 0 y el total.')
  Object.assign(h, { cantidad_disponible, estado_general })
  guardar()
}

// Usuarios
export async function listarUsuarios() {
  await esperar(); exigir('admin', 'panolero')
  return copia(db.perfiles)
}
export async function guardarUsuario(u) {
  await esperar()
  const yo = exigir('admin')
  if (db.perfiles.some((p) => p.dni === u.dni && p.id !== u.id)) throw new Error('Ya existe un usuario con ese DNI.')
  if (u.id === yo.id && (u.rol !== 'admin' || !u.activo)) throw new Error('No podés quitarte el rol de administrador ni desactivarte.')
  if (u.id) Object.assign(buscar('perfiles', u.id), u)
  else db.perfiles.push({ ...u, id: 'u' + nuevoId('perfiles') })
  guardar()
}

// Préstamos
export async function listarPrestamos() {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente', 'alumno')
  let lista = db.prestamos
  if (u.rol === 'docente') lista = lista.filter((p) => u.cursos.includes(p.curso) || p.persona_id === u.id)
  if (u.rol === 'alumno') lista = lista.filter((p) => p.persona_id === u.id)
  return copia(lista.map(unirPrestamo))
}
export async function obtenerPrestamo(id) {
  const lista = await listarPrestamos()
  const p = lista.find((x) => x.id === Number(id))
  if (!p) throw new Error('No se encontró el préstamo.')
  return p
}
export async function registrarPrestamo(datos) {
  await esperar()
  const u = exigir('panolero', 'admin')
  const p = _registrarPrestamo(datos, u.id, hoyISO(), true)
  guardar()
  return p.numero
}
// Un préstamo nunca se borra: se cancela y queda en el historial
export async function cancelarPrestamo(id, motivo) {
  await esperar(); exigir('panolero', 'admin')
  const p = buscar('prestamos', id)
  if (p.estado !== 'activo') throw new Error('Solo se pueden cancelar préstamos activos.')
  p.estado = 'cancelado'
  p.motivo_cancelacion = motivo
  buscar('herramientas', p.herramienta_id).cantidad_disponible += p.cantidad
  guardar()
}
export async function registrarDevolucion(prestamoId, datos) {
  await esperar()
  const u = exigir('panolero', 'admin')
  _registrarDevolucion(prestamoId, datos, u.id)
  guardar()
}

// Incidencias
export async function listarIncidencias() {
  await esperar(); exigir('admin', 'panolero')
  return copia(db.incidencias.map((i) => {
    const h = db.herramientas.find((x) => x.id === i.herramienta_id) || {}
    return {
      ...i,
      herramienta_codigo: h.codigo,
      herramienta_nombre: h.nombre,
      responsable_nombre: i.responsable_id ? nombrePersona(i.responsable_id) : 'Sin responsable',
      prestamo_numero: db.prestamos.find((p) => p.id === i.prestamo_id)?.numero || null
    }
  }))
}
export async function registrarIncidencia(datos) {
  await esperar(); exigir('admin', 'panolero')
  const h = buscar('herramientas', datos.herramienta_id)
  if (h.cantidad_disponible < datos.cantidad) throw new Error('No hay tantas unidades disponibles para marcar como rotas o perdidas.')
  h.cantidad_disponible -= Number(datos.cantidad)
  db.incidencias.push({
    id: nuevoId('incidencias'), tipo: datos.tipo, herramienta_id: h.id, prestamo_id: null,
    responsable_id: datos.responsable_id || null, cantidad: Number(datos.cantidad), fecha: hoyISO(),
    descripcion: datos.descripcion, estado: 'abierta', accion: null, resolucion: '', fecha_resolucion: null
  })
  guardar()
}
export async function resolverIncidencia(id, accion, resolucion) {
  await esperar(); exigir('admin')
  _resolverIncidencia(id, accion, resolucion)
  guardar()
}

// Solicitudes de préstamo (docentes)
export async function listarSolicitudes() {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente')
  let lista = db.solicitudesPrestamo.filter((s) => !s.alumno_id) // solo las de docentes
  if (u.rol === 'docente') lista = lista.filter((s) => s.docente_id === u.id)
  return copia(lista.map((s) => {
    const h = db.herramientas.find((x) => x.id === s.herramienta_id) || {}
    return { ...s, docente_nombre: nombrePersona(s.docente_id), herramienta_codigo: h.codigo, herramienta_nombre: h.nombre }
  }))
}
export async function crearSolicitud(datos) {
  await esperar()
  const u = exigir('docente')
  db.solicitudesPrestamo.push({ ...datos, id: nuevoId('solicitudesPrestamo'), docente_id: u.id, fecha: hoyISO(), estado: 'pendiente', respuesta: '', prestamo_id: null })
  guardar()
}
export async function cambiarEstadoSolicitud(id, estado, respuesta = '') {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente')
  const s = buscar('solicitudesPrestamo', id)
  if (s.alumno_id) throw new Error('Los pedidos de alumnos se responden desde "Autorizar pedidos".')
  if (s.estado !== 'pendiente') throw new Error('La solicitud ya fue respondida.')
  if (u.rol === 'docente' && (s.docente_id !== u.id || estado !== 'cancelada')) throw new Error('Solo podés cancelar tus propias solicitudes.')
  Object.assign(s, { estado, respuesta })
  guardar()
}

// ---------- Autorización digital del docente (reemplaza la notita en papel) ----------
// Misma lógica que las funciones SQL autorizar_solicitud, rechazar_solicitud,
// crear_autorizacion_clase y cancelar_autorizacion_clase.
function generarCodigoRetiro() {
  let codigo
  do {
    codigo = ''
    for (let i = 0; i < 4; i++) codigo += LETRAS_CODIGO[Math.floor(Math.random() * LETRAS_CODIGO.length)]
  } while (db.solicitudesPrestamo.some((s) => s.codigo_retiro === codigo && s.estado === 'autorizada'))
  return codigo
}

function estaVencida(s) {
  return s.estado === 'autorizada' && new Date(s.vence) < new Date()
}

function unirSolicitudAlumno(s) {
  const h = db.herramientas.find((x) => x.id === s.herramienta_id) || {}
  const alumno = db.perfiles.find((x) => x.id === s.alumno_id) || {}
  return {
    ...s,
    alumno_nombre: alumno.nombre || '—',
    alumno_dni: alumno.dni || '',
    docente_nombre: nombrePersona(s.docente_id),
    autorizado_por_nombre: s.autorizado_por ? nombrePersona(s.autorizado_por) : null,
    herramienta_codigo: h.codigo,
    herramienta_nombre: h.nombre,
    prestamo_numero: db.prestamos.find((p) => p.id === s.prestamo_id)?.numero || null
  }
}

// Docentes activos (sin DNI): el alumno elige al que tiene su curso
export async function listarDocentes() {
  await esperar(); exigir('admin', 'panolero', 'docente', 'alumno')
  return copia(db.perfiles.filter((p) => p.rol === 'docente' && p.activo).map(({ id, nombre, cursos }) => ({ id, nombre, cursos })))
}

// Alumno: las suyas | docente: las de sus cursos | pañolero y admin: todas
export async function listarSolicitudesAlumnos() {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente', 'alumno')
  let lista = db.solicitudesPrestamo.filter((s) => s.alumno_id)
  if (u.rol === 'alumno') lista = lista.filter((s) => s.alumno_id === u.id)
  if (u.rol === 'docente') lista = lista.filter((s) => u.cursos.includes(s.curso) || s.docente_id === u.id)
  return copia(lista.map(unirSolicitudAlumno).sort((a, b) => b.id - a.id))
}

export async function crearSolicitudAlumno(datos) {
  await esperar()
  const u = exigir('alumno')
  if (!u.curso) throw new Error('Tu perfil no tiene curso asignado. Pedile al administrador que lo cargue.')
  const docente = db.perfiles.find((p) => p.id === datos.docente_id && p.rol === 'docente' && p.activo)
  if (!docente || !docente.cursos.includes(u.curso)) throw new Error('Elegí un docente que tenga a cargo tu curso.')
  const h = buscar('herramientas', datos.herramienta_id)
  if (!h.activo) throw new Error('La herramienta está dada de baja.')
  const cantidad = Number(datos.cantidad)
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > h.cantidad_total) throw new Error(`La cantidad debe estar entre 1 y ${h.cantidad_total}.`)
  const motivo = String(datos.motivo || '').trim()
  if (motivo.length < 5 || motivo.length > 200) throw new Error('El motivo debe tener entre 5 y 200 caracteres.')
  db.solicitudesPrestamo.push({
    id: nuevoId('solicitudesPrestamo'), docente_id: docente.id, alumno_id: u.id, herramienta_id: h.id, cantidad,
    fecha: hoyISO(), fecha_clase: hoyISO(), curso: u.curso, motivo, estado: 'esperando_autorizacion', respuesta: '',
    prestamo_id: null, autorizado_por: null, fecha_autorizacion: null, vence: null, codigo_retiro: null,
    cantidad_autorizada: null, fecha_limite: null
  })
  guardar()
}

// El alumno solo puede cancelar las suyas mientras esperan o están autorizadas (no vencidas)
export async function cancelarSolicitudAlumno(id) {
  await esperar()
  const u = exigir('alumno')
  const s = buscar('solicitudesPrestamo', id)
  if (s.alumno_id !== u.id) throw new Error('No tenés permiso para realizar esta operación.')
  if (!['esperando_autorizacion', 'autorizada'].includes(s.estado) || estaVencida(s)) {
    throw new Error('Solo podés cancelar pedidos que esperan autorización o que están autorizados y vigentes.')
  }
  s.estado = 'cancelada'
  guardar()
}

// El docente autoriza: puede bajar la cantidad y cambiar el plazo. Devuelve el código de retiro.
export async function autorizarSolicitud(id, cantidad, fechaLimite) {
  await esperar()
  const u = exigir('docente')
  const s = buscar('solicitudesPrestamo', id)
  if (!s.alumno_id) throw new Error('La solicitud no existe.')
  if (!u.cursos.includes(s.curso)) throw new Error('Solo podés autorizar pedidos de alumnos de tus cursos.')
  if (s.estado !== 'esperando_autorizacion') throw new Error('Esta solicitud ya fue resuelta.')
  const n = Number(cantidad)
  if (!Number.isInteger(n) || n < 1 || n > s.cantidad) throw new Error(`La cantidad autorizada debe estar entre 1 y ${s.cantidad} (lo que pidió el alumno).`)
  if (!fechaLimite || fechaLimite < hoyISO()) throw new Error('La fecha de devolución no puede ser anterior a hoy.')
  if (fechaLimite > sumarDias(hoyISO(), 60)) throw new Error('El plazo máximo de devolución es de 60 días.')
  const ahora = new Date()
  Object.assign(s, {
    estado: 'autorizada',
    cantidad_autorizada: n,
    fecha_limite: fechaLimite,
    autorizado_por: u.id,
    fecha_autorizacion: ahora.toISOString(),
    vence: new Date(ahora.getTime() + HORAS_VIGENCIA * 3600000).toISOString(),
    codigo_retiro: generarCodigoRetiro()
  })
  guardar()
  return s.codigo_retiro
}

export async function rechazarSolicitud(id, motivo) {
  await esperar()
  const u = exigir('docente')
  const texto = String(motivo || '').trim()
  if (texto.length < 5 || texto.length > 200) throw new Error('Escribí el motivo del rechazo (entre 5 y 200 caracteres).')
  const s = buscar('solicitudesPrestamo', id)
  if (!s.alumno_id) throw new Error('La solicitud no existe.')
  if (!u.cursos.includes(s.curso)) throw new Error('Solo podés responder pedidos de alumnos de tus cursos.')
  if (s.estado !== 'esperando_autorizacion') throw new Error('Esta solicitud ya fue resuelta.')
  Object.assign(s, { estado: 'rechazada', respuesta: texto, autorizado_por: u.id, fecha_autorizacion: new Date().toISOString() })
  guardar()
}

// Autorizaciones de clase. "retirados" = alumnos que ya retiraron con ella (préstamos no cancelados)
export async function listarAutorizacionesClase() {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente')
  let lista = db.autorizacionesClase
  if (u.rol === 'docente') lista = lista.filter((a) => a.docente_id === u.id)
  return copia(lista.map((a) => {
    const h = db.herramientas.find((x) => x.id === a.herramienta_id) || {}
    return {
      ...a,
      docente_nombre: nombrePersona(a.docente_id),
      herramienta_codigo: h.codigo,
      herramienta_nombre: h.nombre,
      retirados: db.prestamos.filter((p) => p.autorizacion_clase_id === a.id && p.estado !== 'cancelado').map((p) => p.persona_id)
    }
  }).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id))
}

export async function crearAutorizacionClase(datos) {
  await esperar()
  const u = exigir('docente')
  if (!u.cursos.includes(datos.curso)) throw new Error('Solo podés autorizar a tus cursos.')
  const h = buscar('herramientas', datos.herramienta_id)
  if (!h.activo) throw new Error('La herramienta está dada de baja.')
  const n = Number(datos.cantidad_por_alumno)
  if (!Number.isInteger(n) || n < 1 || n > h.cantidad_total) throw new Error(`La cantidad por alumno debe estar entre 1 y ${h.cantidad_total}.`)
  if (n > h.cantidad_disponible) throw new Error(`Stock insuficiente: hay ${h.cantidad_disponible} disponibles de "${h.nombre}".`)
  if (!datos.fecha || datos.fecha < hoyISO()) throw new Error('La fecha no puede ser anterior a hoy.')
  if (db.autorizacionesClase.some((a) => a.docente_id === u.id && a.curso === datos.curso && a.herramienta_id === h.id && a.fecha === datos.fecha && a.estado === 'activa')) {
    throw new Error('Ya tenés una autorización de clase activa igual para ese día.')
  }
  db.autorizacionesClase.push({
    id: nuevoId('autorizacionesClase'), docente_id: u.id, curso: datos.curso, herramienta_id: h.id,
    cantidad_por_alumno: n, fecha: datos.fecha, estado: 'activa', creado: new Date().toISOString()
  })
  guardar()
}

export async function cancelarAutorizacionClase(id) {
  await esperar()
  const u = exigir('docente')
  const a = buscar('autorizacionesClase', id)
  if (a.docente_id !== u.id) throw new Error('La autorización no existe o no es tuya.')
  if (a.estado !== 'activa') throw new Error('La autorización ya estaba cancelada.')
  a.estado = 'cancelada'
  guardar()
}

// Solicitudes de reposición
export async function listarReposiciones() {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente')
  let lista = db.reposiciones
  if (u.rol === 'docente') lista = lista.filter((r) => r.solicitante_id === u.id)
  return copia(lista.map((r) => {
    const h = db.herramientas.find((x) => x.id === r.herramienta_id) || {}
    return { ...r, solicitante_nombre: nombrePersona(r.solicitante_id), herramienta_codigo: h.codigo, herramienta_nombre: h.nombre }
  }))
}
export async function crearReposicion(datos) {
  await esperar()
  const u = exigir('admin', 'panolero', 'docente')
  db.reposiciones.push({ ...datos, id: nuevoId('reposiciones'), solicitante_id: u.id, fecha: hoyISO(), estado: 'pendiente', respuesta: '' })
  guardar()
}
export async function actualizarReposicion(id, estado, respuesta = '') {
  await esperar(); exigir('admin')
  const r = buscar('reposiciones', id)
  const permitido = { pendiente: ['aprobada', 'rechazada'], aprobada: ['recibida', 'rechazada'] }
  if (!(permitido[r.estado] || []).includes(estado)) throw new Error('Ese cambio de estado no está permitido.')
  if (estado === 'recibida') {
    const h = buscar('herramientas', r.herramienta_id)
    h.cantidad_total += r.cantidad
    h.cantidad_disponible += r.cantidad
  }
  Object.assign(r, { estado, respuesta })
  guardar()
}

// Tareas (KPI 4)
export async function listarTareas() {
  await esperar(); exigir('admin', 'panolero', 'docente')
  return copia(db.tareas)
}
export async function guardarTarea(t) {
  await esperar(); exigir('admin')
  if (t.id) Object.assign(buscar('tareas', t.id), t)
  else db.tareas.push({ ...t, id: nuevoId('tareas'), estado: 'pendiente', fecha_completada: null })
  guardar()
}
export async function cambiarEstadoTarea(id, estado) {
  await esperar(); exigir('admin')
  const t = buscar('tareas', id)
  t.estado = estado
  t.fecha_completada = estado === 'completada' ? hoyISO() : null
  guardar()
}

// Actas (Reglamento, Cap. VI)
export async function listarActas() {
  await esperar(); exigir('admin', 'panolero', 'docente')
  return copia(db.actas)
}
export async function guardarActa(a) {
  await esperar(); exigir('admin')
  if (a.id) Object.assign(buscar('actas', a.id), a)
  else db.actas.push({ ...a, id: nuevoId('actas') })
  guardar()
}

// Conteos para KPI (en Supabase los calcula la función SQL kpi_mes, que no expone datos personales)
export async function conteosKpi(mes) {
  await esperar(); exigir('admin', 'panolero', 'docente')
  return contarKpi({ herramientas: db.herramientas, incidencias: db.incidencias, prestamos: db.prestamos.map(unirPrestamo), solicitudes: db.solicitudesPrestamo, tareas: db.tareas }, mes)
}
