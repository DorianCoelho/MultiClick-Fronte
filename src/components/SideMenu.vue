<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import config from '@/config/env'

// Importar logo dinámicamente
const logo = new URL(config.LOGO_PATH, import.meta.url).href

const router = useRouter()
const auth = useAuthStore()                     // 👈 instancia del store

const items = [
  { name: 'Inicio', route: '/dashboard', icon: 'bi-house' },
  //{ name: 'Usuario', route: '/users', icon: 'bi-people' },
  { name: 'Grafico', route: '/grafico', icon: 'bi-bar-chart' },
  { name: 'Propuestas', route: '/proposals', icon: 'bi-list' },
  { name: 'Contratos', route: '/contracts', icon: 'bi-file-earmark-text' },
  { name: 'MultiClick', route: '/suggestions', icon: 'bi-lightbulb' },
  { name: 'Cups', route: '/cups', icon: 'bi-plug' }
]

const go = (r) => router.push(r)

const goResetPassword = () => {
  router.push({ name: 'ResetPassword' }) // 👈 asegúrate de que esta ruta existe en tu router
}

const logout = async () => {
  auth.logout()                                 // 👈 usa la instancia
  await router.replace({ name: 'login' })       // o { name:'login', query:{loggedOut:1} } si mantienes meta.guest
}
</script>

<template>
  <aside class="bg-white border-end shadow-sm d-flex flex-column" style="width: 240px; min-height: 100vh;">
    <div class="text-center p-3 border-bottom">
      <img :src="logo" alt="Logo" style="max-height: 50px;" />
    </div>

    <ul class="nav flex-column mt-3">
      <li v-for="item in items" :key="item.route" class="nav-item">
        <a href="#" class="nav-link d-flex align-items-center px-3 py-2 text-dark" @click.prevent="go(item.route)">
          <i :class="['bi me-2', item.icon]"></i> {{ item.name }}
        </a>
      </li>
    </ul>

    <div class="mt-auto p-3 border-top d-grid gap-2">
      <button class="btn btn-outline-secondary w-100" @click="goResetPassword">
        <i class="bi bi-key me-2"></i> Reset Password
      </button>

      <button class="btn btn-outline-danger w-100" @click="logout">
        <i class="bi bi-box-arrow-right me-2"></i> Logout
      </button>
    </div>
  </aside>
</template>
