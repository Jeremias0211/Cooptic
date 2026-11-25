<script setup>
// Envoltorio de un campo de formulario: etiqueta, ayuda y mensaje de error
defineProps({
  etiqueta: { type: String, required: true },
  error: { type: String, default: '' },
  ayuda: { type: String, default: '' },
  obligatorio: { type: Boolean, default: false },
  para: { type: String, default: '' }
})
</script>

<template>
  <div class="campo" :class="{ 'con-error': error }">
    <label :for="para" :class="{ obligatorio }">{{ etiqueta }}</label>
    <slot />
    <span v-if="ayuda && !error" class="ayuda">{{ ayuda }}</span>
    <span v-if="error" class="error" role="alert">{{ error }}</span>
  </div>
</template>
