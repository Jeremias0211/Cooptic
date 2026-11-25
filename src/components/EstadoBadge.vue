<script setup>
// Muestra un estado con color + texto (el color nunca va solo)
import { computed } from 'vue'

const props = defineProps({ estado: String })

const mapa = {
  activo: ['azul', 'Activo'],
  vencido: ['rojo', 'Vencido'],
  devuelto: ['verde', 'Devuelto'],
  cancelado: ['gris', 'Cancelado'],
  bueno: ['verde', 'Bueno'],
  regular: ['amarillo', 'Regular'],
  danado: ['rojo', 'Dañado'],
  perdido: ['rojo', 'Perdido'],
  en_reparacion: ['amarillo', 'En reparación'],
  fuera_de_servicio: ['rojo', 'Fuera de servicio'],
  pendiente: ['amarillo', 'Pendiente'],
  atendida: ['verde', 'Atendida'],
  rechazada: ['rojo', 'Rechazada'],
  cancelada: ['gris', 'Cancelada'],
  esperando_autorizacion: ['amarillo', 'Esperando autorización'],
  autorizada: ['azul', 'Autorizada'],
  retirada: ['verde', 'Retirada'],
  vencida: ['rojo', 'Vencida'],
  activa: ['verde', 'Activa'],
  aprobada: ['azul', 'Aprobada'],
  recibida: ['verde', 'Recibida'],
  abierta: ['rojo', 'Abierta'],
  resuelta: ['verde', 'Resuelta'],
  completada: ['verde', 'Completada'],
  atrasada: ['rojo', 'Atrasada'],
  stock_bajo: ['amarillo', 'Stock bajo'],
  sin_stock: ['rojo', 'Sin stock'],
  disponible: ['verde', 'Disponible'],
  baja: ['gris', 'Dada de baja'],
  inactivo: ['gris', 'Inactivo']
}

const datos = computed(() => mapa[props.estado] || ['gris', props.estado])
</script>

<template>
  <span class="badge" :class="datos[0]">{{ datos[1] }}</span>
</template>
