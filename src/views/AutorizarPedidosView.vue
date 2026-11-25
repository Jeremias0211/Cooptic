<script setup>
// DOCENTE: bandeja de pedidos de alumnos de SUS cursos. Autoriza (puede bajar la cantidad
// y cambiar el plazo de devolución) o rechaza con un motivo obligatorio.
// Al autorizar se genera el código de retiro que vale 48 horas.
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import Modal from '../components/Modal.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { sesion } from '../store/sesion'
import { ejecutar, confirmar, avisar } from '../store/ui'
import { estadoSolicitud, coincide } from '../utils/estados'
import { formatear, formatearFechaHora, hoyISO, sumarDias } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const solicitudes = ref([])
const herramientas = ref([])
const talleres = ref([])
const filtro = reactive({ texto: '', estado: 'esperando_autorizacion', curso: '' })
const guardando = ref(false)

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [s, h, t] = await Promise.all([api.listarSolicitudesAlumnos(), api.listarHerramientas(), api.listarTalleres()])
    solicitudes.value = s.map((x) => ({ ...x, estado_visible: estadoSolicitud(x) }))
    herramientas.value = h
    talleres.value = t
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const pendientes = computed(() => solicitudes.value.filter((s) => s.estado_visible === 'esperando_autorizacion').length)

const filtradas = computed(() =>
  solicitudes.value
    .filter((s) => !filtro.estado || s.estado_visible === filtro.estado)
    .filter((s) => !filtro.curso || s.curso === filtro.curso)
    .filter((s) => !filtro.texto || coincide(`${s.alumno_nombre} ${s.alumno_dni} ${s.herramienta_codigo} ${s.herramienta_nombre} ${s.motivo}`, filtro.texto))
)

// ----- Autorizar -----
const autorizando = ref(null)
const aut = reactive({ cantidad: 1, fecha_limite: '' })
const erroresAut = ref({})

function abrirAutorizar(s) {
  const h = herramientas.value.find((x) => x.id === s.herramienta_id)
  const plazo = talleres.value.find((t) => t.id === h?.taller_id)?.plazo_dias || 7
  autorizando.value = s
  Object.assign(aut, { cantidad: s.cantidad, fecha_limite: sumarDias(hoyISO(), plazo) })
  erroresAut.value = {}
}

async function guardarAutorizacion() {
  const s = autorizando.value
  erroresAut.value = v.juntarErrores({
    cantidad: [v.entero(aut.cantidad, { min: 1, max: s.cantidad, nombre: 'La cantidad autorizada' })],
    fecha_limite: [v.fechaFutura(aut.fecha_limite, 'La fecha de devolución'), aut.fecha_limite > sumarDias(hoyISO(), 60) ? 'El plazo máximo es de 60 días.' : '']
  })
  if (Object.keys(erroresAut.value).length) return
  const si = await confirmar({
    titulo: 'Autorizar pedido',
    texto: `${s.alumno_nombre} va a poder retirar ${aut.cantidad} × ${s.herramienta_nombre} durante las próximas 48 horas y devolverlo hasta el ${formatear(aut.fecha_limite)}.`,
    textoBoton: 'Autorizar'
  })
  if (!si) return
  guardando.value = true
  let codigo
  const ok = await ejecutar(async () => {
    codigo = await api.autorizarSolicitud(s.id, Number(aut.cantidad), aut.fecha_limite)
  })
  guardando.value = false
  if (ok) {
    avisar(`Pedido autorizado. Código de retiro: ${codigo} (vale 48 horas).`)
    autorizando.value = null
    cargar()
  }
}

// ----- Rechazar -----
const rechazando = ref(null)
const motivo = ref('')
const errorMotivo = ref('')

function abrirRechazar(s) {
  rechazando.value = s
  motivo.value = ''
  errorMotivo.value = ''
}

