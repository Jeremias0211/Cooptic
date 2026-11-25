<script setup>
// ALUMNO: pide una herramienta con autorización digital de un docente (reemplaza la notita en papel).
// Flujo: alumno pide → docente autoriza (código de retiro, vale 48 h) → pañolero entrega.
import { ref, reactive, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { sesion } from '../store/sesion'
import { ejecutar, confirmar } from '../store/ui'
import { estadoSolicitud } from '../utils/estados'
import { formatear, formatearFechaHora, horasHasta } from '../utils/fechas'
import * as v from '../utils/validar'

const cargando = ref(true)
const error = ref('')
const solicitudes = ref([])
const herramientas = ref([])
const docentes = ref([])
const errores = ref({})
const guardando = ref(false)
const miCurso = sesion.usuario.curso

const form = reactive({ herramienta_id: '', cantidad: 1, motivo: '', docente_id: '' })

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [s, h, d] = await Promise.all([api.listarSolicitudesAlumnos(), api.listarHerramientas(), api.listarDocentes()])
    solicitudes.value = s.map((x) => ({ ...x, estado_visible: estadoSolicitud(x) }))
    herramientas.value = h.filter((x) => x.activo)
    // Solo aparecen los docentes que tienen a cargo el curso del alumno
    docentes.value = d.filter((x) => (x.cursos || []).includes(miCurso))
    if (docentes.value.length === 1) form.docente_id = docentes.value[0].id
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const elegida = computed(() => herramientas.value.find((h) => h.id === Number(form.herramienta_id)))
const autorizadas = computed(() => solicitudes.value.filter((s) => s.estado_visible === 'autorizada'))

function validar() {
  errores.value = v.juntarErrores({
    herramienta_id: [v.obligatorio(form.herramienta_id, 'La herramienta o material')],
    cantidad: [v.entero(form.cantidad, { min: 1, max: elegida.value?.cantidad_total || 1, nombre: 'La cantidad' })],
    motivo: [v.obligatorio(form.motivo, 'El motivo o actividad'), v.largo(form.motivo, { min: 5, max: 200, nombre: 'El motivo' })],
    docente_id: [v.obligatorio(form.docente_id, 'El docente que autoriza'), v.unoDe(form.docente_id, docentes.value.map((d) => d.id), 'El docente')]
  })
  return Object.keys(errores.value).length === 0
}

async function enviar() {
  if (!validar()) return
  guardando.value = true
  const ok = await ejecutar(
    () => api.crearSolicitudAlumno({ herramienta_id: Number(form.herramienta_id), cantidad: Number(form.cantidad), motivo: form.motivo.trim(), docente_id: form.docente_id }),
    'Pedido enviado. Cuando tu docente lo autorice vas a ver acá el código de retiro.'
  )
  guardando.value = false
  if (ok) {
    Object.assign(form, { herramienta_id: '', cantidad: 1, motivo: '' })
    errores.value = {}
    cargar()
  }
}

async function cancelar(s) {
  const si = await confirmar({
    titulo: 'Cancelar pedido',
    texto: `Vas a cancelar el pedido de ${s.cantidad} × ${s.herramienta_nombre}. Queda en tu historial como cancelado.`,
    textoBoton: 'Cancelar pedido',
    peligro: true
  })
  if (si && (await ejecutar(() => api.cancelarSolicitudAlumno(s.id), 'Pedido cancelado.'))) cargar()
}

function puedeCancelar(s) {
  return ['esperando_autorizacion', 'autorizada'].includes(s.estado_visible)
}

function textoVigencia(s) {
  const h = horasHasta(s.vence)
  return h >= 1 ? `faltan ${h} h` : 'vence en menos de 1 hora'
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Pedir herramienta</h1>
        <p>Pedí lo que necesitás y elegí al docente que te autoriza. Ya no hace falta la notita en papel.</p>
      </div>
      <EtiquetaPrueba />
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>

    <template v-else>
      <!-- Pedidos autorizados: el código se muestra en grande para leerlo en el pañol -->
      <section v-for="s in autorizadas" :key="'cod' + s.id" class="tarjeta tarjeta-codigo" aria-live="polite">
        <p class="suave">Mostrá este código en el pañol</p>
        <div class="codigo-retiro" :aria-label="'Código de retiro ' + s.codigo_retiro.split('').join(' ')">{{ s.codigo_retiro }}</div>
        <p><strong>{{ s.cantidad_autorizada }} × {{ s.herramienta_nombre }}</strong> <span class="suave">({{ s.herramienta_codigo }})</span></p>
        <p v-if="s.cantidad_autorizada < s.cantidad" class="suave">Pediste {{ s.cantidad }}; el docente autorizó {{ s.cantidad_autorizada }}.</p>
        <p>Autorizó: <strong>Prof. {{ s.autorizado_por_nombre }}</strong></p>
        <p>Vale hasta: <strong>{{ formatearFechaHora(s.vence) }}</strong> <span class="suave">({{ textoVigencia(s) }})</span></p>
        <p class="suave">Devolución: {{ formatear(s.fecha_limite) }}</p>
        <button class="chico" @click="cancelar(s)">Cancelar pedido</button>
      </section>

      <div v-if="!miCurso" class="aviso error">Tu perfil no tiene curso asignado. Pedile al administrador que lo cargue para poder hacer pedidos.</div>
      <div v-else-if="!docentes.length" class="aviso alerta">Todavía no hay docentes con el curso {{ miCurso }} a cargo. Avisale al administrador.</div>

      <section v-else class="tarjeta">
        <h2>Nuevo pedido</h2>
        <form class="formulario" novalidate @submit.prevent="enviar">
          <Campo etiqueta="Herramienta o material" para="p-h" :error="errores.herramienta_id" obligatorio>
            <select id="p-h" v-model="form.herramienta_id">
              <option value="">Elegí…</option>
              <option v-for="h in herramientas" :key="h.id" :value="h.id">{{ h.codigo }} · {{ h.nombre }} ({{ h.cantidad_disponible }} disponibles hoy)</option>
            </select>
          </Campo>
          <div class="fila-campos">
            <Campo etiqueta="Cantidad" para="p-c" :error="errores.cantidad" obligatorio :ayuda="elegida ? `Entre 1 y ${elegida.cantidad_total}` : ''">
              <input id="p-c" v-model="form.cantidad" type="number" min="1" :max="elegida?.cantidad_total" />
            </Campo>
            <Campo etiqueta="Docente que autoriza" para="p-d" :error="errores.docente_id" obligatorio :ayuda="`Docentes de ${miCurso}`">
              <select id="p-d" v-model="form.docente_id">
                <option value="">Elegí…</option>
                <option v-for="d in docentes" :key="d.id" :value="d.id">Prof. {{ d.nombre }}</option>
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Motivo o actividad" para="p-m" :error="errores.motivo" obligatorio ayuda="Entre 5 y 200 caracteres">
            <input id="p-m" v-model="form.motivo" maxlength="200" placeholder="Ej.: Trabajo práctico de instalación eléctrica" />
          </Campo>
          <p v-if="elegida && Number(form.cantidad) > elegida.cantidad_disponible" class="aviso alerta">
            Hoy hay {{ elegida.cantidad_disponible }} disponibles. Podés pedirlo igual, pero el pañol entrega solo si hay stock al momento de retirar.
          </p>
          <div class="acciones">
            <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Enviando…' : 'Enviar pedido' }}</button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <h2>Mis pedidos</h2>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead>
              <tr><th>Pedido</th><th>Elemento</th><th>Cant.</th><th>Docente</th><th>Estado</th><th>Detalle</th><th>Acción</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in solicitudes" :key="s.id">
                <td data-label="Pedido">{{ formatear(s.fecha) }}</td>
                <td data-label="Elemento">{{ s.herramienta_codigo }} · {{ s.herramienta_nombre }}</td>
                <td data-label="Cant.">{{ s.cantidad_autorizada || s.cantidad }}</td>
                <td data-label="Docente">Prof. {{ s.autorizado_por_nombre || s.docente_nombre }}</td>
                <td data-label="Estado"><EstadoBadge :estado="s.estado_visible" /></td>
                <td data-label="Detalle">
                  <span v-if="s.estado_visible === 'autorizada'">Código <strong>{{ s.codigo_retiro }}</strong></span>
                  <span v-else-if="s.estado_visible === 'vencida'" class="suave">Venció el {{ formatearFechaHora(s.vence) }} sin retirarse</span>
                  <span v-else-if="s.estado_visible === 'retirada'" class="suave">Préstamo #{{ s.prestamo_numero || '—' }}</span>
                  <span v-else-if="s.estado_visible === 'rechazada'">{{ s.respuesta }}</span>
                  <span v-else class="suave">{{ s.motivo }}</span>
                </td>
                <td data-label="Acción">
                  <button v-if="puedeCancelar(s)" class="chico" @click="cancelar(s)">Cancelar</button>
                  <span v-else class="suave">—</span>
                </td>
              </tr>
              <tr v-if="!solicitudes.length"><td class="vacio" colspan="7">Todavía no hiciste pedidos.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tarjeta-codigo { text-align: center; border-left: 4px solid var(--primario); }
.tarjeta-codigo p { margin: 0.25rem 0; }
.codigo-retiro {
  display: inline-block;
  margin: 0.4rem 0 0.6rem;
  padding: 0.4rem 0.9rem 0.4rem 1.2rem; /* la derecha compensa el espacio entre letras */
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 3.2rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: var(--primario-oscuro);
  background: var(--primario-claro);
  border: 2px dashed var(--primario);
  border-radius: var(--radio);
}
</style>
