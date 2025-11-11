<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// El “userName” que pide el backend:
// usa la propiedad que tengas realmente (user.userName o user.name o user.email)
const userName = computed(() =>
  auth.user?.name || auth.user?.email || ''
)

console.log('userName para reset:', auth.user?.nameUser)

const customerNo = computed(() =>
  auth.user?.nameUser || ''
)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const loading = ref(false)
const errorMsg = ref('')
const okMsg = ref('')

function goToDashboard() {
  router.push({ name: 'dashboard' }) // o la ruta que corresponda
}

// Validación simple (puedes ajustar reglas)
function validate(): string | null {
  if (!userName.value) return 'No se pudo determinar el usuario en sesión.'
  if (!currentPassword.value) return 'La contraseña actual es obligatoria.'
  if (!newPassword.value) return 'La nueva contraseña es obligatoria.'
  if (newPassword.value.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.'
  // ejemplo de complejidad: 1 mayúscula, 1 minúscula, 1 dígito, 1 especial
  const upper = /[A-Z]/.test(newPassword.value)
  const lower = /[a-z]/.test(newPassword.value)
  const digit = /\d/.test(newPassword.value)
  const special = /[^A-Za-z0-9]/.test(newPassword.value)
  if (!(upper && lower && digit && special))
    return 'La nueva contraseña debe incluir mayúsculas, minúsculas, dígitos y un carácter especial.'
  if (newPassword.value !== confirmPassword.value) return 'La confirmación no coincide.'
  if (currentPassword.value === newPassword.value) return 'La nueva contraseña no puede ser igual a la actual.'
  return null
}

async function submit() {
  errorMsg.value = ''
  okMsg.value = ''
  const v = validate()
  if (v) { errorMsg.value = v; return }

  loading.value = true
  try {
    await api.post('/v1/Password/Reset', {
      userName: customerNo.value,
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })

    // Marca el “primer login” como completado
    if (auth.user) auth.user.isFirstLogin = false
    okMsg.value = 'Contraseña actualizada correctamente.'

    // Redirige a donde corresponda (p.ej., al gráfico)
    setTimeout(() => router.push({ name: 'dashboard' }), 1200)
  } catch (err: any) {
    // Mensaje del backend si lo manda
    errorMsg.value = err?.response?.data || 'No se pudo cambiar la contraseña.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <DashboardLayout>
    <div class="row justify-content-center">
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Restablecer contraseña</h5>
            <small class="text-muted">Debes cambiar la contraseña antes de continuar.</small>
          </div>
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label">Usuario</label><br />
              <code>{{ userName || '—' }}</code>
            </div>

            <div class="mb-3 small-input">
              <label class="form-label">Contraseña actual</label>
              <div class="input-group password-input">
                <input
                  :type="showCurrentPassword ? 'text' : 'password'"
                  class="form-control"
                  v-model="currentPassword"
                  autocomplete="current-password" />
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="showCurrentPassword = !showCurrentPassword"
                  :aria-label="showCurrentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <i :class="showCurrentPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>

            <div class="mb-3 small-input">
              <label class="form-label">Nueva contraseña</label>
              <div class="input-group password-input">
                <input
                  :type="showNewPassword ? 'text' : 'password'"
                  class="form-control"
                  v-model="newPassword"
                  autocomplete="new-password" />
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="showNewPassword = !showNewPassword"
                  :aria-label="showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <i :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
              <div class="form-text">
                Mín. 8 caracteres, con mayúsculas, minúsculas, dígitos y un carácter especial.
              </div>
            </div>

            <div class="mb-3 small-input">
              <label class="form-label">Confirmar nueva contraseña</label>
              <div class="input-group password-input">
                <input
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="form-control"
                  v-model="confirmPassword"
                  autocomplete="new-password" />
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="showConfirmPassword = !showConfirmPassword"
                  :aria-label="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                  <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>

            <div v-if="errorMsg" class="alert alert-danger py-2">{{ errorMsg }}</div>
            <div v-if="okMsg" class="alert alert-success py-2">{{ okMsg }}</div>
          </div>
          <div class="card-footer d-flex justify-content-end gap-2">
            <button class="btn btn-outline-secondary" :disabled="loading" @click="goToDashboard">Cancelar</button>
            <button class="btn btn-primary" :disabled="loading" @click="submit">
              {{ loading ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.small-input {
  max-width: 320px;
}

.password-input .btn {
  min-width: 2.25rem;
}

.password-input .btn i {
  pointer-events: none;
}
</style>
