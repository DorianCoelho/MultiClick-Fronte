<template>
  <DashboardLayout>
    <div class="dash">
      <!-- Encabezado -->
      <header class="dash-head">
        <div>
          <h1 class="title">Mi panel</h1>
          <p class="muted">Bienvenido a tu panel de control.</p>
        </div>
      </header>
    </div>
    
    <EnergyProductsModal
      :show="showProductModal"
      :product="energyProduct"
      @accepted="acceptEnergyProduct"
      @close="showProductModal = false"
    />

    <!-- TOAST -->
    <teleport to="body">
      <transition name="toast-fade">
        <div v-if="toast.show" class="app-toast" role="status" aria-live="polite">
          <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor"
              d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
          </svg>
          <span>{{ toast.text }}</span>
          <button class="app-toast__close" @click="toast.show = false" aria-label="Cerrar">×</button>
        </div>
      </transition>
    </teleport>
  </DashboardLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import EnergyProductsModal from '@/components/EnergyProductsModal.vue'

/* ===================== Auth ===================== */
const auth = useAuthStore()
const router = useRouter()

/* ====== Estado para el modal de producto ====== */
const showProductModal = ref(false)
const energyProduct = ref(null)

/* Helper para sacar el "userName" desde tu store */
function getUserName () {
  return (
    auth.user?.userName ??
    auth.user?.UserName ??
    auth.user?.email ??
    auth.user?.name ??
    ''
  )
}

/* ===================== Toast ===================== */
const toast = reactive({ show: false, text: '', type: 'success' })
let toastTimer

function showToast (text, type = 'success', ms = 2400) {
  clearTimeout(toastTimer)
  toast.text = text
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(() => { toast.show = false }, ms)
}

/* ===================== Loaders ===================== */
async function getPublicIP() {
  const { ip } = await fetch('https://api.ipify.org?format=json').then(r => r.json());
  return ip;
}

async function maybeShowFirstLoginModal () {
  try {
    const { data: accepted } = await api.get('/UserAcceptedProducts', {
      params: { userName: getUserName() }
    })
    
    //if (Array.isArray(accepted) && accepted.length > 0) {
      // Ya estaba aceptado: marcamos que no es primer login y redirigir a grafico
      auth.user.isFirstLogin = false
      localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))
      router.push('/grafico')
      return
    //}
  } catch (e) {
    // Si falla, redirigir a grafico para no bloquear al usuario
    console.warn('No se pudo comprobar aceptaciones previas:', e)
    router.push('/grafico')
    return
  }

  // Cargamos el producto a aceptar
  try {
    const { data } = await api.get('/GetEnergyProducts')
    energyProduct.value = data
    showProductModal.value = true
  } catch (e) {
    console.error('No se pudo cargar GetEnergyProducts:', e?.response?.data || e)
    // Si falla la carga del producto, redirigir a grafico
    router.push('/grafico')
  }
}

/* Detectar tipo de dispositivo */
function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  // Detectar iOS
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
    return /iPad/.test(ua) ? 'Tablet iOS' : 'Mobile iOS'
  }
  
  // Detectar Android
  if (/android/i.test(ua)) {
    return /mobile/i.test(ua) ? 'Mobile Android' : 'Tablet Android'
  }
  
  // Detectar tablet genérica
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet'
  }
  
  // Detectar móvil genérico
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'Mobile'
  }
  
  // Por defecto, PC
  return 'PC'
}

/* POST de aceptación */
async function acceptEnergyProduct () {
  const ip = await getPublicIP();
  try {
    const payload = {
      userName: getUserName(),
      productNo: energyProduct.value?.no || energyProduct.value?.No || '',
      acceptanceDate: new Date().toISOString(),
      acceptanceIPAddress: ip,
      device: getDeviceType()
    }
    await api.post('/UserAcceptedProducts', payload)

    // Marcar que ya no es primer login y persistir
    auth.user.isFirstLogin = false
    localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))

    showProductModal.value = false
    showToast('Producto aceptado correctamente. ¡Gracias!', 'success')
    
    // Redirigir a grafico después de aceptar
    setTimeout(() => {
      router.push('/grafico')
    }, 1000) // Esperar 1 segundo para que el usuario vea el mensaje
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo registrar la aceptación', 'error')
  }
}

/* ===================== Init ===================== */
onMounted(async () => {
  await maybeShowFirstLoginModal()
})
</script>

<style scoped>
.dash{display:grid;gap:1rem;padding:1rem}
.dash-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.title{margin:0;font-size:1.3rem}
.muted{color:#6b7280}
</style>

<style>
/* Toast - sin scoped para que funcione en Teleport */
.app-toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  max-width: min(92vw, 420px);
  padding: .55rem .75rem;
  border-radius: .75rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
}

.app-toast svg {
  flex: 0 0 18px;
}

.app-toast__close {
  margin-left: .25rem;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  color: inherit;
  opacity: .7;
}

.app-toast__close:hover {
  opacity: 1;
}

/* variantes */
.app-toast--success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.app-toast--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

/* transición */
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all .2s ease;
}
</style>