<script setup>
import BarraNavegacion from './components/BarraNavegacion.vue'
import Avisos from './components/Avisos.vue'
import DialogoConfirmar from './components/DialogoConfirmar.vue'
import { sesion } from './store/sesion'
</script>

<template>
  <BarraNavegacion v-if="sesion.usuario" />
  <main class="contenedor">
    <RouterView />
  </main>
  <Avisos />
  <DialogoConfirmar />
</template>
