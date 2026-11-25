<script setup>
import { ref, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { sesion, tiene } from '../store/sesion'
import { estadoPrestamo, estadoStock, estadoSolicitud } from '../utils/estados'
import { formatear, formatearFechaHora, hoyISO, diferenciaDias } from '../utils/fechas'

const cargando = ref(true)
const error = ref('')
const prestamos = ref([])
const herramientas = ref([])
const solicitudes = ref([])
const pedidosAlumnos = ref([]) // autorización digital del docente
const clasesHoy = ref([])
const usaPedidos = computed(() => tiene('pedirPrestamoAlumno') || tiene('autorizarPedidos') || tiene('verListasParaRetirar'))

const rol = computed(() => sesion.usuario.rol)
const gestiona = computed(() => tiene('gestionarPrestamos'))

onMounted(cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const [p, h, s, pa, ac] = await Promise.all([
      api.listarPrestamos(),
      api.listarHerramientas(),
      tiene('verSolicitudes') ? api.listarSolicitudes() : Promise.resolve([]),
      usaPedidos.value ? api.listarSolicitudesAlumnos() : Promise.resolve([]),
      tiene('verListasParaRetirar') ? api.listarAutorizacionesClase() : Promise.resolve([])
    ])
    prestamos.value = p.map((x) => ({ ...x, estado_visible: estadoPrestamo(x) }))
    herramientas.value = h
    solicitudes.value = s
    pedidosAlumnos.value = pa.map((x) => ({ ...x, estado_visible: estadoSolicitud(x) }))
    clasesHoy.value = ac.filter((a) => a.estado === 'activa' && a.fecha === hoyISO())
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const activos = computed(() => prestamos.value.filter((p) => p.estado === 'activo'))
const vencidos = computed(() => activos.value.filter((p) => p.estado_visible === 'vencido'))
const stockBajo = computed(() => herramientas.value.filter((h) => ['stock_bajo', 'sin_stock'].includes(estadoStock(h))))
const pendientes = computed(() => solicitudes.value.filter((s) => s.estado === 'pendiente'))
const esperandoAutorizacion = computed(() => pedidosAlumnos.value.filter((s) => s.estado_visible === 'esperando_autorizacion'))
const listasParaRetirar = computed(() => pedidosAlumnos.value.filter((s) => s.estado_visible === 'autorizada'))
// Primero los vencidos, después por fecha límite más próxima
const activosOrdenados = computed(() => [...activos.value].sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite)))

