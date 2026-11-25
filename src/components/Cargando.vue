<script setup>
defineProps({ texto: { type: String, default: 'Cargando datos…' } })
</script>

<template>
  <div class="cargando" role="status">
    <span class="rueda" aria-hidden="true"></span>
    {{ texto }}
  </div>
</template>

<style scoped>
.cargando { display: flex; align-items: center; gap: 0.6rem; padding: 1.5rem; color: var(--texto-suave); justify-content: center; }
.rueda { width: 20px; height: 20px; border: 3px solid var(--borde); border-top-color: var(--primario); border-radius: 50%; animation: girar 0.8s linear infinite; }
@keyframes girar { to { transform: rotate(360deg); } }
</style>
