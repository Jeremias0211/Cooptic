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
import { estadoStock } from '../utils/estados'
import { formatear } from '../utils/fechas'
import * as v from '../utils/validar'

const ruta = useRoute()
const cargando = ref(true)
const error = ref('')
const reposiciones = ref([])
const herramientas = ref([])
const filtroEstado = ref('')
const aprueba = tiene('aprobarReposicion')

onMounted(async () => {
  await cargar()
  if (ruta.query.nueva) abrirNueva()
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [r, h] = await Promise.all([api.listarReposiciones(), api.listarHerramientas()])
    reposiciones.value = r
    herramientas.value = h.filter((x) => x.activo)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  reposiciones.value.filter((r) => !filtroEstado.value || r.estado === filtroEstado.value).sort((a, b) => b.fecha.localeCompare(a.fecha))
)

const modalNueva = ref(false)
const nueva = reactive({})
const errores = ref({})
const guardando = ref(false)

function abrirNueva() {
  Object.assign(nueva, { herramienta_id: '', cantidad: 1, motivo: '' })
  errores.value = {}
  modalNueva.value = true
}

async function guardarNueva() {
  errores.value = v.juntarErrores({
    herramienta_id: [v.obligatorio(nueva.herramienta_id, 'El elemento')],
    cantidad: [v.entero(nueva.cantidad, { min: 1, max: 500, nombre: 'La cantidad' })],
    motivo: [v.obligatorio(nueva.motivo, 'El motivo'), v.largo(nueva.motivo, { min: 5, max: 200, nombre: 'El motivo' })]
  })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  const ok = await ejecutar(() => api.crearReposicion({ herramienta_id: Number(nueva.herramienta_id), cantidad: Number(nueva.cantidad), motivo: nueva.motivo.trim() }), 'Pedido de reposición enviado.')
  guardando.value = false
  if (ok) {
    modalNueva.value = false
    cargar()
  }
}

// Cambios de estado del administrador: pendiente → aprobada/rechazada → recibida
const cambiando = ref(null)
const cambio = reactive({ estado: '', respuesta: '', error: '' })

function abrirCambio(r, estado) {
  cambiando.value = r
  Object.assign(cambio, { estado, respuesta: '', error: '' })
}

async function guardarCambio() {
  cambio.error = cambio.estado === 'rechazada' ? v.obligatorio(cambio.respuesta, 'El motivo del rechazo') : ''
  if (cambio.error) return
  guardando.value = true
  const textos = { aprobada: 'Pedido aprobado.', rechazada: 'Pedido rechazado.', recibida: 'Material recibido: se sumó al inventario.' }
  const ok = await ejecutar(() => api.actualizarReposicion(cambiando.value.id, cambio.estado, cambio.respuesta.trim()), textos[cambio.estado])
  guardando.value = false
  if (ok) {
    cambiando.value = null
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Solicitudes de reposición</h1>
        <p v-if="aprueba">El administrador aprueba los pedidos. Al marcar "Recibida", la cantidad se suma al inventario.</p>
        <p v-else-if="sesion.usuario.rol === 'docente'">Tus pedidos de reposición de materiales.</p>
        <p v-else>Pedidos de reposición de herramientas y materiales.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button v-if="tiene('crearReposicion')" class="primario" @click="abrirNueva">+ Pedir reposición</button>
      </div>
    </div>

    <div class="filtros">
      <select v-model="filtroEstado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendientes</option>
        <option value="aprobada">Aprobadas</option>
        <option value="recibida">Recibidas</option>
        <option value="rechazada">Rechazadas</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead>
          <tr><th>Fecha</th><th>Elemento</th><th>Cant.</th><th>Pidió</th><th>Motivo</th><th>Estado</th><th>Respuesta / acción</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in filtradas" :key="r.id">
            <td data-label="Fecha">{{ formatear(r.fecha) }}</td>
            <td data-label="Elemento">{{ r.herramienta_codigo }} · {{ r.herramienta_nombre }}</td>
            <td data-label="Cant.">{{ r.cantidad }}</td>
            <td data-label="Pidió">{{ r.solicitante_nombre }}</td>
            <td data-label="Motivo">{{ r.motivo }}</td>
            <td data-label="Estado"><EstadoBadge :estado="r.estado" /></td>
            <td data-label="Respuesta / acción">
              <div v-if="aprueba && r.estado === 'pendiente'" class="acciones">
                <button class="chico primario" @click="abrirCambio(r, 'aprobada')">Aprobar</button>
                <button class="chico" @click="abrirCambio(r, 'rechazada')">Rechazar</button>
              </div>
              <div v-else-if="aprueba && r.estado === 'aprobada'" class="acciones">
                <button class="chico primario" @click="abrirCambio(r, 'recibida')">Marcar recibida</button>
              </div>
              <span v-else class="suave">{{ r.respuesta || '—' }}</span>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="7">No hay pedidos.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="modalNueva" titulo="Pedir reposición" @cerrar="modalNueva = false">
      <form class="formulario" novalidate @submit.prevent="guardarNueva">
        <Campo etiqueta="Elemento" para="rp-h" :error="errores.herramienta_id" obligatorio>
          <select id="rp-h" v-model="nueva.herramienta_id">
            <option value="">Elegí…</option>
            <option v-for="h in herramientas" :key="h.id" :value="h.id">
              {{ h.codigo }} · {{ h.nombre }} ({{ h.cantidad_disponible }}/{{ h.cantidad_total }}){{ estadoStock(h) !== 'disponible' ? ' — stock bajo' : '' }}
            </option>
          </select>
        </Campo>
        <Campo etiqueta="Cantidad pedida" para="rp-c" :error="errores.cantidad" obligatorio>
          <input id="rp-c" v-model="nueva.cantidad" type="number" min="1" />
        </Campo>
        <Campo etiqueta="Motivo" para="rp-m" :error="errores.motivo" obligatorio>
          <textarea id="rp-m" v-model="nueva.motivo" maxlength="200"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="modalNueva = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Enviando…' : 'Enviar pedido' }}</button>
        </div>
      </form>
    </Modal>

    <Modal v-if="cambiando" :titulo="`${{ aprobada: 'Aprobar', rechazada: 'Rechazar', recibida: 'Marcar como recibida' }[cambio.estado]}`" @cerrar="cambiando = null">
      <form class="formulario" novalidate @submit.prevent="guardarCambio">
        <p>{{ cambiando.cantidad }} × {{ cambiando.herramienta_nombre }} — pedido por {{ cambiando.solicitante_nombre }}.</p>
        <p v-if="cambio.estado === 'recibida'" class="aviso info">Se sumarán {{ cambiando.cantidad }} unidades al total y al disponible.</p>
        <Campo :etiqueta="cambio.estado === 'rechazada' ? 'Motivo del rechazo' : 'Comentario (opcional)'" para="c-r" :error="cambio.error" :obligatorio="cambio.estado === 'rechazada'">
          <textarea id="c-r" v-model="cambio.respuesta" maxlength="200"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="cambiando = null">Volver</button>
          <button :class="cambio.estado === 'rechazada' ? 'peligro' : 'primario'" type="submit" :disabled="guardando">Confirmar</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
