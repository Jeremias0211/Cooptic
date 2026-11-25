<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import { api } from '../services/api'
import { ejecutar, avisar, confirmar } from '../store/ui'
import { ROLES } from '../services/permisos'
import { coincide, estadoSolicitud } from '../utils/estados'
import { hoyISO, sumarDias, formatear, formatearFechaHora } from '../utils/fechas'
import * as v from '../utils/validar'

const router = useRouter()
const ruta = useRoute()
const cargando = ref(true)
const error = ref('')
const personas = ref([])
const herramientas = ref([])
const talleres = ref([])
const buscarPersona = ref('')
const buscarHerramienta = ref('')
const errores = ref({})
const guardando = ref(false)
// Entrega de algo autorizado por un docente (viene de "Listas para retirar")
const retiro = ref(null) // solicitud individual autorizada
const clase = ref(null) // autorización de clase
const bloqueado = computed(() => !!(retiro.value || clase.value))
let saltarFechaSugerida = false // para no pisar el plazo que fijó el docente

const form = reactive({
  persona_id: '',
  herramienta_id: '',
  cantidad: 1,
  fecha_limite: sumarDias(hoyISO(), 7),
  estado_al_prestar: 'bueno',
  solicitud_id: null,
  autorizacion_clase_id: null
})

onMounted(async () => {
  try {
    const [p, h, t] = await Promise.all([api.listarUsuarios(), api.listarHerramientas(), api.listarTalleres()])
    personas.value = p.filter((x) => x.activo)
    herramientas.value = h.filter((x) => x.activo)
    talleres.value = t
    // Si viene desde una solicitud de docente, se completa el formulario
    if (ruta.query.solicitud) {
      form.solicitud_id = Number(ruta.query.solicitud)
      form.persona_id = ruta.query.persona
      form.herramienta_id = Number(ruta.query.herramienta)
      form.cantidad = Number(ruta.query.cantidad) || 1
    }
    // Retiro de un pedido de alumno autorizado por un docente
    if (ruta.query.retiro) {
      const s = (await api.listarSolicitudesAlumnos()).find((x) => x.id === Number(ruta.query.retiro))
      if (!s) throw new Error('No se encontró la autorización.')
      if (estadoSolicitud(s) !== 'autorizada') {
        throw new Error(estadoSolicitud(s) === 'vencida'
          ? 'La autorización venció: pasaron más de 48 horas sin retirarla.'
          : 'Esa autorización ya no está disponible para retirar.')
      }
      retiro.value = s
      saltarFechaSugerida = true
      Object.assign(form, {
        solicitud_id: s.id,
        persona_id: s.alumno_id,
        herramienta_id: s.herramienta_id,
        cantidad: s.cantidad_autorizada,
        fecha_limite: s.fecha_limite > hoyISO() ? s.fecha_limite : hoyISO()
      })
    }
    // Retiro con autorización de clase
    if (ruta.query.clase) {
      const a = (await api.listarAutorizacionesClase()).find((x) => x.id === Number(ruta.query.clase))
      if (!a || a.estado !== 'activa' || a.fecha !== hoyISO()) throw new Error('La autorización de clase no está vigente hoy.')
      clase.value = a
      Object.assign(form, {
        autorizacion_clase_id: a.id,
        persona_id: ruta.query.persona,
        herramienta_id: a.herramienta_id,
        cantidad: a.cantidad_por_alumno
      })
    }
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
})

const personasFiltradas = computed(() =>
  personas.value.filter((p) => !buscarPersona.value || coincide(`${p.nombre} ${p.dni} ${p.curso || ''}`, buscarPersona.value)).slice(0, 50)
)
const herramientasFiltradas = computed(() =>
  herramientas.value.filter((h) => !buscarHerramienta.value || coincide(`${h.codigo} ${h.nombre}`, buscarHerramienta.value))
)
const herramientaElegida = computed(() => herramientas.value.find((h) => h.id === Number(form.herramienta_id)))
const personaElegida = computed(() => personas.value.find((p) => p.id === form.persona_id))
const maxAutorizado = computed(() => retiro.value?.cantidad_autorizada || clase.value?.cantidad_por_alumno || Infinity)

// Al elegir herramienta, la fecha sugerida usa el plazo configurado del taller
watch(herramientaElegida, (h) => {
  if (saltarFechaSugerida) {
    saltarFechaSugerida = false
    return
  }
  if (!h) return
  const plazo = talleres.value.find((t) => t.id === h.taller_id)?.plazo_dias || 7
  form.fecha_limite = sumarDias(hoyISO(), plazo)
})

function validar() {
  const disp = herramientaElegida.value?.cantidad_disponible ?? 0
  errores.value = v.juntarErrores({
    persona_id: [v.obligatorio(form.persona_id, 'La persona')],
    herramienta_id: [v.obligatorio(form.herramienta_id, 'La herramienta o material'), herramientaElegida.value && disp === 0 ? 'No hay unidades disponibles de este elemento.' : ''],
    cantidad: [
      v.entero(form.cantidad, { min: 1, max: Math.max(disp, 1), nombre: 'La cantidad' }),
      Number(form.cantidad) > maxAutorizado.value ? `El docente autorizó como máximo ${maxAutorizado.value}.` : ''
    ],
    fecha_limite: [v.fechaFutura(form.fecha_limite, 'La fecha de devolución'), form.fecha_limite > sumarDias(hoyISO(), 60) ? 'El plazo máximo es de 60 días.' : ''],
    estado_al_prestar: [v.unoDe(form.estado_al_prestar, ['bueno', 'regular'], 'El estado')]
  })
  return Object.keys(errores.value).length === 0
}

async function confirmarPrestamo() {
  if (!validar()) return
  if (bloqueado.value) {
    const si = await confirmar({
      titulo: 'Entregar',
      texto: `Vas a entregar ${form.cantidad} × ${herramientaElegida.value?.nombre} a ${personaElegida.value?.nombre}. El préstamo queda registrado a su nombre.`,
      textoBoton: 'Entregar'
    })
    if (!si) return
  }
  guardando.value = true
  let numero
  const ok = await ejecutar(async () => {
    numero = await api.registrarPrestamo({ ...form, herramienta_id: Number(form.herramienta_id), cantidad: Number(form.cantidad) })
  })
  guardando.value = false
  if (ok) {
    if (retiro.value) avisar(`Préstamo #${numero} registrado. La solicitud quedó como "Retirada".`)
    else if (clase.value) avisar(`Préstamo #${numero} registrado con la autorización de clase.`)
    else avisar(`Préstamo #${numero} registrado. El stock bajó automáticamente.`)
    router.push(bloqueado.value ? '/retirar' : '/panel')
  }
}
</script>

<template>
  <div class="angosto">
    <div class="encabezado">
      <div>
        <h1>Nuevo préstamo</h1>
        <p>Buscá a la persona y el elemento, definí cantidad y fecha de devolución.</p>
      </div>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <RouterLink v-if="ruta.query.retiro || ruta.query.clase" to="/retirar">Volver a listas para retirar</RouterLink></div>

    <form v-else class="tarjeta formulario" novalidate @submit.prevent="confirmarPrestamo">
      <div v-if="retiro" class="aviso info">
        <strong>Retiro autorizado por Prof. {{ retiro.autorizado_por_nombre }}</strong> · código {{ retiro.codigo_retiro }} · vale hasta {{ formatearFechaHora(retiro.vence) }}.<br />
        Al confirmar, la solicitud queda como "Retirada" y vinculada a este préstamo.
      </div>
      <div v-else-if="clase" class="aviso info">
        <strong>Autorizado por clase (Prof. {{ clase.docente_nombre }})</strong> para {{ clase.curso }}, hoy. Cada alumno retira una sola vez.
      </div>
      <div v-else-if="form.solicitud_id" class="aviso info">Este préstamo atiende la solicitud de un docente. Al confirmarlo, la solicitud queda como "Atendida".</div>
      <div v-else-if="personaElegida?.rol === 'alumno'" class="aviso alerta">
        Los alumnos necesitan autorización vigente de un docente. Si la tiene (individual o de clase) se vincula sola al confirmar;
        si no, el sistema no deja registrar el préstamo. <RouterLink to="/retirar">Ver listas para retirar</RouterLink>
      </div>

      <Campo v-if="bloqueado" etiqueta="Persona" obligatorio>
        <p class="dato-fijo">{{ personaElegida?.nombre || '—' }} · DNI {{ personaElegida?.dni }} · {{ personaElegida?.curso }}</p>
      </Campo>
      <Campo v-else etiqueta="Persona" para="persona" :error="errores.persona_id" obligatorio>
        <input v-model="buscarPersona" type="search" placeholder="Buscar alumno o docente por nombre, DNI o curso" aria-label="Buscar persona" />
        <select id="persona" v-model="form.persona_id" size="5">
          <option v-for="p in personasFiltradas" :key="p.id" :value="p.id">
            {{ p.nombre }} · DNI {{ p.dni }} · {{ ROLES[p.rol] }}{{ p.curso ? ' ' + p.curso : '' }}
          </option>
        </select>
      </Campo>

      <Campo v-if="bloqueado" etiqueta="Herramienta o material" :error="errores.herramienta_id" obligatorio>
        <p class="dato-fijo">{{ herramientaElegida?.codigo }} · {{ herramientaElegida?.nombre }} — {{ herramientaElegida?.cantidad_disponible }} disponible(s)</p>
      </Campo>
      <Campo v-else etiqueta="Herramienta o material" para="herramienta" :error="errores.herramienta_id" obligatorio>
        <input v-model="buscarHerramienta" type="search" placeholder="Buscar en inventario por código o nombre" aria-label="Buscar herramienta" />
        <select id="herramienta" v-model="form.herramienta_id" size="5">
          <option v-for="h in herramientasFiltradas" :key="h.id" :value="h.id" :disabled="h.cantidad_disponible === 0">
            {{ h.codigo }} · {{ h.nombre }} — {{ h.cantidad_disponible }} disponible(s)
          </option>
        </select>
      </Campo>

      <div class="fila-campos">
        <Campo etiqueta="Cantidad" para="cantidad" :error="errores.cantidad" obligatorio
               :ayuda="bloqueado ? `Autorizado: hasta ${maxAutorizado}` : herramientaElegida ? `Máximo ${herramientaElegida.cantidad_disponible}` : ''">
          <input id="cantidad" v-model="form.cantidad" type="number" min="1" :max="Math.min(herramientaElegida?.cantidad_disponible ?? 0, maxAutorizado)" />
        </Campo>
        <Campo etiqueta="Devolver el" para="fecha" :error="errores.fecha_limite" obligatorio :ayuda="`Hoy es ${formatear(hoyISO())}`">
          <input id="fecha" v-model="form.fecha_limite" type="date" :min="hoyISO()" />
        </Campo>
      </div>

      <Campo etiqueta="Estado al prestar" :error="errores.estado_al_prestar" obligatorio>
        <div class="opciones-radio">
          <label><input v-model="form.estado_al_prestar" type="radio" value="bueno" /> Bueno</label>
          <label><input v-model="form.estado_al_prestar" type="radio" value="regular" /> Regular (con detalles)</label>
        </div>
      </Campo>

      <div class="acciones">
        <RouterLink :to="bloqueado ? '/retirar' : '/panel'" class="boton">Cancelar</RouterLink>
        <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Registrando…' : bloqueado ? 'Confirmar entrega' : 'Confirmar préstamo' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.angosto { max-width: 720px; margin: 0 auto; }
select[size] { min-height: 130px; }
.dato-fijo { margin: 0; padding: 0.55rem 0.7rem; background: var(--gris-claro); border: 1px solid var(--borde); border-radius: 6px; }
</style>
