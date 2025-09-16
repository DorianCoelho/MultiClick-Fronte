<script setup>
import { ref, onMounted } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import EnergyProductsModal from '@/components/EnergyProductsModal.vue'

const auth = useAuthStore()

// Chart (placeholder)
const loading = ref(false)
const apiData = ref(null)
const series = ref([{ name: 'Serie A', data: [10, 22, 13, 28, 19, 32, 25] }])
const chartOptions = ref({
  chart: { id: 'ventas', toolbar: { show: false } },
  xaxis: { categories: ['L','M','X','J','V','S','D'] },
  stroke: { curve: 'smooth' },
  dataLabels: { enabled: false },
  tooltip: { theme: 'light' }
})

// Modal de producto
const showProductModal = ref(false)
const product = ref(null)

async function loadData() {
  loading.value = true
  try {
    const { data } = await api.get('/dashboard/summary')
    apiData.value = data
  } catch (e) {
    apiData.value = { error: e?.response?.data || 'No se pudo cargar' }
  } finally {
    loading.value = false
  }
}

/** 1) Primero: GET /UserAcceptedProducts?userName=... 
 *  2) Si vacío => GET /GetEnergyProducts => mostrar modal
 */
async function maybeShowFirstLoginModal() {
  const isFirst = !!(auth.user?.isFirstLogin ?? auth.user?.IsFirstLogin)
  if (!isFirst) return

  const userName =
    auth.user?.userName ??
    auth.user?.UserName ??
    auth.user?.email ??
    auth.user?.name

  try {
    const { data: accepted } = await api.get('/UserAcceptedProducts', {
      params: { userName }
    })

    // Si ya hay registros aceptados, no mostramos modal
    if (Array.isArray(accepted) && accepted.length > 0) {
      // opcional: marcar que ya no es primer login
      auth.user.isFirstLogin = false
      localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))
      return
    }
  } catch (e) {
    // Si falla la consulta, puedes decidir no mostrar modal o sí mostrarlo.
    // Aquí lo mostramos para no bloquear al usuario.
    console.warn('No se pudo comprobar aceptaciones previas:', e)
  }

  // Aquí SÍ pedimos el producto (GetEnergyProducts) porque NO hay aceptados
  try {
    const { data } = await api.get('/GetEnergyProducts')
    product.value = data
    showProductModal.value = true
  } catch (e) {
    console.error('No se pudo cargar GetEnergyProducts:', e?.response?.data || e)
  }
}

async function acceptProduct() {
  try {
    const userName =
      auth.user?.userName ??
      auth.user?.UserName ??
      auth.user?.email ??
      auth.user?.name ?? ''

    const payload = {
      userName,
      productNo: product.value?.no || '',
      acceptanceDate: new Date().toISOString(),
      acceptanceIPAddress: '' // el backend la sobrescribe con la IP real
    }
    await api.post('/UserAcceptedProducts', payload)

    // Marca que ya no es primer login + persiste
    auth.user.isFirstLogin = false
    localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))

    showProductModal.value = false
  } catch (e) {
    console.error('No se pudo registrar la aceptación', e?.response?.data || e)
  }
}

onMounted(async () => {
  await loadData()
  await maybeShowFirstLoginModal()
})
</script>

<template>
  <DashboardLayout>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h1 class="h4 mb-0">Dashboard</h1>
      <button class="btn btn-outline-primary btn-sm" @click="loadData" :disabled="loading">
        {{ loading ? 'Actualizando…' : 'Recargar datos' }}
      </button>
    </div>

    <div class="card shadow-sm mb-3">
      <div class="card-body">
        <h2 class="h6">Ventas</h2>
        <apexchart type="line" height="320" :options="chartOptions" :series="series" />
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="card-body">
        <h2 class="h6">Datos API</h2>
        <pre class="small mb-0">{{ apiData }}</pre>
      </div>
    </div>

    <!-- Modal (solo se muestra si NO hay aceptaciones previas) -->
    <EnergyProductsModal
      :show="showProductModal"
      :product="product"
      @accepted="acceptProduct"
    />
  </DashboardLayout>
</template>
