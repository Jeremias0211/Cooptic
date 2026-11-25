<script setup>
// Identifica los listados que muestran datos de prueba (solo en modo demo)
import { MODO_DEMO } from '../services/api'
</script>

<template>
  <span v-if="MODO_DEMO" class="badge amarillo" title="Registros ficticios cargados para probar el sistema">Datos de prueba</span>
</template>
