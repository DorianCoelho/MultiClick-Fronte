<template>
  <div class="container">
    <div class="card shadow-sm auth-card">
      <div class="card-body p-4">
        <img :src="logo" alt="Logo" style="height: 80px" class="mb-3" />
        <h1 class="h4 mb-3">Iniciar sesión</h1>
        <form @submit.prevent="submit">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <input v-model.trim="form.email" type="text" class="form-control" required />
          </div>
          <div class="mb-3">
            <label class="form-label">Contraseña</label>
            <input v-model="form.password" type="password" class="form-control" required />
          </div>

          <button class="btn btn-primary w-100" :disabled="loading">
            {{ loading ? 'Entrando…' : 'Entrar' }}
          </button>

          <div class="d-flex justify-content-between mt-3">
            <!--<router-link :to="{ name: 'register' }">Crear cuenta</router-link>-->
            <router-link :to="{ name: 'recover' }">¿Olvidaste la contraseña?</router-link>
          </div>

          <p v-if="error" class="text-danger mt-3 mb-0">{{ error }}</p>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import config from '@/config/env'

// Importar logo dinámicamente
const logo = new URL(config.LOGO_PATH, import.meta.url).href
import { useRoute, useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ 
  email: '', 
  password: '', 
  marketerNo: config.MARKETER 
})

const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form)
    console.log("auth.isFirstLogin", auth.isFirstLogin);
    // Verificar si es el primer login y redireccionar apropiadamente
    if (auth.isFirstLogin) {
      await router.push({ name: 'ResetPassword' })
    } else {
      await router.push({ name: 'dashboard' })
    }
  } catch (e) {
    error.value = e?.response?.data?.message || 'Credenciales inválidas'
  } finally {
    loading.value = false
  }
}
</script>
