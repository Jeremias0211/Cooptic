<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import Modal from '../components/Modal.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { tiene } from '../store/sesion'
import { ejecutar, confirmar } from '../store/ui'
import { ESTADO_GENERAL } from '../services/permisos'
import { estadoStock, coincide } from '../utils/estados'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const herramientas = ref([])
const categorias = ref([])
const talleres = ref([])
const filtro = reactive({ texto: '', categoria: '', taller: '', disponibilidad: '', verBajas: false })

const puedeEditar = tiene('editarHerramientas')
const puedeAjustar = tiene('ajustarStock')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [h, c, t] = await Promise.all([api.listarHerramientas(), api.listarCategorias(), api.listarTalleres()])
    herramientas.value = h
    categorias.value = c
    talleres.value = t
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filtradas = computed(() =>
  herramientas.value.filter((h) => {
    if (!filtro.verBajas && !h.activo) return false
    if (filtro.texto && !coincide(`${h.codigo} ${h.nombre} ${h.ubicacion}`, filtro.texto)) return false
    if (filtro.categoria && h.categoria_id !== Number(filtro.categoria)) return false
    if (filtro.taller && h.taller_id !== Number(filtro.taller)) return false
    if (filtro.disponibilidad && estadoStock(h) !== filtro.disponibilidad) return false
    return true
  })
)

// ----- Alta / modificación (administrador) -----
const modalHerramienta = ref(false)
const form = reactive({})
const errores = ref({})
const guardando = ref(false)

function abrirFormulario(h = null) {
  Object.assign(form, h
    ? { ...h }
    : { id: null, codigo: '', nombre: '', tipo: 'herramienta', categoria_id: '', taller_id: '', cantidad_total: 1, stock_minimo: 1, estado_general: 'bueno', ubicacion: '' })
  errores.value = {}
  modalHerramienta.value = true
}

async function guardarHerramienta() {
  form.codigo = String(form.codigo).trim().toUpperCase()
  errores.value = v.juntarErrores({
    codigo: [v.codigo(form.codigo)],
    nombre: [v.obligatorio(form.nombre, 'El nombre'), v.largo(form.nombre, { min: 3, max: 80, nombre: 'El nombre' })],
    categoria_id: [v.obligatorio(form.categoria_id, 'La categoría')],
    taller_id: [v.obligatorio(form.taller_id, 'El taller')],
    cantidad_total: [v.entero(form.cantidad_total, { min: 1, max: 9999, nombre: 'La cantidad total' })],
    stock_minimo: [v.entero(form.stock_minimo, { min: 0, max: Number(form.cantidad_total) || 0, nombre: 'El stock mínimo' })],
    estado_general: [v.unoDe(form.estado_general, Object.keys(ESTADO_GENERAL), 'El estado')],
    ubicacion: [v.largo(form.ubicacion, { max: 60, nombre: 'La ubicación' })]
  })
  if (Object.keys(errores.value).length) return
  guardando.value = true
  const datos = { ...form, categoria_id: Number(form.categoria_id), taller_id: Number(form.taller_id), cantidad_total: Number(form.cantidad_total), stock_minimo: Number(form.stock_minimo) }
  const ok = await ejecutar(() => api.guardarHerramienta(datos), form.id ? 'Herramienta actualizada.' : 'Herramienta dada de alta.')
  guardando.value = false
  if (ok) {
    modalHerramienta.value = false
    cargar()
  }
}

async function cambiarActivo(h) {
  const baja = h.activo
  const si = await confirmar({
    titulo: baja ? 'Dar de baja' : 'Reactivar',
    texto: baja
      ? `"${h.nombre}" dejará de aparecer para préstamos. No se borra: su historial se conserva.`
      : `"${h.nombre}" volverá a estar disponible para préstamos.`,
    textoBoton: baja ? 'Dar de baja' : 'Reactivar',
    peligro: baja
  })
  if (si && (await ejecutar(() => api.cambiarActivoHerramienta(h.id, !h.activo), baja ? 'Herramienta dada de baja.' : 'Herramienta reactivada.'))) cargar()
}

