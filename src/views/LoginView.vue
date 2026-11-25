<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Campo from '../components/Campo.vue'
import { ingresar } from '../store/sesion'
import { api, MODO_DEMO } from '../services/api'
import { ROLES } from '../services/permisos'
import * as v from '../utils/validar'

const router = useRouter()
const ruta = useRoute()
const form = reactive({ usuario: '', contrasena: '' })
const errores = ref({})
const errorGeneral = ref('')
const enviando = ref(false)
const usuariosPrueba = ref([])

onMounted(async () => {
  if (MODO_DEMO) usuariosPrueba.value = await api.usuariosDePrueba()
})

function validar() {
  const u = form.usuario.trim()
  errores.value = v.juntarErrores({
    usuario: [v.obligatorio(u, 'El usuario'), u.includes('@') ? '' : v.dni(u)],
    contrasena: MODO_DEMO ? [] : [v.obligatorio(form.contrasena, 'La contraseña'), v.largo(form.contrasena, { min: 6, nombre: 'La contraseña' })]
  })
  return Object.keys(errores.value).length === 0
}

async function enviar() {
  errorGeneral.value = ''
  if (!validar()) return
  enviando.value = true
  try {
    await ingresar(form.usuario, form.contrasena)
    router.push(ruta.query.volver || '/panel')
  } catch (e) {
    errorGeneral.value = e.message
  } finally {
    enviando.value = false
  }
}

function entrarComo(u) {
  form.usuario = u.dni
  enviar()
}
</script>

<template>
  <div class="login">
    <section class="tarjeta">
      <div class="logo">
        <strong>CoopTIC</strong>
        <span>Pañol de los talleres</span>
      </div>
      <h1>Iniciar sesión</h1>

      <div v-if="errorGeneral" class="aviso error" role="alert">{{ errorGeneral }}</div>

      <form class="formulario" novalidate @submit.prevent="enviar">
        <Campo etiqueta="Usuario o DNI" para="usuario" :error="errores.usuario" obligatorio ayuda="DNI sin puntos (o correo electrónico)">
          <input id="usuario" v-model="form.usuario" autocomplete="username" inputmode="numeric" placeholder="Ej.: 25333444" />
        </Campo>
        <Campo v-if="!MODO_DEMO" etiqueta="Contraseña" para="contrasena" :error="errores.contrasena" obligatorio>
          <input id="contrasena" v-model="form.contrasena" type="password" autocomplete="current-password" />
        </Campo>
        <p v-else class="suave">En modo demo no se pide contraseña: el rol está simulado.</p>
        <button class="primario" type="submit" :disabled="enviando">{{ enviando ? 'Ingresando…' : 'Ingresar' }}</button>
      </form>
    </section>

    <section v-if="MODO_DEMO" class="tarjeta">
      <h2>Usuarios de prueba (roles simulados)</h2>
      <p class="suave">Tocá uno para entrar con ese rol. Son personas ficticias.</p>
      <div class="lista-prueba">
        <button v-for="u in usuariosPrueba" :key="u.id" type="button" :disabled="enviando" @click="entrarComo(u)">
          <span><strong>{{ ROLES[u.rol] }}</strong> · {{ u.nombre }}</span>
          <span class="suave">DNI {{ u.dni }}{{ u.curso ? ' · ' + u.curso : '' }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login { max-width: 460px; margin: 1.5rem auto; }
.logo { display: flex; flex-direction: column; align-items: center; padding: 0.75rem; margin-bottom: 1rem; background: var(--primario-claro); border-radius: var(--radio); }
.logo strong { font-size: 1.4rem; color: var(--primario-oscuro); }
.lista-prueba { display: grid; gap: 0.5rem; }
.lista-prueba button { flex-direction: column; align-items: flex-start; text-align: left; gap: 0; }
</style>
