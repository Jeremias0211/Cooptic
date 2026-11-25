<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { sesion, tiene } from '../store/sesion'
import { ejecutar } from '../store/ui'
import { estadoPrestamo, coincide } from '../utils/estados'
import { formatear } from '../utils/fechas'
import * as v from '../utils/validar'

const ruta = useRoute()
const cargando = ref(true)
const error = ref('')
const prestamos = ref([])
const filtro = reactive({ texto: '', estado: ruta.query.estado || '', curso: '' })
const gestiona = tiene('gestionarPrestamos')
const esAlumno = sesion.usuario.rol === 'alumno'

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    prestamos.value = (await api.listarPrestamos()).map((p) => ({ ...p, estado_visible: estadoPrestamo(p) }))
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const cursos = computed(() => [...new Set(prestamos.value.map((p) => p.curso).filter(Boolean))].sort())

const filtrados = computed(() =>
  prestamos.value
    .filter((p) => {
      if (filtro.estado && p.estado_visible !== filtro.estado) return false
      if (filtro.curso && p.curso !== filtro.curso) return false
      if (filtro.texto && !coincide(`#${p.numero} ${p.persona_nombre} ${p.persona_dni} ${p.herramienta_codigo} ${p.herramienta_nombre}`, filtro.texto)) return false
      return true
    })
    .sort((a, b) => b.numero - a.numero)
)

const conteo = computed(() => {
  const c = { activo: 0, vencido: 0, devuelto: 0, cancelado: 0 }
  prestamos.value.forEach((p) => c[p.estado_visible]++)
  return c
})

// Cancelar (no se borra: cambia de estado y queda en el historial)
const cancelando = ref(null)
const motivo = ref('')
const errorMotivo = ref('')
const guardando = ref(false)

function abrirCancelar(p) {
  cancelando.value = p
  motivo.value = ''
  errorMotivo.value = ''
}

async function confirmarCancelacion() {
  errorMotivo.value = v.obligatorio(motivo.value, 'El motivo') || v.largo(motivo.value, { min: 5, max: 200, nombre: 'El motivo' })
  if (errorMotivo.value) return
  guardando.value = true
  const ok = await ejecutar(() => api.cancelarPrestamo(cancelando.value.id, motivo.value.trim()), `Préstamo #${cancelando.value.numero} cancelado. El stock se repuso.`)
  guardando.value = false
  if (ok) {
    cancelando.value = null
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>{{ esAlumno ? 'Mis préstamos' : 'Préstamos' }}</h1>
        <p v-if="esAlumno">Tus préstamos pendientes y tu historial.</p>
        <p v-else-if="sesion.usuario.rol === 'docente'">Préstamos de tus cursos. Solo consulta.</p>
        <p v-else>Historial completo. Los préstamos no se borran: se devuelven o se cancelan.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <RouterLink v-if="gestiona" to="/prestamos/nuevo" class="boton primario">+ Nuevo préstamo</RouterLink>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por N°, persona, DNI o elemento" aria-label="Buscar" />
      <select v-model="filtro.estado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="activo">Activos ({{ conteo.activo }})</option>
        <option value="vencido">Vencidos ({{ conteo.vencido }})</option>
        <option value="devuelto">Devueltos ({{ conteo.devuelto }})</option>
        <option value="cancelado">Cancelados ({{ conteo.cancelado }})</option>
      </select>
      <select v-if="!esAlumno" v-model="filtro.curso" aria-label="Curso">
        <option value="">Todos los cursos</option>
        <option v-for="c in cursos" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <p class="suave">{{ filtrados.length }} préstamo(s)</p>
      <table class="tabla-responsive">
        <thead>
          <tr>
            <th>N°</th><th v-if="!esAlumno">Persona</th><th>Elemento</th><th>Cant.</th><th>Salida</th><th>Límite</th><th>Estado</th><th>Devolución</th>
            <th v-if="gestiona">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtrados" :key="p.id">
            <td data-label="N°">#{{ p.numero }}</td>
            <td v-if="!esAlumno" data-label="Persona">{{ p.persona_nombre }}<span v-if="p.curso" class="suave"> · {{ p.curso }}</span></td>
            <td data-label="Elemento">{{ p.herramienta_codigo }} · {{ p.herramienta_nombre }}</td>
            <td data-label="Cant.">{{ p.cantidad }}</td>
            <td data-label="Salida">{{ formatear(p.fecha_salida) }}</td>
            <td data-label="Límite">{{ formatear(p.fecha_limite) }}</td>
            <td data-label="Estado"><EstadoBadge :estado="p.estado_visible" /></td>
            <td data-label="Devolución">
              <template v-if="p.devolucion">
                {{ formatear(p.devolucion.fecha_real) }} <EstadoBadge :estado="p.devolucion.estado_al_devolver" />
                <span v-if="p.devolucion.fecha_real > p.fecha_limite" class="badge rojo">Fuera de término</span>
              </template>
              <span v-else-if="p.estado === 'cancelado'" class="suave">{{ p.motivo_cancelacion }}</span>
              <span v-else class="suave">Pendiente</span>
            </td>
            <td v-if="gestiona" data-label="Acciones">
              <div v-if="p.estado === 'activo'" class="acciones">
                <RouterLink class="boton chico primario" :to="`/prestamos/${p.id}/devolucion`">Devolución</RouterLink>
                <button class="chico" @click="abrirCancelar(p)">Cancelar</button>
              </div>
              <span v-else class="suave">—</span>
            </td>
          </tr>
          <tr v-if="!filtrados.length"><td class="vacio" colspan="9">No hay préstamos que coincidan.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="cancelando" :titulo="`Cancelar préstamo #${cancelando.numero}`" @cerrar="cancelando = null">
      <form class="formulario" novalidate @submit.prevent="confirmarCancelacion">
        <p>Usalo solo si el préstamo se cargó por error o no se llegó a entregar. El préstamo <strong>no se borra</strong>: queda como "Cancelado" y el stock se repone.</p>
        <Campo etiqueta="Motivo de la cancelación" para="motivo" :error="errorMotivo" obligatorio>
          <textarea id="motivo" v-model="motivo" maxlength="200"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="cancelando = null">Volver</button>
          <button class="peligro" type="submit" :disabled="guardando">{{ guardando ? 'Cancelando…' : 'Cancelar préstamo' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
