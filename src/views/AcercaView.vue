<script setup>
import { api, MODO_DEMO } from '../services/api'
import { ROLES } from '../services/permisos'
import { confirmar, ejecutar } from '../store/ui'
import { salir } from '../store/sesion'
import { useRouter } from 'vue-router'

const router = useRouter()

async function reiniciar() {
  if (await confirmar({ titulo: 'Restaurar datos de prueba', texto: 'Se borran los cambios hechos en este navegador y se vuelven a cargar los datos ficticios.', textoBoton: 'Restaurar', peligro: true })) {
    if (await ejecutar(() => api.reiniciarDatosDePrueba(), 'Datos de prueba restaurados.')) {
      await salir()
      router.push('/login')
    }
  }
}
</script>

<template>
  <div>
    <h1>Acerca del sistema</h1>

    <section class="tarjeta">
      <h2>CoopTIC · Gestión del pañol</h2>
      <p>
        Sistema de la cooperativa escolar para registrar herramientas y materiales de los talleres, controlar préstamos y devoluciones,
        dejar constancia de roturas y pérdidas, y pedir reposiciones. Responde a la necesidad detectada: no se sabía quién tenía cada
        elemento, cuándo debía devolverlo ni en qué estado estaba.
      </p>
      <p><strong>Modo actual:</strong> {{ MODO_DEMO ? 'DEMO (datos de prueba en el navegador)' : 'Conectado a Supabase (base de datos compartida)' }}</p>
    </section>

    <section class="tarjeta">
      <h2>Roles</h2>
      <ul>
        <li><strong>{{ ROLES.admin }}:</strong> usuarios y roles, alta/modificación/baja de herramientas, talleres, categorías y plazos, reportes, aprobar reposiciones, resolver incidencias.</li>
        <li><strong>{{ ROLES.panolero }}:</strong> registra préstamos y devoluciones con el estado del elemento, actualiza stock, registra roturas y pérdidas.</li>
        <li><strong>{{ ROLES.docente }}:</strong> consulta disponibilidad, solicita herramientas para su clase, ve los préstamos de sus cursos y pide reposición.</li>
        <li><strong>{{ ROLES.alumno }}:</strong> consulta el catálogo y ve sus propios préstamos, fechas de devolución e historial.</li>
      </ul>
      <p v-if="MODO_DEMO" class="aviso alerta">
        En esta versión los <strong>cuatro roles están simulados</strong>: se elige un usuario de prueba sin contraseña.
        Los permisos se controlan en el código de la demo. Con Supabase, cada persona entra con su cuenta y los permisos se aplican en la base de datos (RLS).
      </p>
    </section>

    <section class="tarjeta">
      <h2>Datos y persistencia</h2>
      <ul>
        <li><strong>Se conserva y se comparte entre usuarios y dispositivos:</strong> inventario, préstamos, devoluciones, incidencias, solicitudes, reposiciones, usuarios, tareas y actas. Por eso se usa una base de datos (Supabase).</li>
        <li><strong>Solo en el dispositivo:</strong> la sesión iniciada (token) y, en modo demo, los datos de prueba.</li>
        <li><strong>Historial:</strong> los préstamos nunca se borran; se devuelven o se cancelan. Herramientas, usuarios, talleres y categorías se dan de baja o se desactivan.</li>
      </ul>
      <template v-if="MODO_DEMO">
        <p>Limitaciones del modo demo: los datos quedan solo en este navegador, no los ven otras personas, se pierden si se borra el navegador y los roles no tienen contraseña.</p>
        <button class="peligro" @click="reiniciar">Restaurar datos de prueba</button>
      </template>
    </section>
  </div>
</template>
