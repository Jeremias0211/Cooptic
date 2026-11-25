<script setup>
// Tareas de las comisiones (KPI 4 – Cumplimiento de tareas asignadas).
// Los integrantes se identifican con códigos internos (I-01, I-02…) para no publicar nombres.
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { tiene } from '../store/sesion'
import { ejecutar, confirmar } from '../store/ui'
import { COMISIONES } from '../services/permisos'
import { estadoTarea } from '../utils/estados'
import { formatear, hoyISO } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const tareas = ref([])
const filtro = reactive({ comision: '', estado: '' })
const gestiona = tiene('gestionarTareas')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  try {
    tareas.value = (await api.listarTareas()).map((t) => ({ ...t, estado_visible: estadoTarea(t) }))
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  tareas.value
    .filter((t) => (!filtro.comision || t.comision === filtro.comision) && (!filtro.estado || t.estado_visible === filtro.estado))
    .sort((a, b) => b.fecha_limite.localeCompare(a.fecha_limite))
)

const modal = ref(false)
const form = reactive({})
const errores = ref({})

function abrir(t = null) {
  Object.assign(form, t ? { ...t } : { id: null, codigo_integrante: '', comision: COMISIONES[0], descripcion: '', fecha_limite: hoyISO() })
  errores.value = {}
  modal.value = true
}

async function guardar() {
  form.codigo_integrante = String(form.codigo_integrante).trim().toUpperCase()
  errores.value = v.juntarErrores({
    codigo_integrante: [/^I-\d{2}$/.test(form.codigo_integrante) ? '' : 'Usá el formato I-01.'],
    comision: [v.unoDe(form.comision, COMISIONES, 'La comisión')],
    descripcion: [v.obligatorio(form.descripcion, 'La descripción'), v.largo(form.descripcion, { min: 5, max: 150, nombre: 'La descripción' })],
    fecha_limite: [v.obligatorio(form.fecha_limite, 'La fecha límite')]
  })
  if (Object.keys(errores.value).length) return
  if (await ejecutar(() => api.guardarTarea({ ...form, descripcion: form.descripcion.trim() }), 'Tarea guardada.')) {
    modal.value = false
    cargar()
  }
}

async function cambiarEstado(t, estado) {
  const textos = { completada: 'Marcar como completada', cancelada: 'Cancelar tarea', pendiente: 'Volver a pendiente' }
  if (await confirmar({ titulo: textos[estado], texto: t.descripcion, textoBoton: textos[estado], peligro: estado === 'cancelada' })) {
    if (await ejecutar(() => api.cambiarEstadoTarea(t.id, estado), 'Tarea actualizada.')) cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Tareas de las comisiones</h1>
        <p>Seguimiento para el KPI de cumplimiento. Integrantes identificados con códigos internos.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button v-if="gestiona" class="primario" @click="abrir()">+ Nueva tarea</button>
      </div>
    </div>

    <div class="filtros" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
      <select v-model="filtro.comision" aria-label="Comisión">
        <option value="">Todas las comisiones</option>
        <option v-for="c in COMISIONES" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filtro.estado" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendientes</option>
        <option value="atrasada">Atrasadas</option>
        <option value="completada">Completadas</option>
        <option value="cancelada">Canceladas</option>
      </select>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>
    <div v-else class="tabla-envoltorio">
      <table class="tabla-responsive">
        <thead><tr><th>Integrante</th><th>Comisión</th><th>Tarea</th><th>Límite</th><th>Completada</th><th>Estado</th><th v-if="gestiona">Acciones</th></tr></thead>
        <tbody>
          <tr v-for="t in filtradas" :key="t.id">
            <td data-label="Integrante">{{ t.codigo_integrante }}</td>
            <td data-label="Comisión">{{ t.comision }}</td>
            <td data-label="Tarea">{{ t.descripcion }}</td>
            <td data-label="Límite">{{ formatear(t.fecha_limite) }}</td>
            <td data-label="Completada">
              {{ formatear(t.fecha_completada) }}
              <span v-if="t.fecha_completada && t.fecha_completada > t.fecha_limite" class="badge rojo">Fuera de plazo</span>
            </td>
            <td data-label="Estado"><EstadoBadge :estado="t.estado_visible" /></td>
            <td v-if="gestiona" data-label="Acciones">
              <div class="acciones">
                <template v-if="t.estado === 'pendiente'">
                  <button class="chico primario" @click="cambiarEstado(t, 'completada')">Completar</button>
                  <button class="chico" @click="abrir(t)">Editar</button>
                  <button class="chico" @click="cambiarEstado(t, 'cancelada')">Cancelar</button>
                </template>
                <button v-else class="chico" @click="cambiarEstado(t, 'pendiente')">Reabrir</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="7">No hay tareas.</td></tr>
        </tbody>
      </table>
    </div>

    <Modal v-if="modal" :titulo="form.id ? 'Editar tarea' : 'Nueva tarea'" @cerrar="modal = false">
      <form class="formulario" novalidate @submit.prevent="guardar">
        <div class="fila-campos">
          <Campo etiqueta="Código del integrante" para="t-c" :error="errores.codigo_integrante" obligatorio ayuda="Ej.: I-07">
            <input id="t-c" v-model="form.codigo_integrante" maxlength="4" />
          </Campo>
          <Campo etiqueta="Comisión" para="t-co" :error="errores.comision" obligatorio>
            <select id="t-co" v-model="form.comision"><option v-for="c in COMISIONES" :key="c">{{ c }}</option></select>
          </Campo>
        </div>
        <Campo etiqueta="Tarea" para="t-d" :error="errores.descripcion" obligatorio>
          <input id="t-d" v-model="form.descripcion" maxlength="150" />
        </Campo>
        <Campo etiqueta="Fecha límite" para="t-f" :error="errores.fecha_limite" obligatorio>
          <input id="t-f" v-model="form.fecha_limite" type="date" />
        </Campo>
        <div class="acciones">
          <button type="button" @click="modal = false">Cancelar</button>
          <button class="primario" type="submit">Guardar</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
