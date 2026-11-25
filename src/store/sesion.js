// Estado de la sesión compartido por toda la app (sin Pinia, con reactive de Vue)
import { reactive } from 'vue'
import { api } from '../services/api'
import { puede } from '../services/permisos'

export const sesion = reactive({
  usuario: null // { id, nombre, dni, rol, curso, cursos, ... }
})

export async function iniciarSesionGuardada() {
  try {
    sesion.usuario = await api.sesionActual()
  } catch {
    sesion.usuario = null
  }
}

export async function ingresar(usuario, contrasena) {
  sesion.usuario = await api.iniciarSesion(usuario, contrasena)
  return sesion.usuario
}

export async function salir() {
  await api.cerrarSesion()
  sesion.usuario = null
}

export function tiene(permiso) {
  return puede(sesion.usuario?.rol, permiso)
}
