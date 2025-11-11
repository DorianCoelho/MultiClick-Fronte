<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const STORAGE_KEY = 'change-password-token-data'
const TEN_MINUTES_MS = 10 * 60 * 1000

interface TokenSessionData {
  email: string
  id: string
  apipass: string
  enabledUntil: string
}

const router = useRouter()

const loading = ref(false)
const errorMsg = ref('')
const okMsg = ref('')
const tokenData = ref<TokenSessionData | null>(null)

const newPassword = ref('')
const confirmPassword = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const userIdentifier = computed(() => tokenData.value?.id || tokenData.value?.email || '')
const currentPassword = computed(() => tokenData.value?.apipass || '')
const passwordsMatch = computed(() => {
  if (!confirmPassword.value) return true
  return newPassword.value === confirmPassword.value
})

function invalidateLink(message = 'El enlace no es válido o ha caducado.') {
  sessionStorage.removeItem(STORAGE_KEY)
  tokenData.value = null
  errorMsg.value = message
}

function loadTokenData() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      invalidateLink()
      return
    }

    const parsed = JSON.parse(raw) as TokenSessionData

    if (!parsed?.apipass || !parsed?.enabledUntil) {
      invalidateLink()
      return
    }

    const enabledUntil = new Date(parsed.enabledUntil)
    if (Number.isNaN(enabledUntil.getTime())) {
      invalidateLink()
      return
    }

    const now = Date.now()
    if (now > enabledUntil.getTime() + TEN_MINUTES_MS) {
      invalidateLink()
      return
    }

    tokenData.value = parsed
    errorMsg.value = ''
  } catch (err) {
    console.error('[ChangePasswordForm] error parsing token data', err)
    invalidateLink()
  }
}

function validate(): string | null {
  if (!tokenData.value) return 'El enlace no es válido o ha caducado.'
  if (!userIdentifier.value) return 'No se pudo identificar al usuario.'
  if (!currentPassword.value) return 'La contraseña temporal ha expirado.'
  if (!newPassword.value) return 'La nueva contraseña es obligatoria.'
  if (newPassword.value.length < 8) return 'La nueva contraseña debe tener al menos 8 caracteres.'

  const upper = /[A-Z]/.test(newPassword.value)
  const lower = /[a-z]/.test(newPassword.value)
  const digit = /\d/.test(newPassword.value)
  const special = /[^A-Za-z0-9]/.test(newPassword.value)
  if (!(upper && lower && digit && special)) {
    return 'La nueva contraseña debe incluir mayúsculas, minúsculas, dígitos y un carácter especial.'
  }
  if (newPassword.value !== confirmPassword.value) return 'Las contraseñas no coinciden.'
  return null
}

async function submit() {
  errorMsg.value = ''
  okMsg.value = ''

  const validationError = validate()
  if (validationError) {
    errorMsg.value = validationError
    return
  }

  if (!tokenData.value) {
    errorMsg.value = 'El enlace no es válido o ha caducado.'
    return
  }

  loading.value = true

  try {
    const { data } = await api.post('/v1/Password/ResetChange', {
      userName: userIdentifier.value,
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value
    })

    const backendMessage = data?.message || 'Contraseña actualizada correctamente.'
    const negativeFlag =
      data?.success === false ||
      data?.isSuccess === false ||
      data?.ok === false ||
      data?.changed === false ||
      data?.passwordChanged === false

    if (negativeFlag) {
      errorMsg.value = backendMessage || 'No se pudo cambiar la contraseña.'
      return
    }

    okMsg.value = backendMessage
    sessionStorage.removeItem(STORAGE_KEY)
    setTimeout(() => {
      router.push({ name: 'login' })
    }, 1500)
  } catch (err: any) {
    console.error('[ChangePasswordForm] error updating password', err)
    const backendMessage = err?.response?.data
    errorMsg.value = backendMessage || 'No se pudo cambiar la contraseña.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTokenData()
})
</script>

<template>
  <div class="change-password-wrapper">
    <div class="card shadow-sm">
      <div class="card-header">
        <h5 class="mb-0">Restablecer contraseña</h5>
        <small class="text-muted">
          Define una nueva contraseña para tu cuenta.
        </small>
      </div>

      <div class="card-body">
        <template v-if="tokenData && !errorMsg">
          <div class="mb-3">
            <label class="form-label">Usuario</label>
            <div>
              <code>{{ userIdentifier }}</code>
            </div>
          </div>

          <input type="hidden" :value="currentPassword" />

          <div class="mb-3">
            <label class="form-label">Nueva contraseña</label>
            <div class="input-group password-input">
              <input
                v-model="newPassword"
                :type="showNewPassword ? 'text' : 'password'"
                class="form-control"
                autocomplete="new-password"
                :disabled="loading"
              />
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="loading"
                @click="showNewPassword = !showNewPassword"
                :aria-label="showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <i :class="showNewPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <div class="form-text">
              Mín. 8 caracteres, con mayúsculas, minúsculas, dígitos y un carácter especial.
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Confirmar nueva contraseña</label>
            <div class="input-group password-input">
              <input
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="form-control"
                autocomplete="new-password"
                :disabled="loading"
              />
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                :disabled="loading"
                @click="showConfirmPassword = !showConfirmPassword"
                :aria-label="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <div v-if="confirmPassword && !passwordsMatch" class="form-text text-danger">
              Las contraseñas no coinciden.
            </div>
          </div>

          <div v-if="errorMsg" class="alert alert-danger py-2">
            {{ errorMsg }}
          </div>
          <div v-if="okMsg" class="alert alert-success py-2">
            {{ okMsg }}
          </div>
        </template>

        <template v-else>
          <div class="alert alert-danger mb-0">
            {{ errorMsg || 'El enlace no es válido o ha caducado.' }}
          </div>
        </template>
      </div>

      <div class="card-footer d-flex justify-content-end gap-2">
        <button
          class="btn btn-outline-secondary"
          :disabled="loading"
          @click="router.push({ name: 'login' })"
        >
          Volver a iniciar sesión
        </button>
        <button
          v-if="tokenData && !errorMsg"
          class="btn btn-primary"
          :disabled="loading"
          @click="submit"
        >
          {{ loading ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.change-password-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background-color: #f5f7fa;
}

.card {
  max-width: 420px;
  width: 100%;
}

.password-input .btn {
  min-width: 2.25rem;
}

.password-input .btn i {
  pointer-events: none;
}
</style>

