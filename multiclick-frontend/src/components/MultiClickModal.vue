<script setup>
import { ref, watch, computed } from 'vue'
import api from '@/services/api'

const props = defineProps({
  show: { type: Boolean, default: false },
  points: { type: Array, default: () => [] }, // [{ key,label,value }]
  customerNo: { type: [String, Number], default: '' },
  prefilledCups: { type: String, default: '' } // 👈 NUEVO
})
const emit = defineEmits(['close', 'submit', 'remove'])

const cups = ref('')
const cupsOptions = ref([])
const loadingCups = ref(false)
const loadError = ref('')

const canSubmit = computed(() =>
  props.points.length > 0 && !!props.customerNo && !!cups.value && !loadingCups.value && !loadError.value
)

async function loadCups () {
  // No resetees cups si viene prefilledCups
  cupsOptions.value = []
  loadError.value = ''
  if (!props.customerNo) {
    loadError.value = 'No hay CustomerId en sesión.'
    return
  }
  loadingCups.value = true
  try {
    const { data } = await api.get('/v1/CustomerCups/ByCustomer', {
      params: { customerNo: props.customerNo }
    })
    const arr = Array.isArray(data) ? data.map(x => x?.cups ?? x?.Cups).filter(Boolean) : []
    cupsOptions.value = arr

    // Si viene preselección y existe en opciones, la aplicamos
    if (props.prefilledCups && arr.includes(props.prefilledCups)) {
      cups.value = props.prefilledCups
    } else if (!props.prefilledCups) {
      cups.value = '' // comportamiento normal
    }
  } catch (e) {
    console.error('Error cargando CUPS:', e)
    loadError.value = 'No se pudieron cargar los CUPS.'
  } finally {
    loadingCups.value = false
  }
}

// Cargar al abrir
watch(() => props.show, (v) => { if (v) loadCups() })

// Si cambia la preselección mientras el modal está abierto y ya hay opciones, intenta aplicarla
watch(() => props.prefilledCups, (v) => {
  if (!props.show) return
  if (!v) return
  if (cupsOptions.value.includes(v)) cups.value = v
})

function onSubmit () {
  if (!canSubmit.value) return
  emit('submit', {
    customerNo: String(props.customerNo),
    customerCups: cups.value
  })
}

function onRemove (key) {
  emit('remove', key)
}
</script>


<template>
  <Teleport to="body">
    <div v-if="show" class="mc-backdrop" aria-modal="true" role="dialog" @click.self>
      <div class="mc-modal">
        <div class="mc-header">
          <h5 class="m-0">Resumen de puntos seleccionados</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="$emit('close')"></button>
        </div>

        <div class="mc-body">
          <div class="mb-3">
            <h6 class="mb-2">Puntos (OMIP Base)</h6>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Mes / Año</th>
                    <th>Valor (€/MWh)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, i) in points" :key="p.key">
                    <td>{{ i + 1 }}</td>
                    <td>{{ p.label }}</td>
                    <td>{{ p.value == null ? '-' : `${p.value} € / MWh` }}</td>
                    <td>
                      <button type="button" class="btn btn-sm btn-outline-danger" @click="onRemove(p.key)">
                        Quitar
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!points.length">
                    <td colspan="4" class="text-center text-muted">Sin puntos seleccionados</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <small class="text-muted">Máximo 5 puntos.</small>
          </div>

          <hr class="my-3" />

          <!-- <div class="mb-2">
            <label class="form-label">Cliente</label>
            <div>
              <code v-if="customerNo">{{ customerNo }}</code>
              <span v-else class="text-danger">No hay CustomerId en sesión</span>
            </div>
          </div> -->

          <div class="mb-1">
            <label class="form-label">CUPS <span class="text-danger">*</span></label>
            <select class="form-select" v-model="cups" :disabled="loadingCups || !!loadError">
              <option value="">Selecciona la opción</option>
              <option v-for="c in cupsOptions" :key="c" :value="c">{{ c }}</option>
            </select>
            <div v-if="loadingCups" class="form-text">Cargando CUPS…</div>
            <div v-if="loadError" class="text-danger small">{{ loadError }}</div>
          </div>
        </div>

        <div class="mc-footer">
          <button class="btn btn-outline-secondary" @click="$emit('close')">Cancelar</button>
          <button class="btn btn-primary" :disabled="!canSubmit" @click="onSubmit">Aceptar y enviar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1050}
.mc-modal{background:#fff;width:min(960px,95vw);max-height:90vh;border-radius:.75rem;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden;display:flex;flex-direction:column}
.mc-header,.mc-footer{padding:.75rem 1rem;background:#fff;display:flex;align-items:center;justify-content:space-between}
.mc-body{padding:1rem;overflow:auto}
</style>
