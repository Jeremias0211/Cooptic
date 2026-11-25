// Validaciones de formularios. Cada función devuelve un texto de error o '' si está bien.
import { hoyISO } from './fechas'

export function obligatorio(valor, nombre = 'Este campo') {
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return `${nombre} es obligatorio.`
  }
  return ''
}

export function dni(valor) {
  if (!/^\d{7,8}$/.test(String(valor || '').trim())) return 'El DNI debe tener 7 u 8 números, sin puntos.'
  return ''
}

export function entero(valor, { min = 0, max = Infinity, nombre = 'La cantidad' } = {}) {
  const n = Number(valor)
  if (!Number.isInteger(n)) return `${nombre} debe ser un número entero.`
  if (n < min) return `${nombre} debe ser como mínimo ${min}.`
  if (n > max) return `${nombre} no puede superar ${max}.`
  return ''
}

export function fechaFutura(valor, nombre = 'La fecha') {
  if (!valor) return `${nombre} es obligatoria.`
  if (valor < hoyISO()) return `${nombre} no puede ser anterior a hoy.`
  return ''
}

export function codigo(valor) {
  if (!/^[A-Z]{1,3}-\d{3}$/.test(String(valor || '').trim())) return 'Formato de código: letras, guion y 3 números (ej. H-021).'
  return ''
}

// Código de retiro: 4 caracteres, letras mayúsculas y números, sin 0/O ni 1/I
export function codigoRetiro(valor) {
  if (!/^[A-HJ-NP-Z2-9]{4}$/.test(String(valor || '').trim().toUpperCase())) {
    return 'El código de retiro tiene 4 caracteres: letras y números (sin 0, O, 1 ni I).'
  }
  return ''
}

export function largo(valor, { min = 0, max = 500, nombre = 'El texto' } = {}) {
  const t = String(valor || '').trim()
  if (t.length < min) return `${nombre} debe tener al menos ${min} caracteres.`
  if (t.length > max) return `${nombre} no puede superar ${max} caracteres.`
  return ''
}

export function unoDe(valor, permitidos, nombre = 'El valor') {
  if (!permitidos.includes(valor)) return `${nombre} no es válido.`
  return ''
}

// Ejecuta un objeto { campo: [errorOVacio, ...] } y devuelve solo los campos con error
export function juntarErrores(reglas) {
  const errores = {}
  for (const [campo, resultados] of Object.entries(reglas)) {
    const primero = resultados.find((r) => r)
    if (primero) errores[campo] = primero
  }
  return errores
}
