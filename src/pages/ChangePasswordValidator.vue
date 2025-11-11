<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import config from '@/config/env'

const JWT_SECRET = 'a2d7189b38b924d7af81e70f18259f3363df5bac2ffb2a03cc3a0dbb4638759a'
const JWT_ISSUER = 'e_pro_client_inssuer'
const JWT_AUDIENCE = 'e_pro_client_audience'
const API_KEY = config.API_KEY

const TEN_MINUTES_MS = 10 * 60 * 1000
const STORAGE_KEY = 'change-password-token-data'

console.log('[ChangePasswordValidator] API key configurada:', API_KEY)

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')
const tokenPayload = ref<Record<string, unknown> | null>(null)
const tokenHeader = ref<Record<string, unknown> | null>(null)

const encoder = new TextEncoder()
const secretKeyBytes = encoder.encode(JWT_SECRET)
let cryptoKey: CryptoKey | null = null

function base64UrlToBase64(segment: string) {
  return segment.replace(/-/g, '+').replace(/_/g, '/')
}

function normalizeBase64(segment: string) {
  return segment.replace(/=+$/g, '')
}

function decodeSegment(segment: string) {
  try {
    const base64 = base64UrlToBase64(segment)
    const padded = base64 + '==='.slice((base64.length + 3) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch (err) {
    console.warn('[ChangePasswordValidator] No se pudo decodificar segmento JWT:', err)
    return null
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function ensureCryptoKey() {
  if (!cryptoKey) {
    if (!window.crypto?.subtle) {
      throw new Error('Web Crypto API no está disponible en este navegador.')
    }
    cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      secretKeyBytes,
      {
        name: 'HMAC',
        hash: { name: 'SHA-256' }
      },
      false,
      ['sign']
    )
  }
  return cryptoKey
}

async function verifySignature(header: string, payload: string, signature: string) {
  const key = await ensureCryptoKey()
  const data = `${header}.${payload}`
  const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const computedBase64 = arrayBufferToBase64(signatureBuffer)
  const providedBase64 = base64UrlToBase64(signature)
  const equal = normalizeBase64(computedBase64) === normalizeBase64(providedBase64)
  if (!equal) {
    throw new Error('La firma no coincide con el contenido del token.')
  }
}

function persistTokenData(payload: Record<string, unknown>, enabledUntilISO: string) {
  const data = {
    email: payload.email ?? '',
    id: payload.id ?? '',
    apipass: payload.apipass ?? '',
    enabledUntil: enabledUntilISO
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearStoredTokenData() {
  sessionStorage.removeItem(STORAGE_KEY)
}

async function verifyToken(rawToken: string) {
  if (!rawToken) {
    loading.value = false
    errorMsg.value = 'Enlace no válido.'
    return
  }

  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  tokenPayload.value = null
  tokenHeader.value = null

  try {
    const cleanedToken = decodeURIComponent(rawToken.trim())
    const originalParts = cleanedToken.split('.')
    if (originalParts.length !== 3) {
      throw new Error('El token no tiene el formato esperado (tres segmentos).')
    }

    const [headerSegment, payloadSegment, signatureSegment] = originalParts

    tokenHeader.value = decodeSegment(headerSegment)
    tokenPayload.value = decodeSegment(payloadSegment)

    if (tokenHeader.value?.alg !== 'HS256') {
      throw new Error(`Algoritmo no soportado: ${String(tokenHeader.value?.alg)}`)
    }

    const payload = tokenPayload.value
    if (!payload) {
      throw new Error('Payload vacío.')
    }

    if (payload.iss !== JWT_ISSUER) {
      throw new Error('Issuer inválido en el token.')
    }
    if (payload.aud !== JWT_AUDIENCE) {
      throw new Error('Audience inválido en el token.')
    }

    if (payload.apikey !== API_KEY) {
      throw new Error('API key inválida.')
    }

    if (!payload.apipass) {
      throw new Error('El token no contiene la contraseña temporal.')
    }

    if (!payload.enableduntil) {
      throw new Error('El token no contiene la fecha de expiración.')
    }

    const enabledUntil = new Date(String(payload.enableduntil))
    if (Number.isNaN(enabledUntil.getTime())) {
      throw new Error('Fecha de expiración inválida en el token.')
    }

    const now = Date.now()
    if (now > enabledUntil.getTime() + TEN_MINUTES_MS) {
      throw new Error('El enlace ha caducado.')
    }

    await verifySignature(headerSegment, payloadSegment, signatureSegment)

    console.log('[ChangePasswordValidator] Token verificado correctamente')
    console.log('[ChangePasswordValidator] Payload del token:', tokenPayload.value)

    persistTokenData(payload, enabledUntil.toISOString())
    successMsg.value = 'Enlace validado. Redirigiendo…'
    setTimeout(() => {
      router.replace({ name: 'change-password-form' })
    }, 1200)
  } catch (err) {
    console.error('[ChangePasswordValidator] Error verificando token:', err)
    clearStoredTokenData()
    errorMsg.value = 'El enlace no es válido o ha caducado.'
  } finally {
    loading.value = false
  }
}

function extractToken(): string {
  const param = route.params.token
  if (typeof param === 'string') return param
  if (Array.isArray(param)) return param[0] || ''
  return ''
}

onMounted(() => {
  verifyToken(extractToken())
})

watch(
  () => route.params.token,
  (newToken) => {
    if (typeof newToken === 'string') {
      verifyToken(newToken)
    } else if (Array.isArray(newToken) && newToken[0]) {
      verifyToken(newToken[0])
    }
  }
)
</script>

<template>
  <div class="validator-container">
    <div class="card shadow-sm">
      <div class="card-body">
        <h5 class="card-title mb-3">Validación de Token</h5>

        <p v-if="loading" class="text-muted mb-0">
          Verificando token, por favor espera…
        </p>

        <div v-else-if="errorMsg" class="alert alert-danger mb-0">
          {{ errorMsg }}
        </div>

        <div v-else-if="successMsg">
          <div class="alert alert-success mb-0">
            {{ successMsg }}
          </div>
        </div>

        <div v-else class="text-muted">
          Procesando enlace…
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.validator-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background-color: #f5f7fa;
}

.payload-preview {
  background-color: #0f172a;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  margin: 0;
  max-height: 240px;
  overflow: auto;
  font-size: 0.85rem;
}
</style>

