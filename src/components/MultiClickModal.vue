<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import api from '@/services/api'

const props = defineProps({
  show: { type: Boolean, default: false },
  points: { type: Array, default: () => [] },
  customerNo: { type: [String, Number], default: '' },
  prefilledCups: { type: String, default: '' },
  defaultPeriodType: { type: String, default: 'Q' }
})
const emit = defineEmits(['close', 'submit', 'remove'])

const MARKETER = 'NAB' // ajusta si tu back necesita otro

const cups = ref('')
const cupsOptions = ref([])
const loadingCups = ref(false)
const loadError = ref('')

const periodType = ref('Q')
const fixedPrice = ref('')
const formError = ref('')
const userName = ref('')
const cif = ref('')
const contractNo = ref('')


const average = (values) => {
  const v = values.map(Number).filter(x => Number.isFinite(x))
  return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : null
}
const parseNumLike = (n) => {
  if (n == null || n === '') return null
  const s = String(n).replace(',', '.')
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

const canSubmit = computed(() => {
  formError.value = ''
  if (!props.customerNo) { formError.value = 'Falta el CustomerId.'; return false }
  if (!cups.value) { formError.value = 'Selecciona un CUPS.'; return false }
  if (!['Q', 'S', 'Y'].includes(periodType.value)) { formError.value = 'Selecciona un período cubierto.'; return false }
  
  const price = parseNumLike(fixedPrice.value)
  if (price == null || price <= 0) { formError.value = 'Indica un precio válido.'; return false }
  if (!props.points.length) { formError.value = 'No hay puntos seleccionados.'; return false }
  return true
})

/* ========= NUEVO: cargar CUPS desde LastContractIndex ========= */
async function loadCups() {
  cupsOptions.value = []
  loadError.value = ''
  if (!props.customerNo) {
    loadError.value = 'No hay CustomerId en sesión.'
    return
  }
  loadingCups.value = true
  try {
    const { data } = await api.get('/v1/ContractCliente/LastContractIndex', {
      params: { customerNo: String(props.customerNo), marketer: MARKETER }
    })
    

    if (!data) {
      loadError.value = 'El cliente no tiene contrato Index activo.'
      cups.value = ''
      return
    }

    const multicups = data.multicups ?? data.Multicups ?? false
    const list = data.multiCupsList ?? data.MultiCupsList ?? null
    const singleCup = data.customerCUPS ?? data.CustomerCUPS ?? ''
    userName.value = data.customerName ?? data.CustomerName ?? ''
    cif.value = data.vatRegistrationNo ?? data.VatRegistrationNo ?? ''
    contractNo.value = data.no ?? data.No ?? ''


    let arr = []
    if (multicups) {
      arr = Array.isArray(list) ? list.filter(Boolean) : []
    } else if (singleCup) {
      arr = [singleCup]
    }

    if (!arr.length) {
      loadError.value = 'No se encontraron CUPS en el contrato.'
      cups.value = ''
      cupsOptions.value = []
      return
    }

    cupsOptions.value = arr

    // Preselección por query si coincide, luego autoseleccionar si solo hay uno
    if (props.prefilledCups && arr.includes(props.prefilledCups)) {
      cups.value = props.prefilledCups
    } else if (arr.length === 1) {
      cups.value = arr[0]
    } else {
      cups.value = ''
    }
  } catch (e) {
    console.error('Error cargando LastContractIndex:', e)
    loadError.value = e?.response?.data?.message || 'No se pudieron cargar los CUPS desde el contrato.'
  } finally {
    loadingCups.value = false
  }
}
/* =============================================================== */

watch(() => props.show, async (v) => {
  if (!v) return
  periodType.value = ['Q', 'S', 'Y'].includes(props.defaultPeriodType) ? props.defaultPeriodType : 'Q'
  const avg = average((props.points || []).map(p => p?.value))
  fixedPrice.value = avg != null ? String(avg) : ''
  formError.value = ''
  await loadCups() // ← ahora usa LastContractIndex
  await nextTick()
  document.getElementById('mc-modal')?.focus()
})

watch(() => props.prefilledCups, (v) => {
  if (!props.show || !v) return
  if (cupsOptions.value.includes(v)) cups.value = v
})

function onSubmit() {
  if (!canSubmit.value) return

  const payload = {
    contractNo: contractNo.value,
    customerNo: String(props.customerNo),
    customerCups: cups.value,
    periodType: periodType.value,
    fixedPriceOmip: Number(parseNumLike(fixedPrice.value)), // 👈 nombre correcto
    periodKeys: props.points.map(p => `${p.key}-01`),               // 👈 solo lista de keys
    volumeMw: 0                                             // si no tienes valor, envía 0
  }

  emit('submit', payload)
}
function onRemove(key) { emit('remove', key) }
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="mc-backdrop" aria-modal="true" role="dialog" @click.self="$emit('close')"
      @keydown.esc="$emit('close')">
      <div id="mc-modal" class="mc-modal" tabindex="-1">
        <div class="mc-header">
          <h5 class="m-0">PLANTILLA DE SOLICITUD DE OPERACIÓN</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="$emit('close')">×</button>
        </div>

        <div class="mc-body">
          <!-- Tabla puntos -->
          <div class="mb-3">
            <h6 class="mb-2">Click (OMIP Base)</h6>
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
                    <td colspan="4" class="text-center text-muted">Sin click seleccionado</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <small class="text-muted">Máximo 1 click.</small>
          </div>

          <hr class="my-3" />

          <!-- Formulario -->
          <div class="row g-3 p-3 justify-content-center align-items-center">
            <div class="col-12 col-md-6">
              <label class="form-label">Duración click <span class="text-danger">*</span></label>
              <div class="btn-group w-100" role="group">
                <button class="btn btn-outline-secondary" :class="{ active: periodType === 'Q' }"
                  @click="periodType = 'Q'">Trimestre</button>
                <button class="btn btn-outline-secondary" :class="{ active: periodType === 'S' }"
                  @click="periodType = 'S'">Semestre</button>
                <button class="btn btn-outline-secondary" :class="{ active: periodType === 'Y' }"
                  @click="periodType = 'Y'">Año</button>
              </div>
            </div>
          </div>

        
          <div class="row g-3 p-3 justify-content-center align-items-center">
            <div class="col-12 col-md-6">
              <h5>Datos del Cliente:</h5>
                <label class="form-label">Nombre</label>
                <input class="form-control" type="text" :value="userName"  readonly/>
            </div>
          </div>
          <div class="row g-3 p-3 justify-content-center align-items-center">
            <div class="col-12 col-md-6">
                <label class="form-label">DNI/CIF</label>
                <input class="form-control" type="text" :value="cif" readonly/>
            </div>
          </div>
          <div class="row g-3 p-3 justify-content-center align-items-center">
            <div class="col-12 col-md-6">
              <label class="form-label">CUPS <span class="text-danger">*</span></label>
              <select class="form-select" v-model="cups" :disabled="loadingCups || !!loadError">
                <option value="">Selecciona la opción</option>
                <option v-for="c in cupsOptions" :key="c" :value="c">{{ c }}</option>
              </select>
              <div v-if="loadingCups" class="form-text">Cargando CUPS…</div>
              <div v-if="loadError" class="text-danger small">{{ loadError }}</div>
            </div>
          </div>


          <div class="row g-3 p-3 justify-content-center align-items-center">
            <div class="col-12 col-md-6">
              <label class="form-label">Precio fijo acordado (OMIP) <span class="text-danger">*</span></label>
              <div class="input-group">
                <input class="form-control" type="number" inputmode="decimal" step="0.01" min="0" v-model="fixedPrice"
                  placeholder="Ej. 85.50" readonly/>
                <span class="input-group-text">€/MWh</span>
              </div>
              <small class="text-muted">Sugerido: media de los puntos seleccionados.</small>
            </div>
          </div>


          <div v-if="formError" class="alert alert-warning mt-3 mb-0">
            {{ formError }}
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

<style>
/* MODAL OVERLAY – sin scoped para que siempre aplique, incluso con Teleport */
.mc-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 20000;
  background: rgba(17, 24, 39, .6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mc-modal {
  width: min(960px, 95vw);
  max-height: 90vh;
  background: #fff;
  border-radius: .75rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateY(8px);
  opacity: 0;
  animation: mc-in .16s ease-out forwards;
}

@keyframes mc-in {
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.mc-header,
.mc-footer {
  padding: .75rem 1rem;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eef2f7;
}

.mc-footer {
  border-top: 1px solid #eef2f7;
  border-bottom: none;
}

.mc-body {
  padding: 1rem;
  overflow: auto;
}

.btn-close {
  appearance: none;
  background: none;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: .5rem;
}

.btn-close:hover {
  background: #f3f4f6;
}

.table-responsive {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: .95rem;
}

.table th,
.table td {
  padding: .5rem .6rem;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}

.alert {
  margin-top: .5rem;
}

.btn-group .btn.active {
  background: #0d6efd;
  color: #fff;
  border-color: #0d6efd;
}

.input-group-text {
  background: #f8fafc;
}
</style>