<script setup>
// Tablero de seguimiento de KPI (Actividad KPI, punto 8).
// Muestra período, fecha de actualización, meta y estado con color + etiqueta escrita.
// No muestra datos personales: solo cantidades.
import { ref, computed, onMounted, watch } from 'vue'
import Cargando from '../components/Cargando.vue'
import EtiquetaPrueba from '../components/EtiquetaPrueba.vue'
import { api } from '../services/api'
import { tiene } from '../store/sesion'
import { DEFINICION_KPI, SIMULACION_ACTIVIDAD, evaluar } from '../services/kpi'
import { mesActual, ultimosMeses, nombreMes, formatear, hoyISO } from '../utils/fechas'
import { estadoStock } from '../utils/estados'

const completo = tiene('verTableroKpi')
const meses = ultimosMeses(6)
const mes = ref(mesActual())
const fuente = ref('sistema')
const cargando = ref(true)
const error = ref('')
const conteos = ref(null)
const herramientas = ref([])
const actualizado = ref('')

onMounted(cargar)
watch(mes, cargar)

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    if (completo) conteos.value = await api.conteosKpi(mes.value)
    else herramientas.value = (await api.listarHerramientas()).filter((h) => h.activo)
    actualizado.value = new Date().toLocaleString('es-AR')
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

const filas = computed(() => {
  const datos = fuente.value === 'simulacion' ? SIMULACION_ACTIVIDAD : conteos.value
  if (!datos) return []
  return DEFINICION_KPI.map((k) => ({ ...k, ...datos[k.clave], resultado: evaluar(datos[k.clave], k.meta) }))
})

// Versión resumida para alumnos (solo disponibilidad general)
const resumen = computed(() => {
  const total = herramientas.value.length
  const conStock = herramientas.value.filter((h) => h.cantidad_disponible > 0).length
  const bajos = herramientas.value.filter((h) => estadoStock(h) !== 'disponible').length
  return { total, conStock, bajos }
})
</script>

<template>
  <div>
    <div class="encabezado">
      <div>
        <h1>{{ completo ? 'Tablero de indicadores (KPI)' : 'Estado del servicio' }}</h1>
        <p v-if="completo">Los cuatro indicadores de la precooperativa en un solo lugar. Se revisa una vez por mes.</p>
        <p v-else>Versión resumida para usuarios de los talleres.</p>
      </div>
      <EtiquetaPrueba />
    </div>

    <template v-if="completo">
      <div class="filtros" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
        <select v-model="mes" aria-label="Mes" :disabled="fuente === 'simulacion'">
          <option v-for="m in meses" :key="m" :value="m">{{ nombreMes(m) }}</option>
        </select>
        <select v-model="fuente" aria-label="Fuente de datos">
          <option value="sistema">Datos registrados en el sistema</option>
          <option value="simulacion">Simulación de la actividad (ficticia)</option>
        </select>
      </div>

      <Cargando v-if="cargando" />
      <div v-else-if="error" class="aviso error">{{ error }}</div>
      <template v-else>
        <div class="aviso info">
          <strong>Período:</strong> {{ fuente === 'simulacion' ? 'mes simulado (actividad KPI)' : nombreMes(mes) }} ·
          <strong>Actualizado:</strong> {{ actualizado }}
          <span v-if="fuente === 'simulacion'"> · Valores ficticios del documento de la actividad, solo para practicar la lectura.</span>
        </div>

        <div class="tabla-envoltorio tarjeta" style="padding: 0">
          <table class="tabla-responsive">
            <thead><tr><th>Categoría</th><th>Indicador</th><th>Meta</th><th>Cálculo</th><th>Resultado</th><th>Estado</th></tr></thead>
            <tbody>
              <tr v-for="f in filas" :key="f.clave">
                <td data-label="Categoría">{{ f.categoria }}</td>
                <td data-label="Indicador">{{ f.nombre }}</td>
                <td data-label="Meta">≥ {{ f.meta }}%</td>
                <td data-label="Cálculo">({{ f.num }} ÷ {{ f.den }}) × 100</td>
                <td data-label="Resultado"><strong>{{ f.resultado.texto }}</strong></td>
                <td data-label="Estado">
                  <span class="badge" :class="f.resultado.estado === 'na' ? 'gris' : f.resultado.estado">{{ f.resultado.etiqueta }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Fichas de los indicadores</h2>
        <div class="grilla-2">
          <section v-for="f in filas" :key="f.clave" class="tarjeta">
            <h3>{{ f.nombre }}</h3>
            <p><strong>Fórmula:</strong> {{ f.formula }}</p>
            <p><strong>Meta:</strong> al menos {{ f.meta }}% cada mes · <strong>Tipo:</strong> {{ f.tipo }}</p>
            <p><strong>Responsable:</strong> {{ f.responsable }}</p>
            <p class="suave">{{ f.nota }}</p>
          </section>
        </div>

        <section class="tarjeta">
          <h2>Criterios de colores</h2>
          <ul>
            <li><span class="badge verde">VERDE – Meta cumplida</span> el resultado alcanza o supera la meta.</li>
            <li><span class="badge amarillo">AMARILLO – Cerca de la meta</span> hasta 5 puntos porcentuales por debajo.</li>
            <li><span class="badge rojo">ROJO – Requiere atención</span> más de 5 puntos por debajo.</li>
            <li><span class="badge gris">No aplica</span> no hubo casos en el período: no se informa 0%.</li>
          </ul>
        </section>
      </template>
    </template>

    <template v-else>
      <Cargando v-if="cargando" />
      <div v-else class="grilla">
        <div class="tarjeta"><div class="numero-grande">{{ resumen.conStock }} / {{ resumen.total }}</div><div class="suave">Elementos con unidades disponibles hoy</div></div>
        <div class="tarjeta"><div class="numero-grande">{{ resumen.bajos }}</div><div class="suave">Elementos con poco stock</div></div>
        <div class="tarjeta"><p>Actualizado: {{ formatear(hoyISO()) }}</p><RouterLink to="/inventario">Ver catálogo completo</RouterLink></div>
      </div>
    </template>
  </div>
</template>
