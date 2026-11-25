// Mensajes de confirmación, error y diálogos de "¿Estás seguro?"
import { reactive } from 'vue'

export const ui = reactive({
  avisos: [], // { id, tipo: 'exito' | 'error' | 'info', texto }
  dialogo: null // { titulo, texto, textoBoton, peligro, resolver }
})

let contador = 0

export function avisar(texto, tipo = 'exito') {
  const id = ++contador
  ui.avisos.push({ id, tipo, texto })
  setTimeout(() => cerrarAviso(id), tipo === 'error' ? 7000 : 4000)
}

export function cerrarAviso(id) {
  ui.avisos = ui.avisos.filter((a) => a.id !== id)
}

export function confirmar({ titulo = '¿Confirmás?', texto = '', textoBoton = 'Confirmar', peligro = false } = {}) {
  return new Promise((resolver) => {
    ui.dialogo = { titulo, texto, textoBoton, peligro, resolver }
  })
}

export function responderDialogo(valor) {
  if (ui.dialogo) ui.dialogo.resolver(valor)
  ui.dialogo = null
}

// Ejecuta una operación mostrando el resultado. Devuelve true si salió bien.
export async function ejecutar(operacion, mensajeExito) {
  try {
    await operacion()
    if (mensajeExito) avisar(mensajeExito, 'exito')
    return true
  } catch (e) {
    avisar(e.message || 'Ocurrió un error inesperado.', 'error')
    return false
  }
}
