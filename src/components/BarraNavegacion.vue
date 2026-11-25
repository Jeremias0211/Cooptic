<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sesion, salir, tiene } from '../store/sesion'
import { ROLES } from '../services/permisos'
import { confirmar } from '../store/ui'

const ruta = useRoute()
const router = useRouter()
const menuAbierto = ref(false)

// Solo aparecen las secciones a las que el rol tiene acceso
const enlaces = computed(() => [
  { a: '/panel', texto: 'Panel', ver: tiene('verPanel') },
  { a: '/inventario', texto: tiene('editarHerramientas') || tiene('ajustarStock') ? 'Inventario' : 'Catálogo', ver: tiene('verInventario') },
  { a: '/prestamos', texto: sesion.usuario?.rol === 'alumno' ? 'Mis préstamos' : 'Préstamos', ver: tiene('verPrestamos') },
  { a: '/pedir', texto: 'Pedir herramienta', ver: tiene('pedirPrestamoAlumno') },
  { a: '/autorizar', texto: 'Autorizar pedidos', ver: tiene('autorizarPedidos') },
  { a: '/autorizaciones-clase', texto: 'Autorizaciones de clase', ver: tiene('autorizacionesClase') },
  { a: '/retirar', texto: 'Listas para retirar', ver: tiene('verListasParaRetirar') },
  { a: '/solicitudes', texto: 'Solicitudes', ver: tiene('verSolicitudes') },
  { a: '/incidencias', texto: 'Incidencias', ver: tiene('verIncidencias') },
  { a: '/reposiciones', texto: 'Reposición', ver: tiene('verReposiciones') },
  { a: '/reportes', texto: 'Reportes', ver: tiene('verReportes') },
  { a: '/indicadores', texto: 'Indicadores', ver: true },
  { a: '/tareas', texto: 'Tareas', ver: tiene('verTareas') },
  { a: '/actas', texto: 'Actas', ver: tiene('verActas') },
  { a: '/usuarios', texto: 'Usuarios', ver: tiene('gestionarUsuarios') },
  { a: '/configuracion', texto: 'Configuración', ver: tiene('configurar') },
  { a: '/acerca', texto: 'Acerca', ver: true }
].filter((e) => e.ver))

watch(() => ruta.fullPath, () => (menuAbierto.value = false))

async function cerrar() {
  if (await confirmar({ titulo: 'Cerrar sesión', texto: '¿Querés salir del sistema?', textoBoton: 'Salir' })) {
    await salir()
    router.push('/login')
  }
}
</script>

<template>
  <header class="barra">
    <div class="barra-interior">
      <RouterLink to="/panel" class="marca">CoopTIC <span>Pañol</span></RouterLink>
      <button class="hamburguesa" :aria-expanded="menuAbierto" aria-controls="menu" @click="menuAbierto = !menuAbierto">
        {{ menuAbierto ? 'Cerrar' : 'Menú' }}
      </button>
      <nav id="menu" :class="{ abierto: menuAbierto }" aria-label="Secciones">
        <RouterLink v-for="e in enlaces" :key="e.a" :to="e.a">{{ e.texto }}</RouterLink>
      </nav>
      <div class="usuario" :class="{ abierto: menuAbierto }">
        <span>{{ sesion.usuario.nombre }} · <strong>{{ ROLES[sesion.usuario.rol] }}</strong></span>
        <button class="chico" @click="cerrar">Salir</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.barra { background: var(--primario-oscuro); color: #fff; }
.barra-interior { max-width: 1180px; margin: 0 auto; padding: 0.5rem 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
.marca { color: #fff; font-weight: 700; text-decoration: none; font-size: 1.1rem; }
.marca span { font-weight: 400; opacity: 0.8; }
nav { display: flex; flex-wrap: wrap; gap: 0.15rem; flex: 1; }
nav a { color: #dbe6f5; text-decoration: none; padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.95rem; }
nav a:hover { background: rgba(255, 255, 255, 0.1); }
nav a.router-link-active { background: #fff; color: var(--primario-oscuro); font-weight: 600; }
.usuario { display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; }
.usuario button { background: transparent; color: #fff; border-color: rgba(255, 255, 255, 0.5); }
.hamburguesa { display: none; margin-left: auto; background: transparent; color: #fff; border-color: rgba(255, 255, 255, 0.5); }

@media (max-width: 980px) {
  .hamburguesa { display: inline-flex; }
  nav, .usuario { display: none; width: 100%; }
  nav.abierto { display: flex; flex-direction: column; }
  nav a { padding: 0.65rem 0.6rem; font-size: 1rem; }
  .usuario.abierto { display: flex; justify-content: space-between; padding: 0.5rem 0; border-top: 1px solid rgba(255, 255, 255, 0.2); }
}
</style>
