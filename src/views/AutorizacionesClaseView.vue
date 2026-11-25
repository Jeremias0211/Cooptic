<script setup>
// DOCENTE: autorización para TODA una clase. Cualquier alumno del curso puede retirar
// la herramienta ese día sin pedirla antes; cada alumno retira una sola vez.
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { sesion } from '../store/sesion'
import { ejecutar, confirmar } from '../store/ui'
import { estadoAutorizacionClase } from '../utils/estados'
import { formatear, hoyISO } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const autorizaciones = ref([])
const herramientas = ref([])
const errores = ref({})
const guardando = ref(false)
const cursos = sesion.usuario.cursos || []

const form = reactive({ curso: cursos[0] || '', herramienta_id: '', cantidad_por_alumno: 1, fecha: hoyISO() })

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [a, h] = await Promise.all([api.listarAutorizacionesClase(), api.listarHerramientas()])
    autorizaciones.value = a.map((x) => ({ ...x, estado_visible: estadoAutorizacionClase(x) }))
    herramientas.value = h.filter((x) => x.activo)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const elegida = computed(() => herramientas.value.find((h) => h.id === Number(form.herramienta_id)))

async function crear() {
  const disp = elegida.value?.cantidad_disponible ?? 0
  errores.value = v.juntarErrores({
    curso: [v.obligatorio(form.curso, 'El curso'), v.unoDe(form.curso, cursos, 'El curso')],
    herramienta_id: [v.obligatorio(form.herramienta_id, 'La herramienta'), elegida.value && disp === 0 ? 'No hay unidades disponibles de este elemento.' : ''],
    cantidad_por_alumno: [v.entero(form.cantidad_por_alumno, { min: 1, max: Math.max(disp, 1), nombre: 'La cantidad por alumno' })],
    fecha: [v.fechaFutura(form.fecha, 'La fecha')]
  })
  if (Object.keys(errores.value).length) return
  const si = await confirmar({
    titulo: 'Autorizar a toda la clase',
    texto: `Todos los alumnos de ${form.curso} van a poder retirar ${form.cantidad_por_alumno} × ${elegida.value.nombre} el ${formatear(form.fecha)}, una vez cada uno.`,
    textoBoton: 'Autorizar'
  })
  if (!si) return
  guardando.value = true
  const ok = await ejecutar(
    () => api.crearAutorizacionClase({ ...form, herramienta_id: Number(form.herramienta_id), cantidad_por_alumno: Number(form.cantidad_por_alumno) }),
    `Autorización de clase creada para ${form.curso}.`
  )
  guardando.value = false
  if (ok) {
    Object.assign(form, { herramienta_id: '', cantidad_por_alumno: 1 })
    errores.value = {}
    cargar()
  }
}

async function cancelar(a) {
  const si = await confirmar({
    titulo: 'Cancelar autorización de clase',
    texto: `Los alumnos de ${a.curso} que todavía no retiraron ya no van a poder hacerlo. Queda en el historial como cancelada.`,
    textoBoton: 'Cancelar autorización',
    peligro: true
  })
  if (si && (await ejecutar(() => api.cancelarAutorizacionClase(a.id), 'Autorización de clase cancelada.'))) cargar()
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Autorizaciones de clase</h1>
        <p>Autorizá a todo un curso a retirar una herramienta un día determinado, sin que cada alumno tenga que pedirla.</p>
      </div>
      <EtiquetaPrueba />
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>

    <template v-else>
      <section class="tarjeta">
        <h2>Nueva autorización de clase</h2>
        <form class="formulario" novalidate @submit.prevent="crear">
          <div class="fila-campos">
            <Campo etiqueta="Curso" para="c-cu" :error="errores.curso" obligatorio>
              <select id="c-cu" v-model="form.curso">
                <option v-for="c in cursos" :key="c" :value="c">{{ c }}</option>
              </select>
            </Campo>
            <Campo etiqueta="Fecha (vale ese día)" para="c-f" :error="errores.fecha" obligatorio>
              <input id="c-f" v-model="form.fecha" type="date" :min="hoyISO()" />
            </Campo>
          </div>
          <Campo etiqueta="Herramienta o material" para="c-h" :error="errores.herramienta_id" obligatorio>
            <select id="c-h" v-model="form.herramienta_id">
              <option value="">Elegí…</option>
              <option v-for="h in herramientas" :key="h.id" :value="h.id" :disabled="h.cantidad_disponible === 0">
                {{ h.codigo }} · {{ h.nombre }} ({{ h.cantidad_disponible }} disponibles hoy)
              </option>
            </select>
          </Campo>
          <Campo etiqueta="Cantidad por alumno" para="c-c" :error="errores.cantidad_por_alumno" obligatorio
                 :ayuda="elegida ? `Hay ${elegida.cantidad_disponible} disponibles: el pañol entrega mientras haya stock.` : ''">
            <input id="c-c" v-model="form.cantidad_por_alumno" type="number" min="1" :max="elegida?.cantidad_disponible" />
          </Campo>
          <div class="acciones">
            <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Autorizar a la clase' }}</button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Mis autorizaciones de clase</h2>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead>
              <tr><th>Fecha</th><th>Curso</th><th>Elemento</th><th>Por alumno</th><th>Retiraron</th><th>Estado</th><th>Acción</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in autorizaciones" :key="a.id">
                <td data-label="Fecha">{{ formatear(a.fecha) }}</td>
                <td data-label="Curso">{{ a.curso }}</td>
                <td data-label="Elemento">{{ a.herramienta_codigo }} · {{ a.herramienta_nombre }}</td>
                <td data-label="Por alumno">{{ a.cantidad_por_alumno }}</td>
                <td data-label="Retiraron">{{ a.retirados.length }} alumno(s)</td>
                <td data-label="Estado"><EstadoBadge :estado="a.estado_visible" /></td>
                <td data-label="Acción">
                  <button v-if="a.estado_visible === 'activa'" class="chico" @click="cancelar(a)">Cancelar</button>
                  <span v-else class="suave">—</span>
                </td>
              </tr>
              <tr v-if="!autorizaciones.length"><td class="vacio" colspan="7">Todavía no creaste autorizaciones de clase.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
