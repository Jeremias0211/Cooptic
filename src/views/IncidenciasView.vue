<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { tiene } from '../store/sesion'
import { ejecutar } from '../store/ui'
import { TIPO_INCIDENCIA } from '../services/permisos'
import { coincide } from '../utils/estados'
import { formatear } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const incidencias = ref([])
const herramientas = ref([])
const personas = ref([])
const filtro = reactive({ texto: '', tipo: '', estado: 'abierta' })
const puedeResolver = tiene('resolverIncidencias')
const ACCIONES = { reparada: 'Reparada (vuelve al stock)', repuesta: 'Repuesta por compra (vuelve al stock)', baja: 'Dada de baja (se descuenta del total)' }

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [i, h, p] = await Promise.all([api.listarIncidencias(), api.listarHerramientas(), api.listarUsuarios()])
    incidencias.value = i
    herramientas.value = h.filter((x) => x.activo)
    personas.value = p
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  incidencias.value
    .filter((i) => (!filtro.tipo || i.tipo === filtro.tipo) && (!filtro.estado || i.estado === filtro.estado))
    .filter((i) => !filtro.texto || coincide(`${i.herramienta_codigo} ${i.herramienta_nombre} ${i.responsable_nombre} ${i.descripcion}`, filtro.texto))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
)

// Registrar incidencia fuera de un préstamo (ej. se rompe en el pañol)
const modalNueva = ref(false)
const nueva = reactive({})
const errores = ref({})
const guardando = ref(false)

function abrirNueva() {
  Object.assign(nueva, { herramienta_id: '', tipo: 'rotura', cantidad: 1, responsable_id: '', descripcion: '' })
  errores.value = {}
  modalNueva.value = true
}

async function guardarNueva() {
  const h = herramientas.value.find((x) => x.id === Number(nueva.herramienta_id))
  errores.value = v.juntarErrores({
    herramienta_id: [v.obligatorio(nueva.herramienta_id, 'El elemento')],
    tipo: [v.unoDe(nueva.tipo, ['rotura', 'perdida'], 'El tipo')],
    cantidad: [v.entero(nueva.cantidad, { min: 1, max: h ? h.cantidad_disponible : 1, nombre: 'La cantidad' })],
    descripcion: [v.obligatorio(nueva.descripcion, 'La descripción'), v.largo(nueva.descripcion, { min: 5, max: 300, nombre: 'La descripción' })]
  })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  const ok = await ejecutar(() => api.registrarIncidencia({ ...nueva, herramienta_id: Number(nueva.herramienta_id), cantidad: Number(nueva.cantidad) }), 'Incidencia registrada. Las unidades salieron del stock disponible.')
  guardando.value = false
  if (ok) {
    modalNueva.value = false
    cargar()
  }
}

// Resolver (solo administrador)
const resolviendo = ref(null)
const resolucion = reactive({ accion: '', texto: '' })
const erroresRes = ref({})

function abrirResolver(i) {
  resolviendo.value = i
  Object.assign(resolucion, { accion: '', texto: '' })
  erroresRes.value = {}
}

