<template>
  <div class="container">
    <div class="card shadow-sm auth-card">
      <div class="card-body p-4">
        <h1 class="h4 mb-3">Crear cuenta</h1>
        <form @submit.prevent="submit">
          <div class="mb-3">
            <label class="form-label">Nombre</label>
            <input v-model.trim="form.name" class="form-control" required />
          </div>
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model.trim="form.email" type="email" class="form-control" required />
          </div>
          <div class="mb-3">
            <label class="form-label">Contraseña</label>
            <input v-model="form.password" type="password" class="form-control" required minlength="6" />
          </div>
          <button class="btn btn-primary w-100" :disabled="loading">
            {{ loading ? 'Creando…' : 'Registrarme' }}
          </button>
          <div class="mt-3">
            <router-link :to="{ name: 'login' }">¿Ya tienes cuenta? Inicia sesión</router-link>
          </div>
          <p v-if="error" class="text-danger mt-3 mb-0">{{ error }}</p>
          <p v-if="ok" class="text-success mt-3 mb-0">
            Registro correcto. Ahora puedes iniciar sesión.
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const form = reactive({ name: '', email: '', password: '' })
const loading = ref(false)
const error = ref('')
const ok = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  ok.value = false
  try {
    await auth.register(form)
    ok.value = true
    setTimeout(() => router.push({ name: 'login' }), 1200)
  } catch (e) {
    error.value = e?.response?.data?.message || 'No se pudo registrar'
  } finally {
    loading.value = false
  }
}
</script>
