<script setup>
import { ui, cerrarAviso } from '../store/ui'
const iconos = { exito: '✓', error: '✕', info: 'i' }
</script>

<template>
  <div class="avisos" aria-live="polite">
    <div v-for="a in ui.avisos" :key="a.id" class="aviso-flotante" :class="a.tipo" role="status">
      <span class="icono">{{ iconos[a.tipo] }}</span>
      <span class="texto">{{ a.texto }}</span>
      <button class="cerrar" aria-label="Cerrar mensaje" @click="cerrarAviso(a.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.avisos { position: fixed; right: 1rem; bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; z-index: 50; max-width: min(420px, calc(100vw - 2rem)); }
.aviso-flotante { display: flex; align-items: flex-start; gap: 0.6rem; background: #fff; border: 1px solid var(--borde); border-left: 5px solid; border-radius: var(--radio); padding: 0.7rem 0.8rem; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); }
.exito { border-left-color: var(--verde); }
.error { border-left-color: var(--rojo); }
.info { border-left-color: var(--primario); }
.icono { font-weight: 700; }
.exito .icono { color: var(--verde); }
.error .icono { color: var(--rojo); }
.texto { flex: 1; }
.cerrar { min-height: auto; padding: 0 0.4rem; border: none; font-size: 1.2rem; background: transparent; }
</style>
