import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { iniciarSesionGuardada } from './store/sesion'
import './style.css'

// Antes de montar, recupera la sesión (si había una abierta)
iniciarSesionGuardada().finally(() => {
  createApp(App).use(router).mount('#app')
})
