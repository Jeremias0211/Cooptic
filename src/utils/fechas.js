// Todas las fechas se guardan como texto 'AAAA-MM-DD' (fecha local, sin hora).

function dosDigitos(n) {
  return String(n).padStart(2, '0')
}

export function aISO(fecha) {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`
}

export function hoyISO() {
  return aISO(new Date())
}

export function desdeISO(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function sumarDias(iso, dias) {
  const f = desdeISO(iso)
  f.setDate(f.getDate() + dias)
  return aISO(f)
}

export function diferenciaDias(desdeIso, hastaIso) {
  return Math.round((desdeISO(hastaIso) - desdeISO(desdeIso)) / 86400000)
}

export function formatear(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Fecha y hora de un timestamp (ej. vencimiento de una autorización): 'dd/mm/aaaa hh:mm'
export function formatearFechaHora(iso) {
  if (!iso) return '—'
  const f = new Date(iso)
  return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()} ${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`
}

// Horas que faltan hasta un timestamp (negativo si ya pasó)
export function horasHasta(iso) {
  return Math.floor((new Date(iso) - new Date()) / 3600000)
}

export function mesActual() {
  return hoyISO().slice(0, 7)
}

// Devuelve [primerDia, ultimoDia] de un mes 'AAAA-MM'
export function rangoMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return [aISO(new Date(a, m - 1, 1)), aISO(new Date(a, m, 0))]
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreMes(mes) {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

// Últimos n meses, del más reciente al más antiguo
export function ultimosMeses(n) {
  const lista = []
  const f = new Date()
  f.setDate(1)
  for (let i = 0; i < n; i++) {
    lista.push(aISO(f).slice(0, 7))
    f.setMonth(f.getMonth() - 1)
  }
  return lista
}
