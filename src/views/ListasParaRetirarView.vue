<script setup>
// PAÑOLERO / ADMIN: lo que los docentes ya autorizaron y se puede entregar.
// Se busca por DNI del alumno o por código de retiro. "Entregar" abre el formulario
// de préstamo precompletado; al confirmarlo la solicitud pasa a "Retirada".
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import { api } from '../services/api'
import { ESTADO_SOLICITUD } from '../services/permisos'
import { estadoSolicitud } from '../utils/estados'
import { formatear, formatearFechaHora, hoyISO } from '../utils/fechas'
import * as v from '../utils/validar'

const router = useRouter()
const cargando = ref(true)
const error = ref('')
const solicitudes = ref([])
const clases = ref([])
const alumnos = ref([])
const texto = ref('')
const buscado = ref('') // lo que se buscó al tocar "Buscar"
const errorBusqueda = ref('')

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [s, a, u] = await Promise.all([api.listarSolicitudesAlumnos(), api.listarAutorizacionesClase(), api.listarUsuarios()])
    solicitudes.value = s.map((x) => ({ ...x, estado_visible: estadoSolicitud(x) }))
    clases.value = a
    alumnos.value = u.filter((x) => x.rol === 'alumno' && x.activo)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// Autorizadas vigentes (individuales) y autorizaciones de clase activas de hoy
const vigentes = computed(() => solicitudes.value.filter((s) => s.estado_visible === 'autorizada'))
const clasesDeHoy = computed(() => clases.value.filter((a) => a.estado === 'activa' && a.fecha === hoyISO()))

function buscar() {
  const t = texto.value.trim().toUpperCase()
  errorBusqueda.value = ''
  buscado.value = ''
  if (!t) return
  if (/^\d+$/.test(t)) errorBusqueda.value = v.dni(t)
  else errorBusqueda.value = v.codigoRetiro(t)
  if (!errorBusqueda.value) buscado.value = t
}

function limpiar() {
  texto.value = ''
  buscado.value = ''
  errorBusqueda.value = ''
}

const esDni = computed(() => /^\d{7,8}$/.test(buscado.value))
const alumnoBuscado = computed(() => (esDni.value ? alumnos.value.find((a) => a.dni === buscado.value) || null : null))

// Filas para entregar: individuales y, si se buscó un alumno, también las de clase
const filas = computed(() => {
  if (!buscado.value) return vigentes.value.map(filaIndividual)
  if (!esDni.value) return vigentes.value.filter((s) => s.codigo_retiro === buscado.value).map(filaIndividual)
  const al = alumnoBuscado.value
  if (!al) return []
  const individuales = vigentes.value.filter((s) => s.alumno_id === al.id).map(filaIndividual)
  const deClase = clasesDeHoy.value
    .filter((a) => a.curso === al.curso && !a.retirados.includes(al.id))
    .map((a) => ({
      clave: 'c' + a.id,
      tipo: 'clase',
      alumno_nombre: al.nombre,
      alumno_dni: al.dni,
      curso: al.curso,
      elemento: `${a.herramienta_codigo} · ${a.herramienta_nombre}`,
      cantidad: a.cantidad_por_alumno,
      docente: a.docente_nombre,
      vale: 'Solo hoy',
      codigo: '',
      destino: { path: '/prestamos/nuevo', query: { clase: a.id, persona: al.id } }
    }))
  return [...individuales, ...deClase]
})

function filaIndividual(s) {
  return {
    clave: 's' + s.id,
    tipo: 'individual',
    alumno_nombre: s.alumno_nombre,
    alumno_dni: s.alumno_dni,
    curso: s.curso,
    elemento: `${s.herramienta_codigo} · ${s.herramienta_nombre}`,
    cantidad: s.cantidad_autorizada,
    docente: s.autorizado_por_nombre,
    vale: 'Hasta ' + formatearFechaHora(s.vence),
    codigo: s.codigo_retiro,
    destino: { path: '/prestamos/nuevo', query: { retiro: s.id } }
  }
}

