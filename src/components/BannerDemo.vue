<script setup>
import { MODO_DEMO } from '../services/api'
</script>

<template>
  <div v-if="MODO_DEMO" class="banner" role="note">
    <strong>MODO DEMO</strong> · Datos de prueba ficticios guardados solo en este navegador · Roles simulados (sin contraseña).
    <RouterLink to="/acerca">Más info</RouterLink>
  </div>
</template>

<style scoped>
.banner { background: #fff4cc; color: #5c4400; border-bottom: 1px solid #f0d995; padding: 0.4rem 1rem; font-size: 0.88rem; text-align: center; }
</style>
