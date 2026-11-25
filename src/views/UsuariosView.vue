<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api, MODO_DEMO } from '../services/api'
import { sesion } from '../store/sesion'
import { ejecutar } from '../store/ui'
import { ROLES } from '../services/permisos'
import { coincide } from '../utils/estados'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const usuarios = ref([])
const talleres = ref([])
const filtro = reactive({ texto: '', rol: '', activo: '' })

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [u, t] = await Promise.all([api.listarUsuarios(), api.listarTalleres()])
    usuarios.value = u
    talleres.value = t
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtrados = computed(() =>
  usuarios.value
    .filter((u) => !filtro.rol || u.rol === filtro.rol)
    .filter((u) => filtro.activo === '' || String(u.activo) === filtro.activo)
    .filter((u) => !filtro.texto || coincide(`${u.nombre} ${u.dni} ${u.curso || ''}`, filtro.texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
)

const modal = ref(false)
const form = reactive({})
const errores = ref({})
const guardando = ref(false)

function abrir(u = null) {
  Object.assign(form, u
    ? { ...u, cursosTexto: (u.cursos || []).join(', ') }
    : { id: null, nombre: '', dni: '', rol: 'alumno', curso: '', cursosTexto: '', taller_id: '', activo: true })
  errores.value = {}
  modal.value = true
}

async function guardar() {
  const cursos = form.cursosTexto.split(',').map((c) => c.trim()).filter(Boolean)
  errores.value = v.juntarErrores({
    nombre: [v.obligatorio(form.nombre, 'El nombre'), v.largo(form.nombre, { min: 3, max: 80, nombre: 'El nombre' })],
    dni: [v.dni(form.dni)],
    rol: [v.unoDe(form.rol, Object.keys(ROLES), 'El rol')],
    curso: form.rol === 'alumno' ? [v.obligatorio(form.curso, 'El curso')] : [],
    cursosTexto: form.rol === 'docente' && !cursos.length ? ['Indicá al menos un curso.'] : []
  })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  const datos = {
    id: form.id, nombre: form.nombre.trim(), dni: String(form.dni).trim(), rol: form.rol, activo: form.activo,
    curso: form.rol === 'alumno' ? form.curso.trim() : null,
    cursos: form.rol === 'docente' ? cursos : [],
    taller_id: form.taller_id ? Number(form.taller_id) : null
  }
  const ok = await ejecutar(() => api.guardarUsuario(datos), form.id ? 'Usuario actualizado.' : 'Usuario creado.')
  guardando.value = false
  if (ok) {
    modal.value = false
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Usuarios y roles</h1>
        <p>Solo el administrador crea usuarios o cambia roles. Los usuarios no se borran: se desactivan.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button class="primario" @click="abrir()">+ Nuevo usuario</button>
      </div>
    </div>

    <div v-if="!MODO_DEMO" class="aviso info">
      Las cuentas (correo y contraseña) se crean desde el panel de Supabase → Authentication. Al crearse aparecen acá como
      <strong>alumno inactivo</strong>, y desde esta pantalla se les asigna rol y se activan. Así ninguna clave de administración queda en la aplicación.
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por nombre, DNI o curso" aria-label="Buscar" />
      <select v-model="filtro.rol" aria-label="Rol">
        <option value="">Todos los roles</option>
        <option v-for="(t, k) in ROLES" :key="k" :value="k">{{ t }}</option>
      </select>
      <select v-model="filtro.activo" aria-label="Estado">
        <option value="">Activos e inactivos</option>
        <option value="true">Activos</option>
        <option value="false">Inactivos</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead><tr><th>Nombre</th><th>DNI</th><th>Rol</th><th>Curso(s) / taller</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>
          <tr v-for="u in filtrados" :key="u.id" :class="{ inactiva: !u.activo }">
            <td data-label="Nombre">{{ u.nombre }}</td>
            <td data-label="DNI">{{ u.dni }}</td>
            <td data-label="Rol">{{ ROLES[u.rol] }}</td>
            <td data-label="Curso(s) / taller">
              {{ u.curso || (u.cursos || []).join(', ') || talleres.find((t) => t.id === u.taller_id)?.nombre || '—' }}
            </td>
            <td data-label="Estado"><EstadoBadge :estado="u.activo ? 'activo' : 'inactivo'" /></td>
            <td data-label="Acción"><button class="chico" @click="abrir(u)">Editar</button></td>
          </tr>
          <tr v-if="!filtrados.length"><td class="vacio" colspan="6">No hay usuarios con esos filtros.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="modal" :titulo="form.id ? 'Editar usuario' : 'Nuevo usuario'" @cerrar="modal = false">
      <form class="formulario" novalidate @submit.prevent="guardar">
        <div class="fila-campos">
          <Campo etiqueta="Nombre y apellido" para="u-n" :error="errores.nombre" obligatorio>
            <input id="u-n" v-model="form.nombre" maxlength="80" />
          </Campo>
          <Campo etiqueta="DNI" para="u-d" :error="errores.dni" obligatorio ayuda="Sin puntos">
            <input id="u-d" v-model="form.dni" inputmode="numeric" maxlength="8" />
          </Campo>
        </div>
        <div class="fila-campos">
          <Campo etiqueta="Rol" para="u-r" :error="errores.rol" obligatorio>
            <select id="u-r" v-model="form.rol" :disabled="form.id === sesion.usuario.id">
              <option v-for="(t, k) in ROLES" :key="k" :value="k">{{ t }}</option>
            </select>
          </Campo>
          <Campo v-if="form.rol === 'alumno'" etiqueta="Curso" para="u-c" :error="errores.curso" obligatorio>
            <input id="u-c" v-model="form.curso" maxlength="10" placeholder="Ej.: 5°1" />
          </Campo>
          <Campo v-if="form.rol === 'docente'" etiqueta="Cursos a cargo" para="u-cs" :error="errores.cursosTexto" obligatorio ayuda="Separados por coma">
            <input id="u-cs" v-model="form.cursosTexto" placeholder="5°1, 5°2" />
          </Campo>
          <Campo v-if="form.rol === 'panolero' || form.rol === 'docente'" etiqueta="Taller" para="u-t">
            <select id="u-t" v-model="form.taller_id">
              <option value="">Sin taller fijo</option>
              <option v-for="t in talleres" :key="t.id" :value="t.id">{{ t.nombre }}</option>
            </select>
          </Campo>
        </div>
        <label style="display: flex; gap: 0.5rem; align-items: center">
          <input v-model="form.activo" type="checkbox" style="width: auto; min-height: auto" :disabled="form.id === sesion.usuario.id" />
          Usuario activo (puede ingresar al sistema)
        </label>
        <div class="acciones">
          <button type="button" @click="modal = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
