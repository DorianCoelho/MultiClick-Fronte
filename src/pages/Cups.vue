<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// customerNo = auth.user?.nameUser (con fallback por si el back usa otro nombre)
const customerNo = computed(() =>
  auth.user?.customerNo ?? auth.user?.userName ?? auth.user?.id ?? ''
)

const loading = ref(false)
const error = ref('')
const cups = ref([]) // array de strings o { cups: string }

// Cargar CUPS del cliente
async function loadCups () {
  error.value = ''
  cups.value = []
  if (!customerNo.value) {
    error.value = 'No hay CustomerId en sesión.'
    return
  }
  loading.value = true
  try {
    const { data } = await api.get('/v1/CustomerCups/ByCustomer', {
      params: { customerNo: customerNo.value }
    })
    // admite { cups: 'ESxxxx' } o strings
    cups.value = Array.isArray(data)
      ? data.map(x => (typeof x === 'string' ? x : (x.cups ?? x.Cups)))
            .filter(Boolean)
      : []
  } catch (e) {
    error.value = e?.response?.data?.message || 'No se pudieron cargar los CUPS.'
  } finally {
    loading.value = false
  }
}

// Navegar al gráfico con el cups preseleccionado
function crearSugerencia(cupsNo) {
  router.push({ name: 'grafico', query: { cups: cupsNo } })
}

onMounted(loadCups)
</script>

<template>
  <DashboardLayout>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h1 class="h4 mb-0">CUPS</h1>
      <button class="btn btn-outline-primary btn-sm" @click="loadCups" :disabled="loading">
        {{ loading ? 'Cargando…' : 'Actualizar' }}
      </button>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="error" class="alert alert-danger">{{ error }}</div>

        <div v-if="!error && !cups.length && !loading" class="text-muted">
          No hay CUPS para este cliente.
        </div>

        <div class="table-responsive" v-if="cups.length">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th style="width: 60%">CUPS</th>
                <th class="text-end" style="width: 40%">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in cups" :key="c">
                <td><code>{{ c }}</code></td>
                <td class="text-end">
                  <button class="btn btn-primary btn-sm" @click="crearSugerencia(c)">
                    Crear click
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  </DashboardLayout>
</template>
