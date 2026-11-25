<script setup>
// Ventana para formularios (alta/edición). En celular ocupa toda la pantalla.
defineProps({ titulo: String })
const emit = defineEmits(['cerrar'])
</script>

<template>
  <div class="fondo" @click.self="emit('cerrar')" @keydown.esc="emit('cerrar')">
    <section class="modal" role="dialog" aria-modal="true" :aria-label="titulo">
      <header>
        <h2>{{ titulo }}</h2>
        <button class="chico" aria-label="Cerrar" @click="emit('cerrar')">Cerrar</button>
      </header>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: grid; place-items: center; z-index: 40; padding: 1rem; overflow-y: auto; }
.modal { background: #fff; border-radius: 10px; padding: 1.25rem; width: 100%; max-width: 640px; max-height: calc(100vh - 2rem); overflow-y: auto; }
header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
header h2 { margin: 0; }
@media (max-width: 760px) {
  .fondo { padding: 0; }
  .modal { max-height: 100vh; height: 100%; border-radius: 0; }
}
</style>