// Explica por qué no aparece nada (código vencido, ya retirado, alumno sin autorización…)
const explicacion = computed(() => {
  if (!buscado.value || filas.value.length) return ''
  if (!esDni.value) {
    const s = solicitudes.value.find((x) => x.codigo_retiro === buscado.value)
    if (!s) return `No existe ninguna autorización con el código ${buscado.value}.`
    if (s.estado_visible === 'vencida') return `El código ${buscado.value} venció el ${formatearFechaHora(s.vence)}: pasaron más de 48 horas sin retirarlo. El alumno tiene que pedirlo de nuevo.`
    return `El código ${buscado.value} no se puede usar: la solicitud está "${ESTADO_SOLICITUD[s.estado_visible]}".`
  }
  const al = alumnoBuscado.value
  if (!al) return `No hay ningún alumno activo con DNI ${buscado.value}.`
  const usadas = clasesDeHoy.value.filter((a) => a.curso === al.curso && a.retirados.includes(al.id))
  if (usadas.length) return `${al.nombre} ya retiró hoy con la autorización de clase de Prof. ${usadas[0].docente_nombre}.`
  return `${al.nombre} (${al.curso}) no tiene autorización vigente de un docente. Sin autorización no se le puede prestar.`
})

function entregar(f) {
  router.push(f.destino)
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Listas para retirar</h1>
        <p>Pedidos de alumnos autorizados por un docente. Buscá por DNI o por el código que muestra el alumno.</p>
      </div>
      <EtiquetaPrueba />
    </div>

    <form class="tarjeta formulario" novalidate @submit.prevent="buscar">
      <Campo etiqueta="DNI del alumno o código de retiro" para="buscar" :error="errorBusqueda" ayuda="Ej.: 47222333 o K7MP">
        <div class="buscador">
          <input id="buscar" v-model="texto" type="search" autocomplete="off" maxlength="8" placeholder="DNI o código" />
          <button class="primario" type="submit">Buscar</button>
          <button v-if="buscado || texto" type="button" @click="limpiar">Ver todas</button>
        </div>
      </Campo>
    </form>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>

    <template v-else>
      <div v-if="alumnoBuscado" class="aviso info">
        <strong>{{ alumnoBuscado.nombre }}</strong> · DNI {{ alumnoBuscado.dni }} · {{ alumnoBuscado.curso }}
      </div>
      <div v-if="explicacion" class="aviso alerta">{{ explicacion }}</div>

      <section class="tarjeta">
        <h2>{{ buscado ? 'Resultado' : `Autorizaciones individuales vigentes (${vigentes.length})` }}</h2>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead>
              <tr><th>Alumno</th><th>Elemento</th><th>Cant.</th><th>Autorización</th><th>Vale</th><th>Acción</th></tr>
            </thead>
            <tbody>
              <tr v-for="f in filas" :key="f.clave">
                <td data-label="Alumno">{{ f.alumno_nombre }}<br /><span class="suave">DNI {{ f.alumno_dni }} · {{ f.curso }}</span></td>
                <td data-label="Elemento">{{ f.elemento }}</td>
                <td data-label="Cant.">{{ f.cantidad }}</td>
                <td data-label="Autorización">
                  <span v-if="f.tipo === 'individual'" class="badge azul">Individual</span>
                  <span v-else class="badge verde">Autorizado por clase (Prof. {{ f.docente }})</span>
                  <div v-if="f.tipo === 'individual'" class="suave">Prof. {{ f.docente }} · código <strong>{{ f.codigo }}</strong></div>
                </td>
                <td data-label="Vale">{{ f.vale }}</td>
                <td data-label="Acción"><button class="chico primario" @click="entregar(f)">Entregar</button></td>
              </tr>
              <tr v-if="!filas.length"><td class="vacio" colspan="6">{{ buscado ? 'Nada para entregar.' : 'No hay autorizaciones individuales vigentes.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="!buscado" class="tarjeta">
        <h2>Autorizaciones de clase de hoy ({{ clasesDeHoy.length }})</h2>
        <p class="suave">Cualquier alumno de ese curso puede retirar una vez. Buscalo por DNI para entregarle.</p>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead><tr><th>Curso</th><th>Elemento</th><th>Por alumno</th><th>Docente</th><th>Retiraron</th><th>Estado</th></tr></thead>
            <tbody>
              <tr v-for="a in clasesDeHoy" :key="a.id">
                <td data-label="Curso">{{ a.curso }}</td>
                <td data-label="Elemento">{{ a.herramienta_codigo }} · {{ a.herramienta_nombre }}</td>
                <td data-label="Por alumno">{{ a.cantidad_por_alumno }}</td>
                <td data-label="Docente">Prof. {{ a.docente_nombre }}</td>
                <td data-label="Retiraron">{{ a.retirados.length }} alumno(s)</td>
                <td data-label="Estado"><EstadoBadge estado="activa" /> <span class="suave">{{ formatear(a.fecha) }}</span></td>
              </tr>
              <tr v-if="!clasesDeHoy.length"><td class="vacio" colspan="6">No hay autorizaciones de clase para hoy.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.buscador { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.buscador input { flex: 1; min-width: 180px; text-transform: uppercase; }
</style>
