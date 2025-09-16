<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom">
    <div class="container">
      <a class="navbar-brand fw-bold" href="#">Vue JWT App</a>
      <div class="ms-auto d-flex align-items-center gap-3">
        <span v-if="auth.user">Hola, {{ auth.user?.name || 'Usuario' }}</span>
        <button v-if="auth.isAuthenticated" class="btn btn-outline-danger btn-sm" @click="onLogout">
          Salir
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

function onLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>
