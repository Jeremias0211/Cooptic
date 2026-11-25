<script setup>
// Registro de acuerdos (Reglamento Interno CoopTIC, Capítulo VI, arts. 15 a 17):
// fecha, participantes, temas, decisiones, responsables y plazos.
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { tiene } from '../store/sesion'
import { ejecutar } from '../store/ui'
import { coincide } from '../utils/estados'
import { formatear, hoyISO } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const actas = ref([])
const busqueda = ref('')
const gestiona = tiene('gestionarActas')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  try {
    actas.value = await api.listarActas()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  actas.value
    .filter((a) => !busqueda.value || coincide(`${a.temas} ${a.decisiones} ${a.responsables}`, busqueda.value))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
)

const modal = ref(false)
const form = reactive({})
const errores = ref({})

function abrir(a = null) {
  Object.assign(form, a ? { ...a } : { id: null, fecha: hoyISO(), participantes: '', temas: '', decisiones: '', responsables: '' })
  errores.value = {}
  modal.value = true
}

async function guardar() {
  errores.value = v.juntarErrores({
    fecha: [v.obligatorio(form.fecha, 'La fecha'), form.fecha > hoyISO() ? 'El acta no puede tener fecha futura.' : ''],
    participantes: [v.obligatorio(form.participantes, 'Los participantes')],
    temas: [v.obligatorio(form.temas, 'Los temas'), v.largo(form.temas, { min: 5, max: 500, nombre: 'Los temas' })],
    decisiones: [v.obligatorio(form.decisiones, 'Las decisiones'), v.largo(form.decisiones, { min: 5, max: 1000, nombre: 'Las decisiones' })],
    responsables: [v.largo(form.responsables, { max: 500, nombre: 'Responsables y plazos' })]
  })
  if (Object.keys(errores.value).length) return
  if (await ejecutar(() => api.guardarActa({ ...form }), 'Acta guardada.')) {
    modal.value = false
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Actas de reuniones</h1>
        <p>Registro de acuerdos de CoopTIC (Reglamento, Cap. VI).</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button v-if="gestiona" class="primario" @click="abrir()">+ Nueva acta</button>
      </div>
    </div>

    <div class="filtros" style="grid-template-columns: 1fr">
      <input v-model="busqueda" type="search" placeholder="Buscar en temas, decisiones o responsables" aria-label="Buscar" />
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>
    <template v-else>
      <article v-for="a in filtradas" :key="a.id" class="tarjeta">
        <div class="encabezado">
          <h2>Reunión del {{ formatear(a.fecha) }}</h2>
          <button v-if="gestiona" class="chico" @click="abrir(a)">Editar</button>
        </div>
        <p><strong>Participantes:</strong> {{ a.participantes }}</p>
        <p><strong>Temas tratados:</strong> {{ a.temas }}</p>
        <p><strong>Decisiones:</strong> {{ a.decisiones }}</p>
        <p v-if="a.responsables"><strong>Responsables y plazos:</strong> {{ a.responsables }}</p>
      </article>
      <p v-if="!filtradas.length" class="vacio">No hay actas registradas.</p>
    </template>

    <Modal v-if="modal" :titulo="form.id ? 'Editar acta' : 'Nueva acta'" @cerrar="modal = false">
      <form class="formulario" novalidate @submit.prevent="guardar">
        <Campo etiqueta="Fecha de la reunión" para="a-f" :error="errores.fecha" obligatorio>
          <input id="a-f" v-model="form.fecha" type="date" :max="hoyISO()" />
        </Campo>
        <Campo etiqueta="Participantes" para="a-p" :error="errores.participantes" obligatorio ayuda="Podés usar iniciales o cargos">
          <input id="a-p" v-model="form.participantes" maxlength="200" />
        </Campo>
        <Campo etiqueta="Temas tratados" para="a-t" :error="errores.temas" obligatorio>
          <textarea id="a-t" v-model="form.temas" maxlength="500"></textarea>
        </Campo>
        <Campo etiqueta="Decisiones tomadas" para="a-d" :error="errores.decisiones" obligatorio>
          <textarea id="a-d" v-model="form.decisiones" maxlength="1000"></textarea>
        </Campo>
        <Campo etiqueta="Responsables y plazos" para="a-r" :error="errores.responsables">
          <textarea id="a-r" v-model="form.responsables" maxlength="500"></textarea>
        </Campo>
        <div class="acciones">
          <button type="button" @click="modal = false">Cancelar</button>
          <button class="primario" type="submit">Guardar acta</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
