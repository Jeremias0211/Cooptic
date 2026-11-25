<script setup>
import { ui, responderDialogo } from '../store/ui'
</script>

<template>
  <div v-if="ui.dialogo" class="fondo" @click.self="responderDialogo(false)" @keydown.esc="responderDialogo(false)">
    <div class="dialogo" role="dialog" aria-modal="true" :aria-label="ui.dialogo.titulo">
      <h2>{{ ui.dialogo.titulo }}</h2>
      <p v-if="ui.dialogo.texto">{{ ui.dialogo.texto }}</p>
      <div class="acciones">
        <button @click="responderDialogo(false)">Volver</button>
        <button :class="ui.dialogo.peligro ? 'peligro' : 'primario'" autofocus @click="responderDialogo(true)">
          {{ ui.dialogo.textoBoton }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fondo { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: grid; place-items: center; z-index: 60; padding: 1rem; }
.dialogo { background: #fff; border-radius: 10px; padding: 1.25rem; max-width: 440px; width: 100%; }
.acciones { justify-content: flex-end; margin-top: 1rem; }
</style>
