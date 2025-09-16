<template>
  <div class="container">
    <div class="card shadow-sm auth-card">
      <div class="card-body p-4">
        <h1 class="h4 mb-3">Recuperar contraseña</h1>
        <form @submit.prevent="submit">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model.trim="email" type="email" class="form-control" required />
          </div>
          <button class="btn btn-primary w-100" :disabled="loading">
            {{ loading ? 'Enviando…' : 'Enviar enlace' }}
          </button>
          <div class="mt-3">
            <router-link :to="{ name: 'login' }">Volver al login</router-link>
          </div>
          <p v-if="error" class="text-danger mt-3 mb-0">{{ error }}</p>
          <p v-if="ok" class="text-success mt-3 mb-0">
            Si el email existe, recibirás instrucciones para restablecer tu contraseña.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const loading = ref(false)
const error = ref('')
const ok = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  ok.value = false
  try {
    await auth.recover(email.value)
    ok.value = true
  } catch (e) {
    error.value = e?.response?.data?.message || 'Error al solicitar recuperación'
  } finally {
    loading.value = false
  }
}
</script>
