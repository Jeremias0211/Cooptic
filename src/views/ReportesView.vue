<script setup>
// Reportes basados en la Actividad de Investigación (Parte 4):
// 1) ¿Qué herramientas se piden más?  2) ¿Con qué frecuencia hay devoluciones
// fuera de término, roturas o pérdidas?  3) ¿El stock alcanza?
import { ref, computed, onMounted } from 'vue'
import Cargando from '../components/Cargando.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { estadoStock } from '../utils/estados'
import { hoyISO, sumarDias, ultimosMeses, nombreMes, formatear } from '../utils/fechas'

const cargando = ref(true)
const error = ref('')
const prestamos = ref([])
const incidencias = ref([])
const herramientas = ref([])
const solicitudes = ref([])
const periodo = ref('90')

onMounted(async () => {
  try {
    const [p, i, h, s] = await Promise.all([api.listarPrestamos(), api.listarIncidencias(), api.listarHerramientas(), api.listarSolicitudes()])
    prestamos.value = p
    incidencias.value = i
    herramientas.value = h.filter((x) => x.activo)
    solicitudes.value = s
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
})

const desde = computed(() => (periodo.value === 'todo' ? '0000-00-00' : sumarDias(hoyISO(), -Number(periodo.value))))
const pEnPeriodo = computed(() => prestamos.value.filter((p) => p.estado !== 'cancelado' && p.fecha_salida >= desde.value))
const iEnPeriodo = computed(() => incidencias.value.filter((i) => i.fecha >= desde.value).sort((a, b) => b.fecha.localeCompare(a.fecha)))

function porcentaje(a, b) {
  return b ? Math.round((a / b) * 1000) / 10 + '%' : 'No aplica'
}

// 1) Más solicitadas
const ranking = computed(() => {
  const mapa = {}
  for (const p of pEnPeriodo.value) {
    mapa[p.herramienta_id] ??= { nombre: `${p.herramienta_codigo} · ${p.herramienta_nombre}`, prestamos: 0, unidades: 0 }
    mapa[p.herramienta_id].prestamos++
    mapa[p.herramienta_id].unidades += p.cantidad
  }
  return Object.values(mapa).sort((a, b) => b.prestamos - a.prestamos || b.unidades - a.unidades).slice(0, 10)
})
const maxRanking = computed(() => Math.max(1, ...ranking.value.map((r) => r.prestamos)))

// 2) Problemas en devoluciones
const cerrados = computed(() => pEnPeriodo.value.filter((p) => p.devolucion))
const fueraDeTermino = computed(() => cerrados.value.filter((p) => p.devolucion.fecha_real > p.fecha_limite))
const vencidosAhora = computed(() => prestamos.value.filter((p) => p.estado === 'activo' && p.fecha_limite < hoyISO()))
const roturas = computed(() => iEnPeriodo.value.filter((i) => i.tipo === 'rotura'))
const perdidas = computed(() => iEnPeriodo.value.filter((i) => i.tipo === 'perdida'))

const porCurso = computed(() => {
  const mapa = {}
  for (const p of pEnPeriodo.value) {
    const c = p.curso || 'Sin curso (docentes)'
    mapa[c] ??= { curso: c, prestamos: 0, fuera: 0, danos: 0 }
    mapa[c].prestamos++
    if (p.devolucion && p.devolucion.fecha_real > p.fecha_limite) mapa[c].fuera++
    if (p.devolucion && p.devolucion.estado_al_devolver !== 'bueno') mapa[c].danos++
  }
  return Object.values(mapa).sort((a, b) => b.prestamos - a.prestamos)
})

// 3) ¿Alcanza el stock?
const suficiencia = computed(() =>
  herramientas.value
    .map((h) => {
      const prestadasAhora = prestamos.value.filter((p) => p.estado === 'activo' && p.herramienta_id === h.id).reduce((s, p) => s + p.cantidad, 0)
      const rechazadas = solicitudes.value.filter((s) => s.herramienta_id === h.id && s.estado === 'rechazada' && s.fecha >= desde.value).length
      const pedidoMaximo = Math.max(0, ...pEnPeriodo.value.filter((p) => p.herramienta_id === h.id).map((p) => p.cantidad))
      const ocupacion = h.cantidad_total ? Math.round((prestadasAhora / h.cantidad_total) * 100) : 0
      const revisar = rechazadas > 0 || ocupacion >= 70 || estadoStock(h) !== 'disponible'
      return { ...h, prestadasAhora, rechazadas, pedidoMaximo, ocupacion, revisar }
    })
    .sort((a, b) => Number(b.revisar) - Number(a.revisar) || b.ocupacion - a.ocupacion)
)

// Préstamos por mes (variable "fecha del préstamo")
const porMes = computed(() =>
  ultimosMeses(6).reverse().map((m) => ({
    mes: nombreMes(m),
    cantidad: prestamos.value.filter((p) => p.estado !== 'cancelado' && p.fecha_salida.startsWith(m)).length
  }))
)
const maxMes = computed(() => Math.max(1, ...porMes.value.map((m) => m.cantidad)))
const promedioCantidad = computed(() =>
  pEnPeriodo.value.length ? (pEnPeriodo.value.reduce((s, p) => s + p.cantidad, 0) / pEnPeriodo.value.length).toFixed(1) : '—'
)
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>Reportes</h1>
        <p>Para decidir qué reponer y detectar problemas en préstamos y devoluciones.</p>
      </div>
      <div class="acciones">
        <EtiquetaPrueba />
        <select v-model="periodo" aria-label="Período" style="width: auto">
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="180">Últimos 6 meses</option>
          <option value="todo">Todo el historial</option>
        </select>
      </div>
    </div>

    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>

    <template v-else>
      <p class="suave">Período: desde {{ periodo === 'todo' ? 'el inicio' : formatear(desde) }} hasta {{ formatear(hoyISO()) }}.</p>

      <div class="grilla">
        <div class="tarjeta"><div class="numero-grande">{{ pEnPeriodo.length }}</div><div class="suave">Préstamos en el período</div></div>
        <div class="tarjeta"><div class="numero-grande">{{ promedioCantidad }}</div><div class="suave">Unidades promedio por préstamo</div></div>
        <div class="tarjeta"><div class="numero-grande">{{ porcentaje(fueraDeTermino.length, cerrados.length) }}</div><div class="suave">Devoluciones fuera de término ({{ fueraDeTermino.length }} de {{ cerrados.length }})</div></div>
        <div class="tarjeta"><div class="numero-grande">{{ roturas.length }} / {{ perdidas.length }}</div><div class="suave">Roturas / pérdidas registradas</div></div>
      </div>

      <div class="grilla-2">
        <section class="tarjeta">
          <h2>1. Herramientas y materiales más prestados</h2>
          <div v-for="r in ranking" :key="r.nombre" class="barra-fila">
            <span>{{ r.nombre }}</span>
            <div class="barra-fondo"><div class="barra-dato" :style="{ width: (r.prestamos / maxRanking) * 100 + '%' }"></div></div>
            <span class="valor">{{ r.prestamos }}</span>
          </div>
          <p v-if="!ranking.length" class="vacio">No hubo préstamos en el período.</p>
          <p class="suave">Cantidad de préstamos por elemento (sin contar cancelados).</p>
        </section>

        <section class="tarjeta">
          <h2>Préstamos por mes</h2>
          <div v-for="m in porMes" :key="m.mes" class="barra-fila">
            <span>{{ m.mes }}</span>
            <div class="barra-fondo"><div class="barra-dato" :style="{ width: (m.cantidad / maxMes) * 100 + '%' }"></div></div>
            <span class="valor">{{ m.cantidad }}</span>
          </div>
        </section>
      </div>

      <section class="tarjeta">
        <h2>2. Devoluciones fuera de término, roturas y pérdidas por curso</h2>
        <p v-if="vencidosAhora.length" class="aviso alerta">Hoy hay {{ vencidosAhora.length }} préstamo(s) vencido(s) sin devolver. <RouterLink to="/prestamos?estado=vencido">Ver vencidos</RouterLink></p>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead><tr><th>Curso</th><th>Préstamos</th><th>Fuera de término</th><th>Dañados o perdidos</th></tr></thead>
            <tbody>
              <tr v-for="c in porCurso" :key="c.curso">
                <td data-label="Curso">{{ c.curso }}</td>
                <td data-label="Préstamos">{{ c.prestamos }}</td>
                <td data-label="Fuera de término">{{ c.fuera }}</td>
                <td data-label="Dañados o perdidos">{{ c.danos }}</td>
              </tr>
              <tr v-if="!porCurso.length"><td class="vacio" colspan="4">Sin datos en el período.</td></tr>
            </tbody>
          </table>
        </div>
        <h3 style="margin-top: 1rem">Incidencias del período</h3>
        <ul>
          <li v-for="i in iEnPeriodo" :key="i.id">
            {{ formatear(i.fecha) }} · {{ i.tipo === 'rotura' ? 'Rotura' : 'Pérdida' }} de {{ i.cantidad }} × {{ i.herramienta_nombre }} — {{ i.responsable_nombre }}
            <EstadoBadge :estado="i.estado" />
          </li>
          <li v-if="!iEnPeriodo.length" class="suave">No hubo incidencias.</li>
        </ul>
      </section>

      <section class="tarjeta">
        <h2>3. ¿El stock alcanza?</h2>
        <p class="suave">Se marca "Revisar" si hubo solicitudes rechazadas, si hoy está prestado el 70% o más, o si tiene stock bajo.</p>
        <div class="tabla-envoltorio">
          <table class="tabla-responsive">
            <thead><tr><th>Elemento</th><th>Total</th><th>Disponible</th><th>Prestado hoy</th><th>Pedido máximo</th><th>Solicitudes rechazadas</th><th>Situación</th></tr></thead>
            <tbody>
              <tr v-for="h in suficiencia" :key="h.id">
                <td data-label="Elemento">{{ h.codigo }} · {{ h.nombre }}</td>
                <td data-label="Total">{{ h.cantidad_total }}</td>
                <td data-label="Disponible">{{ h.cantidad_disponible }}</td>
                <td data-label="Prestado hoy">{{ h.prestadasAhora }} ({{ h.ocupacion }}%)</td>
                <td data-label="Pedido máximo">{{ h.pedidoMaximo || '—' }}</td>
                <td data-label="Solicitudes rechazadas">{{ h.rechazadas }}</td>
                <td data-label="Situación"><span class="badge" :class="h.revisar ? 'amarillo' : 'verde'">{{ h.revisar ? 'Revisar' : 'Alcanza' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