// ----- Ajuste de stock y estado (pañolero) -----
const modalStock = ref(false)
const ajuste = reactive({})

function abrirAjuste(h) {
  Object.assign(ajuste, { id: h.id, nombre: h.nombre, total: h.cantidad_total, cantidad_disponible: h.cantidad_disponible, estado_general: h.estado_general, error: '' })
  modalStock.value = true
}

async function guardarAjuste() {
  ajuste.error = v.entero(ajuste.cantidad_disponible, { min: 0, max: ajuste.total, nombre: 'La cantidad disponible' })
  if (ajuste.error) return
  guardando.value = true
  const ok = await ejecutar(() => api.ajustarStock(ajuste.id, { cantidad_disponible: Number(ajuste.cantidad_disponible), estado_general: ajuste.estado_general }), 'Stock actualizado.')
  guardando.value = false
  if (ok) {
    modalStock.value = false
    cargar()
  }
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>{{ puedeEditar || puedeAjustar ? 'Inventario' : 'Catálogo y disponibilidad' }}</h1>
        <p>Herramientas y materiales de los talleres.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <button v-if="puedeEditar" class="primario" @click="abrirFormulario()">+ Nueva herramienta</button>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtro.texto" type="search" placeholder="Buscar por código, nombre o ubicación" aria-label="Buscar" />
      <select v-model="filtro.categoria" aria-label="Categoría">
        <option value="">Todas las categorías</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nombre }}</option>
      </select>
      <select v-model="filtro.taller" aria-label="Taller">
        <option value="">Todos los talleres</option>
        <option v-for="t in talleres" :key="t.id" :value="t.id">{{ t.nombre }}</option>
      </select>
      <select v-model="filtro.disponibilidad" aria-label="Disponibilidad">
        <option value="">Toda disponibilidad</option>
        <option value="disponible">Disponible</option>
        <option value="stock_bajo">Stock bajo</option>
        <option value="sin_stock">Sin stock</option>
      </select>
    </div>
    <label v-if="puedeEditar" class="suave" style="display: inline-flex; gap: 0.4rem; margin-bottom: 0.75rem">
      <input v-model="filtro.verBajas" type="checkbox" style="width: auto; min-height: auto" /> Mostrar elementos dados de baja
    </label>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>
    <div v-else class="tabla-envoltorio">
      <p class="suave">{{ filtradas.length }} elemento(s)</p>
      <table class="tabla-responsive">
        <thead>
          <tr>
            <th>Código</th><th>Nombre</th><th>Categoría</th><th>Taller</th><th>Disponible</th><th>Estado</th><th>Ubicación</th>
            <th v-if="puedeEditar || puedeAjustar">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in filtradas" :key="h.id" :class="{ inactiva: !h.activo }">
            <td data-label="Código">{{ h.codigo }}</td>
            <td data-label="Nombre">{{ h.nombre }}<span v-if="h.tipo === 'material'" class="suave"> (material)</span></td>
            <td data-label="Categoría">{{ h.categoria_nombre }}</td>
            <td data-label="Taller">{{ h.taller_nombre }}</td>
            <td data-label="Disponible">
              <strong>{{ h.cantidad_disponible }}</strong> / {{ h.cantidad_total }}
              <EstadoBadge :estado="estadoStock(h)" />
            </td>
            <td data-label="Estado"><EstadoBadge :estado="h.estado_general" /></td>
            <td data-label="Ubicación">{{ h.ubicacion || '—' }}</td>
            <td v-if="puedeEditar || puedeAjustar" data-label="Acciones">
              <div class="acciones">
                <button v-if="puedeAjustar && h.activo" class="chico" @click="abrirAjuste(h)">Stock/estado</button>
                <button v-if="puedeEditar" class="chico" @click="abrirFormulario(h)">Editar</button>
                <button v-if="puedeEditar" class="chico" @click="cambiarActivo(h)">{{ h.activo ? 'Dar de baja' : 'Reactivar' }}</button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtradas.length"><td class="vacio" colspan="8">No hay elementos que coincidan con la búsqueda.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Formulario de alta/modificación -->
    <Modal v-if="modalHerramienta" :titulo="form.id ? 'Editar herramienta' : 'Nueva herramienta'" @cerrar="modalHerramienta = false">
      <form class="formulario" novalidate @submit.prevent="guardarHerramienta">
        <div class="fila-campos">
          <Campo etiqueta="Código" para="h-codigo" :error="errores.codigo" obligatorio ayuda="Ej.: H-021 o M-005">
            <input id="h-codigo" v-model="form.codigo" maxlength="7" />
          </Campo>
          <Campo etiqueta="Tipo" para="h-tipo" obligatorio>
            <select id="h-tipo" v-model="form.tipo">
              <option value="herramienta">Herramienta</option>
              <option value="material">Material</option>
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Nombre" para="h-nombre" :error="errores.nombre" obligatorio>
          <input id="h-nombre" v-model="form.nombre" maxlength="80" />
        </Campo>
        <div class="fila-campos">
          <Campo etiqueta="Categoría" para="h-cat" :error="errores.categoria_id" obligatorio>
            <select id="h-cat" v-model="form.categoria_id">
              <option value="">Elegí…</option>
              <option v-for="c in categorias.filter((c) => c.activo)" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </Campo>
          <Campo etiqueta="Taller" para="h-taller" :error="errores.taller_id" obligatorio>
            <select id="h-taller" v-model="form.taller_id">
              <option value="">Elegí…</option>
              <option v-for="t in talleres.filter((t) => t.activo)" :key="t.id" :value="t.id">{{ t.nombre }}</option>
            </select>
          </Campo>
        </div>
        <div class="fila-campos">
          <Campo etiqueta="Cantidad total" para="h-total" :error="errores.cantidad_total" obligatorio>
            <input id="h-total" v-model="form.cantidad_total" type="number" min="1" />
          </Campo>
          <Campo etiqueta="Stock mínimo" para="h-min" :error="errores.stock_minimo" obligatorio ayuda="Debajo de esto se avisa stock bajo">
            <input id="h-min" v-model="form.stock_minimo" type="number" min="0" />
          </Campo>
        </div>
        <div class="fila-campos">
          <Campo etiqueta="Estado general" para="h-estado" :error="errores.estado_general" obligatorio>
            <select id="h-estado" v-model="form.estado_general">
              <option v-for="(t, k) in ESTADO_GENERAL" :key="k" :value="k">{{ t }}</option>
            </select>
          </Campo>
          <Campo etiqueta="Ubicación" para="h-ubic" :error="errores.ubicacion">
            <input id="h-ubic" v-model="form.ubicacion" maxlength="60" placeholder="Ej.: Estante A1" />
          </Campo>
        </div>
        <div class="acciones">
          <button type="button" @click="modalHerramienta = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </Modal>

    <!-- Ajuste de stock (pañolero) -->
    <Modal v-if="modalStock" :titulo="`Stock y estado · ${ajuste.nombre}`" @cerrar="modalStock = false">
      <form class="formulario" novalidate @submit.prevent="guardarAjuste">
        <p class="suave">El pañolero solo puede modificar la cantidad disponible y el estado. Para roturas o pérdidas usá <RouterLink to="/incidencias">Incidencias</RouterLink>, así queda el registro.</p>
        <Campo :etiqueta="`Cantidad disponible (de ${ajuste.total})`" para="a-disp" :error="ajuste.error" obligatorio>
          <input id="a-disp" v-model="ajuste.cantidad_disponible" type="number" min="0" :max="ajuste.total" />
        </Campo>
        <Campo etiqueta="Estado general" para="a-estado" obligatorio>
          <select id="a-estado" v-model="ajuste.estado_general">
            <option v-for="(t, k) in ESTADO_GENERAL" :key="k" :value="k">{{ t }}</option>
          </select>
        </Campo>
        <div class="acciones">
          <button type="button" @click="modalStock = false">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </form>
    </Modal>
  </div>
</template>
