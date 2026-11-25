import { createRouter, createWebHashHistory } from 'vue-router'
import { sesion, tiene } from '../store/sesion'
import { avisar } from '../store/ui'

// Cada ruta indica qué permiso necesita (ver services/permisos.js)
const routes = [
  { path: '/', redirect: '/panel' },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { publica: true } },
  { path: '/panel', name: 'panel', component: () => import('../views/PanelView.vue'), meta: { permiso: 'verPanel', titulo: 'Panel' } },
  { path: '/inventario', name: 'inventario', component: () => import('../views/InventarioView.vue'), meta: { permiso: 'verInventario', titulo: 'Inventario' } },
  { path: '/prestamos', name: 'prestamos', component: () => import('../views/PrestamosView.vue'), meta: { permiso: 'verPrestamos', titulo: 'Préstamos' } },
  { path: '/prestamos/nuevo', name: 'nuevo-prestamo', component: () => import('../views/NuevoPrestamoView.vue'), meta: { permiso: 'gestionarPrestamos', titulo: 'Nuevo préstamo' } },
  { path: '/prestamos/:id/devolucion', name: 'devolucion', component: () => import('../views/DevolucionView.vue'), meta: { permiso: 'gestionarPrestamos', titulo: 'Registrar devolución' } },
  { path: '/incidencias', name: 'incidencias', component: () => import('../views/IncidenciasView.vue'), meta: { permiso: 'verIncidencias', titulo: 'Incidencias' } },
  // Autorización digital del docente (reemplaza la notita en papel)
  { path: '/pedir', name: 'pedir', component: () => import('../views/PedirHerramientaView.vue'), meta: { permiso: 'pedirPrestamoAlumno', titulo: 'Pedir herramienta' } },
  { path: '/autorizar', name: 'autorizar', component: () => import('../views/AutorizarPedidosView.vue'), meta: { permiso: 'autorizarPedidos', titulo: 'Autorizar pedidos' } },
  { path: '/autorizaciones-clase', name: 'autorizaciones-clase', component: () => import('../views/AutorizacionesClaseView.vue'), meta: { permiso: 'autorizacionesClase', titulo: 'Autorizaciones de clase' } },
  { path: '/retirar', name: 'retirar', component: () => import('../views/ListasParaRetirarView.vue'), meta: { permiso: 'verListasParaRetirar', titulo: 'Listas para retirar' } },
  { path: '/solicitudes', name: 'solicitudes', component: () => import('../views/SolicitudesView.vue'), meta: { permiso: 'verSolicitudes', titulo: 'Solicitudes' } },
  { path: '/reposiciones', name: 'reposiciones', component: () => import('../views/ReposicionesView.vue'), meta: { permiso: 'verReposiciones', titulo: 'Reposición' } },
  { path: '/usuarios', name: 'usuarios', component: () => import('../views/UsuariosView.vue'), meta: { permiso: 'gestionarUsuarios', titulo: 'Usuarios' } },
  { path: '/configuracion', name: 'configuracion', component: () => import('../views/ConfiguracionView.vue'), meta: { permiso: 'configurar', titulo: 'Configuración' } },
  { path: '/reportes', name: 'reportes', component: () => import('../views/ReportesView.vue'), meta: { permiso: 'verReportes', titulo: 'Reportes' } },
  { path: '/indicadores', name: 'indicadores', component: () => import('../views/IndicadoresView.vue'), meta: { titulo: 'Indicadores' } },
  { path: '/tareas', name: 'tareas', component: () => import('../views/TareasView.vue'), meta: { permiso: 'verTareas', titulo: 'Tareas' } },
  { path: '/actas', name: 'actas', component: () => import('../views/ActasView.vue'), meta: { permiso: 'verActas', titulo: 'Actas' } },
  { path: '/acerca', name: 'acerca', component: () => import('../views/AcercaView.vue'), meta: { titulo: 'Acerca del sistema' } },
  { path: '/:pathMatch(.*)*', redirect: '/panel' }
]

const router = createRouter({
  // Hash (#/ruta) para que funcione en GitHub Pages o cualquier hosting estático
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.publica) {
    return sesion.usuario && to.name === 'login' ? '/panel' : true
  }
  if (!sesion.usuario) return { name: 'login', query: { volver: to.fullPath } }
  if (to.meta.permiso && !tiene(to.meta.permiso)) {
    avisar('Tu rol no tiene acceso a esa sección.', 'error')
    return '/panel'
  }
  return true
})

router.afterEach((to) => {
  document.title = (to.meta.titulo ? to.meta.titulo + ' · ' : '') + 'CoopTIC'
})

export default router
