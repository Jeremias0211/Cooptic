<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Cargando from '../components/Cargando.vue'
import Campo from '../components/Campo.vue'
import EstadoBadge from '../components/EstadoBadge.vue'
import { api } from '../services/api'
import { ejecutar, confirmar } from '../store/ui'
import { estadoPrestamo } from '../utils/estados'
import { formatear, hoyISO, diferenciaDias } from '../utils/fechas'
import * as v from '../utils/validar'

const ruta = useRoute()
const router = useRouter()
const cargando = ref(true)
const error = ref('')
const prestamo = ref(null)
const form = reactive({ estado_al_devolver: '', observaciones: '' })
const errores = ref({})
const guardando = ref(false)

onMounted(async () => {
  try {
    prestamo.value = await api.obtenerPrestamo(ruta.params.id)
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
})

const atraso = computed(() => (prestamo.value ? diferenciaDias(prestamo.value.fecha_limite, hoyISO()) : 0))

async function confirmarDevolucion() {
  errores.value = v.juntarErrores({
    estado_al_devolver: [v.obligatorio(form.estado_al_devolver, 'El estado al devolver'), v.unoDe(form.estado_al_devolver, ['bueno', 'danado', 'perdido'], 'El estado')],
    // Si vuelve dañado o se perdió, hay que explicar qué pasó
    observaciones: form.estado_al_devolver && form.estado_al_devolver !== 'bueno'
      ? [v.obligatorio(form.observaciones, 'La descripción de lo ocurrido'), v.largo(form.observaciones, { min: 5, max: 300, nombre: 'La descripción' })]
      : [v.largo(form.observaciones, { max: 300, nombre: 'Las observaciones' })]
  })
  if (Object.keys(errores.value).length) return

  if (form.estado_al_devolver !== 'bueno') {
    const si = await confirmar({
      titulo: form.estado_al_devolver === 'danado' ? 'Registrar rotura' : 'Registrar pérdida',
      texto: 'El elemento NO vuelve al stock y se crea una incidencia a nombre de quien lo tenía. ¿Confirmás?',
      textoBoton: 'Confirmar',
      peligro: true
    })
    if (!si) return
  }

  guardando.value = true
  const mensaje = form.estado_al_devolver === 'bueno' ? 'Devolución registrada. El stock se repuso.' : 'Devolución registrada con incidencia para reposición.'
  const ok = await ejecutar(() => api.registrarDevolucion(prestamo.value.id, { ...form, observaciones: form.observaciones.trim() }), mensaje)
  guardando.value = false
  if (ok) router.push('/panel')
}
</script>

<template>
  <div class="angosto">
    <h1>Registrar devolución</h1>
    <Cargando v-if="cargando" />
    <div v-else-if="error" class="aviso error">{{ error }}</div>

    <template v-else>
      <section class="tarjeta">
        <div class="encabezado">
          <h2>Préstamo #{{ prestamo.numero }}</h2>
          <EstadoBadge :estado="estadoPrestamo(prestamo)" />
        </div>
        <p><strong>{{ prestamo.herramienta_nombre }}</strong> ({{ prestamo.herramienta_codigo }}) × {{ prestamo.cantidad }}</p>
        <p>{{ prestamo.persona_nombre }}<span v-if="prestamo.curso"> · {{ prestamo.curso }}</span></p>
        <p class="suave">
          Salida {{ formatear(prestamo.fecha_salida) }} · Límite {{ formatear(prestamo.fecha_limite) }} · Estado al prestar: {{ prestamo.estado_al_prestar }}
        </p>
        <div v-if="prestamo.estado === 'activo' && atraso > 0" class="aviso alerta">Se devuelve con {{ atraso }} día(s) de atraso: quedará como fuera de término.</div>
      </section>

      <div v-if="prestamo.estado !== 'activo'" class="aviso info">
        Este préstamo ya está {{ prestamo.estado }}. <RouterLink to="/prestamos">Volver a préstamos</RouterLink>
      </div>

      <form v-else class="tarjeta formulario" novalidate @submit.prevent="confirmarDevolucion">
        <Campo etiqueta="Estado al devolver" :error="errores.estado_al_devolver" obligatorio>
          <div class="opciones-radio" role="radiogroup">
            <label><input v-model="form.estado_al_devolver" type="radio" value="bueno" /> Bueno</label>
            <label><input v-model="form.estado_al_devolver" type="radio" value="danado" /> Dañado</label>
            <label><input v-model="form.estado_al_devolver" type="radio" value="perdido" /> Perdido</label>
          </div>
        </Campo>
        <Campo
          :etiqueta="form.estado_al_devolver && form.estado_al_devolver !== 'bueno' ? 'Qué ocurrió' : 'Observaciones'"
          para="obs" :error="errores.observaciones"
          :obligatorio="!!form.estado_al_devolver && form.estado_al_devolver !== 'bueno'"
        >
          <textarea id="obs" v-model="form.observaciones" maxlength="300" placeholder="Opcional si vuelve en buen estado"></textarea>
        </Campo>
        <p class="suave">Si vuelve en buen estado, el stock se repone solo. Si vuelve dañado o se perdió, queda registrado para la reposición.</p>
        <div class="acciones">
          <button type="button" @click="router.back()">Cancelar</button>
          <button class="primario" type="submit" :disabled="guardando">{{ guardando ? 'Registrando…' : 'Confirmar devolución' }}</button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.angosto { max-width: 720px; margin: 0 auto; }
</style>