async function guardarResolucion() {
  erroresRes.value = v.juntarErrores({
    accion: [v.obligatorio(resolucion.accion, 'La acción')],
    texto: [v.obligatorio(resolucion.texto, 'La resolución'), v.largo(resolucion.texto, { min: 5, max: 300, nombre: 'La resolución' })]
  })
  if (Object.keys(erroresRes.value).length) return
  guardando.value = true
  const ok = await ejecutar(() => api.resolverIncidencia(resolviendo.value.id, resolucion.accion, resolucion.texto.trim()), 'Incidencia resuelta y stock actualizado.')
  guardando.value = false
  if (ok) {
    resolviendo.value = null
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Incidencias</h1>
        <p>Roturas y pérdidas. Se crean solas al devolver un elemento dañado o perdido.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button class="primario" @click="abrirNueva">+ Registrar rotura o pérdida</button>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por elemento, responsable o descripción" aria-label="Buscar" />
      <select v-model="filtro.tipo" aria-label="Tipo">
        <option value="">Roturas y pérdidas</option>
        <option value="rotura">Roturas</option>
        <option value="perdida">Pérdidas</option>
      </select>
      <select v-model="filtro.estado" aria-label="Estado">
        <option value="">Todas</option>
        <option value="abierta">Abiertas</option>
        <option value="resuelta">Resueltas</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Elemento</th><th>Cant.</th><th>Responsable</th><th>Descripción</th><th>Estado</th><th>Resolución</th></tr>
        </thead>
        <tbody>
          <tr v-for="i in filtradas" :key="i.id">
            <td data-label="Fecha">{{ formatear(i.fecha) }}</td>
            <td data-label="Tipo">{{ TIPO_INCIDENCIA[i.tipo] }}</td>
            <td data-label="Elemento">{{ i.herramienta_codigo }} · {{ i.herramienta_nombre }}<span v-if="i.prestamo_numero" class="suave"> (préstamo #{{ i.prestamo_numero }})</span></td>
            <td data-label="Cant.">{{ i.cantidad }}</td>
            <td data-label="Responsable">{{ i.responsable_nombre }}</td>
            <td data-label="Descripción">{{ i.descripcion || '—' }}</td>
            <td data-label="Estado"><EstadoBadge :estado="i.estado" /></td>
            <td data-label="Resolución">
              <span v-if="i.estado === 'resuelta'">{{ i.resolucion }} <span class="suave">({{ formatear(i.fecha_resolucion) }})</span></span>
              <button v-else-if="puedeResolver" class="chico" @click="abrirResolver(i)">Resolver</button>
              <span v-else class="suave">Espera al administrador</span>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="8">No hay incidencias con esos filtros.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="modalNueva" titulo="Registrar rotura o pérdida" @cerrar="modalNueva = false">
      <form class="formulario" novalidate @submit.prevent="guardarNueva">
        <Campo etiqueta="Elemento" para="i-h" :error="errores.herramienta_id" obligatorio>
          <select id="i-h" v-model="nueva.herramienta_id">
            <option value="">Elegí…</option>
            <option v-for="h in herramientas" :key="h.id" :value="h.id">{{ h.codigo }} · {{ h.nombre }} ({{ h.cantidad_disponible }} disp.)</option>
          </select>
        </Campo>
        <div class="fila-campos">
          <Campo etiqueta="Tipo" obligatorio :error="errores.tipo">
            <div class="opciones-radio">
              <label><input v-model="nueva.tipo" type="radio" value="rotura" /> Rotura</label>
              <label><input v-model="nueva.tipo" type="radio" value="perdida" /> Pérdida</label>
            </div>
          </Campo>
          <Campo etiqueta="Cantidad" para="i-c" :error="errores.cantidad" obligatorio>
            <input id="i-c" v-model="nueva.cantidad" type="number" min="1" />
          </Campo>
        </div>
        <Campo etiqueta="Responsable (si se conoce)" para="i-r">
          <select id="i-r" v-model="nueva.responsable_id">
            <option value="">Sin responsable identificado</option>
            <option v-for="p in personas" :key="p.id" :value="p.id">{{ p.nombre }} · {{ p.dni }}</option>
          </select>
        </Campo>
        <Campo etiqueta="Descripción" para="i-d" :error="errores.descripcion" obligatorio>
          <textarea id="i-d" v-model="nueva.descripcion" maxlength="300"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="modalNueva = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Registrar' }}</button>
        </div>
      </form>
    </Modal>

    <Modal v-if="resolviendo" :titulo="`Resolver: ${resolviendo.herramienta_nombre} × ${resolviendo.cantidad}`" @cerrar="resolviendo = null">
      <form class="formulario" novalidate @submit.prevent="guardarResolucion">
        <Campo etiqueta="¿Qué se hizo?" :error="erroresRes.accion" obligatorio>
          <div class="opciones-radio" style="flex-direction: column">
            <label v-for="(t, k) in ACCIONES" :key="k"><input v-model="resolucion.accion" type="radio" :value="k" /> {{ t }}</label>
          </div>
        </Campo>
        <Campo etiqueta="Detalle de la resolución" para="r-t" :error="erroresRes.texto" obligatorio>
          <textarea id="r-t" v-model="resolucion.texto" maxlength="300"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="resolviendo = null">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Resolver' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