async function guardarRechazo() {
  errorMotivo.value = v.obligatorio(motivo.value, 'El motivo') || v.largo(motivo.value, { min: 5, max: 200, nombre: 'El motivo' })
  if (errorMotivo.value) return
  const s = rechazando.value
  const si = await confirmar({ titulo: 'Rechazar pedido', texto: `${s.alumno_nombre} va a ver el motivo del rechazo.`, textoBoton: 'Rechazar', peligro: true })
  if (!si) return
  guardando.value = true
  const ok = await ejecutar(() => api.rechazarSolicitud(s.id, motivo.value.trim()), 'Pedido rechazado.')
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
        <h1>Autorizar pedidos</h1>
        <p>Pedidos de alumnos de tus cursos ({{ sesion.usuario.cursos.join(', ') }}). Reemplaza la notita firmada en papel.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <RouterLink to="/autorizaciones-clase" class="boton">Autorizar a toda la clase</RouterLink>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por alumno, DNI, elemento o motivo" aria-label="Buscar" />
      <select v-model="filtro.estado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="esperando_autorizacion">Esperando autorización ({{ pendientes }})</option>
        <option value="autorizada">Autorizadas</option>
        <option value="retirada">Retiradas</option>
        <option value="vencida">Vencidas</option>
        <option value="rechazada">Rechazadas</option>
        <option value="cancelada">Canceladas</option>
      </select>
      <select v-model="filtro.curso" aria-label="Curso">
        <option value="">Todos mis cursos</option>
        <option v-for="c in sesion.usuario.cursos" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead>
          <tr><th>Pedido</th><th>Alumno</th><th>Elemento</th><th>Cant.</th><th>Motivo</th><th>Estado</th><th>Acción / detalle</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in filtradas" :key="s.id">
            <td data-label="Pedido">{{ formatear(s.fecha) }}</td>
            <td data-label="Alumno">{{ s.alumno_nombre }}<br /><span class="suave">{{ s.curso }} · DNI {{ s.alumno_dni }}</span></td>
            <td data-label="Elemento">{{ s.herramienta_codigo }} · {{ s.herramienta_nombre }}</td>
            <td data-label="Cant.">{{ s.cantidad_autorizada || s.cantidad }}<span v-if="s.cantidad_autorizada && s.cantidad_autorizada < s.cantidad" class="suave"> de {{ s.cantidad }}</span></td>
            <td data-label="Motivo">{{ s.motivo }}</td>
            <td data-label="Estado"><EstadoBadge :estado="s.estado_visible" /></td>
            <td data-label="Acción / detalle">
              <div v-if="s.estado_visible === 'esperando_autorizacion'" class="acciones">
                <button class="chico primario" @click="abrirAutorizar(s)">Autorizar</button>
                <button class="chico" @click="abrirRechazar(s)">Rechazar</button>
              </div>
              <span v-else-if="s.estado_visible === 'autorizada'" class="suave">Código {{ s.codigo_retiro }} · vale hasta {{ formatearFechaHora(s.vence) }}</span>
              <span v-else-if="s.estado_visible === 'vencida'" class="suave">No se retiró en 48 h ({{ formatearFechaHora(s.vence) }})</span>
              <span v-else-if="s.estado_visible === 'retirada'" class="suave">Préstamo #{{ s.prestamo_numero || '—' }}</span>
              <span v-else-if="s.estado_visible === 'rechazada'" class="suave">{{ s.respuesta }}</span>
              <span v-else class="suave">Cancelado por el alumno</span>
              <div v-if="s.autorizado_por_nombre && s.estado_visible !== 'esperando_autorizacion'" class="suave">Respondió: Prof. {{ s.autorizado_por_nombre }}</div>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="7">No hay pedidos {{ filtro.estado === 'esperando_autorizacion' ? 'esperando tu autorización' : 'con esos filtros' }}.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="autorizando" titulo="Autorizar pedido" @cerrar="autorizando = null">
      <form class="formulario" novalidate @submit.prevent="guardarAutorizacion">
        <p>
          <strong>{{ autorizando.alumno_nombre }}</strong> ({{ autorizando.curso }}) pidió
          {{ autorizando.cantidad }} × {{ autorizando.herramienta_nombre }}.<br />
          <span class="suave">Motivo: {{ autorizando.motivo }}</span>
        </p>
        <div class="fila-campos">
          <Campo etiqueta="Cantidad autorizada" para="a-c" :error="erroresAut.cantidad" obligatorio :ayuda="`Podés reducirla (máximo ${autorizando.cantidad})`">
            <input id="a-c" v-model="aut.cantidad" type="number" min="1" :max="autorizando.cantidad" />
          </Campo>
          <Campo etiqueta="Devolver el" para="a-f" :error="erroresAut.fecha_limite" obligatorio ayuda="Plazo de devolución">
            <input id="a-f" v-model="aut.fecha_limite" type="date" :min="hoyISO()" :max="sumarDias(hoyISO(), 60)" />
          </Campo>
        </div>
        <p class="aviso info">Se genera un código de retiro de 4 caracteres que el alumno muestra en el pañol. Vale 48 horas.</p>
        <div class="acciones">
          <button type="button" @click="autorizando = null">Volver</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Autorizando…' : 'Autorizar' }}</button>
        </div>
      </form>
    </Modal>

    <Modal v-if="rechazando" titulo="Rechazar pedido" @cerrar="rechazando = null">
      <form class="formulario" novalidate @submit.prevent="guardarRechazo">
        <p>{{ rechazando.alumno_nombre }} pidió {{ rechazando.cantidad }} × {{ rechazando.herramienta_nombre }}.</p>
        <Campo etiqueta="Motivo (lo verá el alumno)" para="r-m" :error="errorMotivo" obligatorio ayuda="Entre 5 y 200 caracteres">
          <textarea id="r-m" v-model="motivo" maxlength="200"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="rechazando = null">Volver</button>
          <button class="peligro" type="submit" :disabled="guardando">Rechazar</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
