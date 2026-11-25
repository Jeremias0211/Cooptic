<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { sesion, tiene } from '../store/sesion'
import { ejecutar, confirmar } from '../store/ui'
import { coincide } from '../utils/estados'
import { formatear, hoyISO, sumarDias } from '../utils/fechas'
import * as v from '../utils/validar'

const ruta = useRoute()
const router = useRouter()
const cargando = ref(true)
const error = ref('')
const solicitudes = ref([])
const herramientas = ref([])
const filtro = reactive({ texto: '', estado: '' })
const esDocente = sesion.usuario.rol === 'docente'
const atiende = tiene('atenderSolicitudes')

onMounted(async () => {
  await cargar()
  if (ruta.query.nueva && esDocente) abrirNueva()
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [s, h] = await Promise.all([api.listarSolicitudes(), api.listarHerramientas()])
    solicitudes.value = s
    herramientas.value = h.filter((x) => x.activo)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  solicitudes.value
    .filter((s) => !filtro.estado || s.estado === filtro.estado)
    .filter((s) => !filtro.texto || coincide(`${s.docente_nombre} ${s.herramienta_nombre} ${s.curso}`, filtro.texto))
    .sort((a, b) => (a.estado === 'pendiente' ? -1 : 0) - (b.estado === 'pendiente' ? -1 : 0) || b.fecha.localeCompare(a.fecha))
)

// ----- Nueva solicitud (docente) -----
const modalNueva = ref(false)
const nueva = reactive({})
const errores = ref({})
const guardando = ref(false)
const elegida = computed(() => herramientas.value.find((h) => h.id === Number(nueva.herramienta_id)))

function abrirNueva() {
  Object.assign(nueva, { herramienta_id: '', cantidad: 1, fecha_clase: sumarDias(hoyISO(), 1), curso: sesion.usuario.cursos?.[0] || '', motivo: '' })
  errores.value = {}
  modalNueva.value = true
}

async function guardarNueva() {
  errores.value = v.juntarErrores({
    herramienta_id: [v.obligatorio(nueva.herramienta_id, 'El elemento')],
    cantidad: [v.entero(nueva.cantidad, { min: 1, max: elegida.value?.cantidad_total || 1, nombre: 'La cantidad' })],
    fecha_clase: [v.fechaFutura(nueva.fecha_clase, 'La fecha de la clase')],
    curso: [v.obligatorio(nueva.curso, 'El curso')],
    motivo: [v.obligatorio(nueva.motivo, 'La actividad'), v.largo(nueva.motivo, { min: 5, max: 200, nombre: 'La actividad' })]
  })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  const ok = await ejecutar(() => api.crearSolicitud({ ...nueva, herramienta_id: Number(nueva.herramienta_id), cantidad: Number(nueva.cantidad), motivo: nueva.motivo.trim() }), 'Solicitud enviada al pañol.')
  guardando.value = false
  if (ok) {
    modalNueva.value = false
    cargar()
  }
}

async function cancelar(s) {
  if (await confirmar({ titulo: 'Cancelar solicitud', texto: 'La solicitud queda como cancelada (no se borra).', textoBoton: 'Cancelar solicitud', peligro: true })) {
    if (await ejecutar(() => api.cambiarEstadoSolicitud(s.id, 'cancelada'), 'Solicitud cancelada.')) cargar()
  }
}

// ----- Atender / rechazar (pañolero y administrador) -----
function atender(s) {
  router.push({ path: '/prestamos/nuevo', query: { solicitud: s.id, persona: s.docente_id, herramienta: s.herramienta_id, cantidad: s.cantidad } })
}

const rechazando = ref(null)
const respuesta = ref('')
const errorResp = ref('')

async function guardarRechazo() {
  errorResp.value = v.obligatorio(respuesta.value, 'El motivo') || v.largo(respuesta.value, { min: 5, max: 200, nombre: 'El motivo' })
  if (errorResp.value) return
  guardando.value = true
  const ok = await ejecutar(() => api.cambiarEstadoSolicitud(rechazando.value.id, 'rechazada', respuesta.value.trim()), 'Solicitud rechazada.')
  guardando.value = false
  if (ok) {
    rechazando.value = null
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>{{ esDocente ? 'Mis solicitudes de herramientas' : 'Solicitudes de docentes' }}</h1>
        <p v-if="esDocente">Pedí herramientas para tu clase. El pañol las prepara y registra el préstamo.</p>
        <p v-else>Pedidos de docentes para sus clases. Atender abre el formulario de préstamo ya completado.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button v-if="tiene('crearSolicitudPrestamo')" class="primario" @click="abrirNueva">+ Nueva solicitud</button>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por docente, elemento o curso" aria-label="Buscar" />
      <select v-model="filtro.estado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendientes</option>
        <option value="atendida">Atendidas</option>
        <option value="rechazada">Rechazadas</option>
        <option value="cancelada">Canceladas</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead>
          <tr><th>Pedida</th><th v-if="!esDocente">Docente</th><th>Elemento</th><th>Cant.</th><th>Clase</th><th>Curso</th><th>Estado</th><th>Respuesta / acción</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in filtradas" :key="s.id">
            <td data-label="Pedida">{{ formatear(s.fecha) }}</td>
            <td v-if="!esDocente" data-label="Docente">{{ s.docente_nombre }}</td>
            <td data-label="Elemento">{{ s.herramienta_codigo }} · {{ s.herramienta_nombre }}</td>
            <td data-label="Cant.">{{ s.cantidad }}</td>
            <td data-label="Clase">{{ formatear(s.fecha_clase) }}</td>
            <td data-label="Curso">{{ s.curso }}</td>
            <td data-label="Estado"><EstadoBadge :estado="s.estado" /></td>
            <td data-label="Respuesta / acción">
              <div v-if="s.estado === 'pendiente'" class="acciones">
                <template v-if="atiende">
                  <button class="chico primario" @click="atender(s)">Atender</button>
                  <button class="chico" @click="rechazando = s; respuesta = ''; errorResp = ''">Rechazar</button>
                </template>
                <button v-if="esDocente" class="chico" @click="cancelar(s)">Cancelar</button>
              </div>
              <span v-else class="suave">{{ s.respuesta || (s.estado === 'atendida' ? 'Préstamo registrado' : '—') }}</span>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="8">No hay solicitudes.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="modalNueva" titulo="Solicitar herramientas para una clase" @cerrar="modalNueva = false">
      <form class="formulario" novalidate @submit.prevent="guardarNueva">
        <Campo etiqueta="Herramienta o material" para="s-h" :error="errores.herramienta_id" obligatorio>
          <select id="s-h" v-model="nueva.herramienta_id">
            <option value="">Elegí…</option>
            <option v-for="h in herramientas" :key="h.id" :value="h.id">{{ h.codigo }} · {{ h.nombre }} ({{ h.cantidad_disponible }} disponibles hoy)</option>
          </select>
        </Campo>
        <div class="fila-campos">
          <Campo etiqueta="Cantidad" para="s-c" :error="errores.cantidad" obligatorio>
            <input id="s-c" v-model="nueva.cantidad" type="number" min="1" />
          </Campo>
          <Campo etiqueta="Fecha de la clase" para="s-f" :error="errores.fecha_clase" obligatorio>
            <input id="s-f" v-model="nueva.fecha_clase" type="date" :min="hoyISO()" />
          </Campo>
          <Campo etiqueta="Curso" para="s-cu" :error="errores.curso" obligatorio>
            <select id="s-cu" v-model="nueva.curso">
              <option v-for="c in sesion.usuario.cursos" :key="c" :value="c">{{ c }}</option>
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Actividad" para="s-m" :error="errores.motivo" obligatorio>
          <input id="s-m" v-model="nueva.motivo" maxlength="200" placeholder="Ej.: Práctica de instalación eléctrica" />
        </Campo>
        <p v-if="elegida && Number(nueva.cantidad) > elegida.cantidad_disponible" class="aviso alerta">
          Hoy hay {{ elegida.cantidad_disponible }} disponibles. Podés enviar la solicitud igual, pero puede ser rechazada.
        </p>
        <div class="acciones">
          <button type="button" @click="modalNueva = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Enviando…' : 'Enviar solicitud' }}</button>
        </div>
      </form>
    </Modal>

    <Modal v-if="rechazando" titulo="Rechazar solicitud" @cerrar="rechazando = null">
      <form class="formulario" novalidate @submit.prevent="guardarRechazo">
        <p>{{ rechazando.docente_nombre }} pidió {{ rechazando.cantidad }} × {{ rechazando.herramienta_nombre }}.</p>
        <Campo etiqueta="Motivo (lo verá el docente)" para="r-m" :error="errorResp" obligatorio>
          <textarea id="r-m" v-model="respuesta" maxlength="200"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="rechazando = null">Volver</button>
          <button class="peligro" type="submit" :disabled="guardando">Rechazar</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
