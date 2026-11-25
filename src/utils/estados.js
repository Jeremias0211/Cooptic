import { hoyISO } from './fechas'

// "Vencido" no se guarda: se calcula comparando la fecha límite con hoy
export function estadoPrestamo(p) {
  if (p.estado === 'activo' && p.fecha_limite < hoyISO()) return 'vencido'
  return p.estado
}

// Pedido de alumno: "vencida" tampoco se guarda. Una autorizada que pasó las 48 h
// sin retirarse se muestra vencida comparando "vence" con la fecha y hora actuales.
export function estadoSolicitud(s) {
  if (s.estado === 'autorizada' && s.vence && new Date(s.vence) < new Date()) return 'vencida'
  return s.estado
}

// Autorización de clase: vale solo el día indicado
export function estadoAutorizacionClase(a) {
  if (a.estado === 'activa' && a.fecha < hoyISO()) return 'vencida'
  return a.estado
}

export function estadoStock(h) {
  if (!h.activo) return 'baja'
  if (h.cantidad_disponible === 0) return 'sin_stock'
  if (h.cantidad_disponible <= h.stock_minimo) return 'stock_bajo'
  return 'disponible'
}

export function estadoTarea(t) {
  if (t.estado === 'pendiente' && t.fecha_limite < hoyISO()) return 'atrasada'
  return t.estado
}

// Busca un texto ignorando mayúsculas y tildes
export function coincide(texto, busqueda) {
  const limpiar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return limpiar(texto).includes(limpiar(busqueda))
}