function diasRestantes(p) {
  const d = diferenciaDias(hoyISO(), p.fecha_limite)
  if (d < 0) return `Venció hace ${-d} día${d === -1 ? '' : 's'}`
  if (d === 0) return 'Vence hoy'
  return `Faltan ${d} día${d === 1 ? '' : 's'}`
}
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Hola, {{ sesion.usuario.nombre.split(' ')[0] }}</h1>
        <p v-if="rol === 'alumno'">Tus préstamos y fechas de devolución.</p>
        <p v-else-if="rol === 'docente'">Préstamos de tus cursos ({{ sesion.usuario.cursos.join(', ') }}) y disponibilidad.</p>
        <p v-else>Resumen del pañol al {{ formatear(hoyISO()) }}.</p>
      </div>
      <div class="acciones">
        <RouterLink v-if="gestiona" to="/prestamos/nuevo" class="boton primario">+ Nuevo préstamo</RouterLink>
        <RouterLink v-if="tiene('verListasParaRetirar')" to="/retirar" class="boton">Listas para retirar</RouterLink>
        <RouterLink v-if="tiene('pedirPrestamoAlumno')" to="/pedir" class="boton primario">Pedir herramienta</RouterLink>
        <RouterLink v-if="tiene('autorizarPedidos')" to="/autorizar" class="boton primario">Autorizar pedidos</RouterLink>
        <RouterLink v-if="rol === 'docente'" to="/solicitudes?nueva=1" class="boton primario">Solicitar herramientas</RouterLink>
        <RouterLink v-if="rol === 'docente'" to="/inventario" class="boton">Consultar disponibilidad</RouterLink>
      </div>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }} <button class="chico" @click="cargar">Reintentar</button></div>

    <template v-else>
      <!-- Indicadores rápidos -->
      <div class="grilla">
        <div class="tarjeta">
          <div class="numero-grande">{{ activos.length }}</div>
          <div class="suave">{{ rol === 'alumno' ? 'Préstamos pendientes de devolver' : 'Préstamos activos' }}</div>
        </div>
        <div class="tarjeta">
          <div class="numero-grande" :style="{ color: vencidos.length ? 'var(--rojo)' : '' }">{{ vencidos.length }}</div>
          <div class="suave">Vencidos</div>
        </div>
        <div v-if="rol !== 'alumno'" class="tarjeta">
          <div class="numero-grande">{{ stockBajo.length }}</div>
          <div class="suave">Elementos con stock bajo o sin stock</div>
        </div>
        <div v-if="tiene('verSolicitudes')" class="tarjeta">
          <div class="numero-grande">{{ pendientes.length }}</div>
          <div class="suave">{{ rol === 'docente' ? 'Mis solicitudes pendientes' : 'Solicitudes de docentes pendientes' }}</div>
        </div>
        <!-- Autorización digital del docente -->
        <div v-if="tiene('autorizarPedidos')" class="tarjeta">
          <div class="numero-grande" :style="{ color: esperandoAutorizacion.length ? 'var(--amarillo)' : '' }">{{ esperandoAutorizacion.length }}</div>
          <div class="suave">Autorizaciones pendientes ({{ esperandoAutorizacion.length }})</div>
          <RouterLink to="/autorizar">Revisar pedidos</RouterLink>
        </div>
        <div v-if="tiene('verListasParaRetirar')" class="tarjeta">
          <div class="numero-grande">{{ listasParaRetirar.length }}</div>
          <div class="suave">Listas para retirar ({{ listasParaRetirar.length }})<span v-if="clasesHoy.length"> + {{ clasesHoy.length }} autorización(es) de clase hoy</span></div>
          <RouterLink to="/retirar">Entregar</RouterLink>
        </div>
        <div v-if="tiene('pedirPrestamoAlumno')" class="tarjeta">
          <div class="numero-grande">{{ listasParaRetirar.length }}</div>
          <div class="suave">Pedidos autorizados para retirar</div>
          <RouterLink to="/pedir">Ver mis pedidos</RouterLink>
        </div>
      </div>

      <div v-if="rol === 'alumno' && listasParaRetirar.length" class="aviso info">
        <span v-for="s in listasParaRetirar" :key="s.id" class="linea-codigo">
          Tenés autorizado {{ s.cantidad_autorizada }} × {{ s.herramienta_nombre }}. Mostrá el código
          <strong class="codigo-chico">{{ s.codigo_retiro }}</strong> en el pañol (vale hasta {{ formatearFechaHora(s.vence) }}).
        </span>
      </div>

      <div v-if="rol === 'alumno' && vencidos.length" class="aviso error">
        Tenés {{ vencidos.length }} préstamo(s) vencido(s). Devolvelos en el pañol lo antes posible para no perder el derecho a pedir nuevos materiales.
      </div>

      <section class="tarjeta">
        <div class="encabezado">
          <h2>{{ rol === 'alumno' ? 'Mis préstamos pendientes' : 'Préstamos activos y vencidos' }}</h2>
          <EtiquetaPrueba />
        </div>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead>
              <tr>
                <th>N°</th>
                <th v-if="rol !== 'alumno'">Persona</th>
                <th>Elemento</th>
                <th>Cant.</th>
                <th>Devolver el</th>
                <th>Estado</th>
                <th v-if="gestiona">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in activosOrdenados.slice(0, 12)" :key="p.id">
                <td data-label="N°">#{{ p.numero }}</td>
                <td v-if="rol !== 'alumno'" data-label="Persona">{{ p.persona_nombre }}<span v-if="p.curso" class="suave"> · {{ p.curso }}</span></td>
                <td data-label="Elemento">{{ p.herramienta_nombre }}</td>
                <td data-label="Cant.">{{ p.cantidad }}</td>
                <td data-label="Devolver el">{{ formatear(p.fecha_limite) }}<br /><span class="suave">{{ diasRestantes(p) }}</span></td>
                <td data-label="Estado"><EstadoBadge :estado="p.estado_visible" /></td>
                <td v-if="gestiona" data-label="Acción">
                  <RouterLink class="boton chico" :to="`/prestamos/${p.id}/devolucion`">Devolución</RouterLink>
                </td>
              </tr>
              <tr v-if="!activosOrdenados.length"><td class="vacio" colspan="7">No hay préstamos pendientes.</td></tr>
            </tbody>
          </table>
        </div>
        <p v-if="activosOrdenados.length > 12" class="suave">Se muestran 12. <RouterLink to="/prestamos">Ver todos</RouterLink></p>
      </section>

      <section v-if="rol !== 'alumno' && stockBajo.length" class="tarjeta">
        <h2>Stock bajo</h2>
        <ul>
          <li v-for="h in stockBajo" :key="h.id">
            {{ h.codigo }} · {{ h.nombre }}: {{ h.cantidad_disponible }} de {{ h.cantidad_total }} disponibles
            <EstadoBadge :estado="estadoStock(h)" />
          </li>
        </ul>
        <RouterLink v-if="tiene('crearReposicion')" to="/reposiciones?nueva=1" class="boton chico">Pedir reposición</RouterLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.linea-codigo { display: block; }
.codigo-chico { font-family: ui-monospace, 'Courier New', monospace; font-size: 1.15rem; letter-spacing: 0.15em; }
</style>
