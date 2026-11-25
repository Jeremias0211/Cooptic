<script setup>
import { ref, reactive, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { ejecutar } from '../store/ui'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const talleres = ref([])
const categorias = ref([])

onMounted(cargar)

async function cargar() {
  cargando.value = true
  try {
    const [t, c] = await Promise.all([api.listarTalleres(), api.listarCategorias()])
    talleres.value = t
    categorias.value = c
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// Talleres con su plazo de devolución por defecto
const taller = reactive({ id: null, nombre: '', plazo_dias: 7, activo: true })
const erroresTaller = ref({})

function editarTaller(t) {
  Object.assign(taller, t)
  erroresTaller.value = {}
}
function limpiarTaller() {
  Object.assign(taller, { id: null, nombre: '', plazo_dias: 7, activo: true })
}
async function guardarTaller() {
  erroresTaller.value = v.juntarErrores({
    nombre: [v.obligatorio(taller.nombre, 'El nombre'), v.largo(taller.nombre, { min: 3, max: 40, nombre: 'El nombre' })],
    plazo_dias: [v.entero(taller.plazo_dias, { min: 1, max: 60, nombre: 'El plazo' })]
  })
  if (Object.keys(erroresTaller.value).length) return
  if (await ejecutar(() => api.guardarTaller({ ...taller, nombre: taller.nombre.trim(), plazo_dias: Number(taller.plazo_dias) }), 'Taller guardado.')) {
    limpiarTaller()
    cargar()
  }
}
async function alternarTaller(t) {
  if (await ejecutar(() => api.guardarTaller({ ...t, activo: !t.activo }), t.activo ? 'Taller desactivado.' : 'Taller activado.')) cargar()
}

const categoria = reactive({ id: null, nombre: '', activo: true })
const errorCategoria = ref('')

async function guardarCategoria() {
  errorCategoria.value = v.obligatorio(categoria.nombre, 'El nombre') || v.largo(categoria.nombre, { min: 3, max: 40, nombre: 'El nombre' })
  if (errorCategoria.value) return
  if (await ejecutar(() => api.guardarCategoria({ ...categoria, nombre: categoria.nombre.trim() }), 'Categoría guardada.')) {
    Object.assign(categoria, { id: null, nombre: '', activo: true })
    cargar()
  }
}
async function alternarCategoria(c) {
  if (await ejecutar(() => api.guardarCategoria({ ...c, activo: !c.activo }), c.activo ? 'Categoría desactivada.' : 'Categoría activada.')) cargar()
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Configuración</h1>
        <p>Talleres, plazos de devolución y categorías. Se desactivan en lugar de borrarse para no romper el historial.</p>
      </div>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>
    <div v-else class="grilla-2">
      <section class="tarjeta">
        <h2>Talleres y plazos</h2>
        <table class="tabla-responsive">
          <thead><tr><th>Taller</th><th>Plazo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in talleres" :key="t.id" :class="{ inactiva: !t.activo }">
              <td data-label="Taller">{{ t.nombre }}</td>
              <td data-label="Plazo">{{ t.plazo_dias }} días</td>
              <td data-label="Estado"><EstadoBadge :estado="t.activo ? 'activo' : 'inactivo'" /></td>
              <td data-label="Acciones">
                <div class="acciones">
                  <button class="chico" @click="editarTaller(t)">Editar</button>
                  <button class="chico" @click="alternarTaller(t)">{{ t.activo ? 'Desactivar' : 'Activar' }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <form class="formulario" style="margin-top: 1rem" novalidate @submit.prevent="guardarTaller">
          <h3>{{ taller.id ? 'Editar taller' : 'Nuevo taller' }}</h3>
          <div class="fila-campos">
            <Campo etiqueta="Nombre" para="t-n" :error="erroresTaller.nombre" obligatorio><input id="t-n" v-model="taller.nombre" /></Campo>
            <Campo etiqueta="Plazo de devolución (días)" para="t-p" :error="erroresTaller.plazo_dias" obligatorio>
              <input id="t-p" v-model="taller.plazo_dias" type="number" min="1" max="60" />
            </Campo>
          </div>
          <div class="acciones">
            <button v-if="taller.id" type="button" @click="limpiarTaller">Cancelar edición</button>
            <button class="primario" type="submit">Guardar taller</button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Categorías</h2>
        <table class="tabla-responsive">
          <thead><tr><th>Categoría</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr v-for="c in categorias" :key="c.id" :class="{ inactiva: !c.activo }">
              <td data-label="Categoría">{{ c.nombre }}</td>
              <td data-label="Estado"><EstadoBadge :estado="c.activo ? 'activo' : 'inactivo'" /></td>
              <td data-label="Acciones">
                <div class="acciones">
                  <button class="chico" @click="Object.assign(categoria, c)">Editar</button>
                  <button class="chico" @click="alternarCategoria(c)">{{ c.activo ? 'Desactivar' : 'Activar' }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <form class="formulario" style="margin-top: 1rem" novalidate @submit.prevent="guardarCategoria">
          <h3>{{ categoria.id ? 'Editar categoría' : 'Nueva categoría' }}</h3>
          <Campo etiqueta="Nombre" para="c-n" :error="errorCategoria" obligatorio><input id="c-n" v-model="categoria.nombre" /></Campo>
          <div class="acciones">
            <button v-if="categoria.id" type="button" @click="Object.assign(categoria, { id: null, nombre: '', activo: true })">Cancelar edición</button>
            <button class="primario" type="submit">Guardar categoría</button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
