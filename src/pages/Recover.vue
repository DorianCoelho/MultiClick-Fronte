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
          <p v-if="okMessage" class="text-success mt-3 mb-0">
            {{ okMessage }}
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
const okMessage = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  okMessage.value = ''
  try {
    const data = await auth.recover(email.value)
    okMessage.value =
      data?.message || 'Se ha enviado un email con las instrucciones.'
  } catch (e) {
    error.value =
      e?.response?.data?.message || 'Error al solicitar recuperación'
  } finally {
    loading.value = false
  }
}
</script>
