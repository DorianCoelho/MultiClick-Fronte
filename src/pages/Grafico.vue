<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import MultiClickModal from '@/components/MultiClickModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { Toast } from 'bootstrap'

const route = useRoute()

// CUPS que puede venir en la query (p.ej. /grafico?cups=ES123...)
const prefilledCups = ref('')
watch(
  () => route.query.cups,
  (v) => { prefilledCups.value = v ? String(v) : '' },
  { immediate: true }
)

// NUEVO estado
const hasLastIndex = ref(false)
const feeEnergy = ref(0)        // número (0 si no hay)
const feeLoaded = ref(false)    // para saber si ya preguntamos

// ===================== Auth =====================
const auth = useAuthStore()
// Ajusta el campo si tu token/usuario lo expone con otro nombre
const customerNo = computed(() =>
  auth.user?.id || auth.user?.customerNo || auth.user?.customerId || ''
)

// ===================== Estado base =====================
const loading = ref(false)
const btnDisabled = ref(true)
const showModal = ref(false)

// ===================== Toast helpers =====================
const TOAST_DELAY = 5000 // ms

function showToast(message, type = 'success', title = '') {
  const toastEl = document.getElementById('multiClickToast')
  const titleEl = document.getElementById('multiClickToastTitle')
  const bodyEl = document.getElementById('multiClickToastBody')
  const iconEl = document.getElementById('multiClickToastIcon')
  const progress = document.getElementById('multiClickToastProgress')
  if (!toastEl) return

  // Tema
  toastEl.classList.remove('toast--success', 'toast--error', 'toast--info')
  toastEl.classList.add(`toast--${type}`)

  // Contenido
  titleEl.textContent = title || (type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Aviso')
  bodyEl.textContent = message
  iconEl.innerHTML = {
    success: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm-1 14l-4-4 1.414-1.414L11 12.172l4.586-4.586L17 9l-6 7z"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm3.536 12.95L14.95 15.536 12 12.586l-2.95 2.95-1.414-1.414L10.586 11 7.636 8.05 9.05 6.636 12 9.586l2.95-2.95 1.414 1.414L13.414 11l2.95 2.95-1.414 1.414z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
  }[type]

  // Reiniciar barra de progreso
  if (progress) {
    progress.style.animation = 'none'
    // fuerza reflow
    // eslint-disable-next-line no-unused-expressions
    progress.offsetHeight
    progress.style.animation = `toastProgress ${TOAST_DELAY}ms linear forwards`
  }

  const t = new Toast(toastEl, { autohide: true, delay: TOAST_DELAY })
  t.show()
}


// ===================== Helpers =====================
// parsea "1,234" o "1.234"
function parseNumLike(n) {
  if (n == null) return null
  if (typeof n === 'number') return n
  const s = String(n).replace(',', '.')
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

// Datos API (mapas para el gráfico)
const omipMap = new Map() // YYYY-MM -> number
const omieMap = new Map()
const oldMap = new Map()

// Helpers de fechas/formatos
const pad2 = n => String(Number(n)).padStart(2, '0')
const normYear = y => (Number(y) < 100 ? 2000 + Number(y) : Number(y))
const toMonthKey = (y, m) => `${normYear(y)}-${pad2(m)}`
const keyYear = k => Number(k.split('-')[0])
const keyMonth = k => Number(k.split('-')[1])
const labelMonth = (k) => {
  const [y, m] = k.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '')
}
const labelQuarter = p => p.replace('-', ' ')
const labelSemester = p => p.replace('-', ' ')
const labelYear = p => p
const safeNum = v => (v == null || v === '' ? null : Number(v))

// NUEVO: periodicidad objetivo visible solo en MES
const periodTarget = ref('Q') // 'Q' | 'S' | 'Y'

// botón “Enviar” deshabilitado si:
// - no hay contrato (hasLastIndex=false) o
// - no estamos en Mes o
// - no hay puntos seleccionados
const gran = ref('M') // M/Q/S/Y
const selectedSet = reactive(new Set()) // selección usuario
const MAX_POINTS = 1

const canSend = computed(() =>
  hasLastIndex.value && gran.value === 'M' && selectedSet.size > 0
)

// ===================== Cargar datos =====================
async function loadLastContractIndex() {
  hasLastIndex.value = false
  feeEnergy.value = 0
  feeLoaded.value = true
  try {
    const { data } = await api.get('/v1/ContractCliente/LastContractIndex', {
      params: { customerNo: customerNo.value, marketer: 'NAB' }
    })
    const result = data

    if (result) {
      const fee = parseNumLike(result.feeEnergy ?? result.FeeEnergy)
      feeEnergy.value = fee ?? 0
      hasLastIndex.value = true   // hay contrato (aunque fee sea 0)
    }
  } catch (e) {
    // sin contrato o error → hasLastIndex=false
    hasLastIndex.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    // 👇 API versionada
    const { data } = await api.get('/v1/MultiClick')

    // tolera camelCase o PascalCase en el DTO
    const omipArr = data.omipMultiClicks ?? data.OmipMultiClicks ?? []
    const omieArr = data.omieMultiClicks ?? data.OmieMultiClicks ?? []
    const oldArr = data.oldOmipMultiClicks ?? data.OldOmipMultiClicks ?? []

    const mapByKey = (arr, selector) => {
      const map = new Map()
        ; (arr || []).forEach(x => {
          const year = x.year ?? x.Year
          const month = x.month ?? x.Month
          const price = selector(x)
          if (year != null && month != null) {
            const key = `${Number(year)}-${String(month).padStart(2, '0')}` // YYYY-MM
            map.set(key, price)
          }
        })
      return map
    }
    const num = (x) => {
      const v = x.price ?? x.Price ?? x.value ?? x.Value
      return v == null ? null : Number(v)
    }

    omipMap.clear(); omieMap.clear(); oldMap.clear()
    mapByKey(omipArr, num).forEach((v, k) => omipMap.set(k, v))
    mapByKey(omieArr, num).forEach((v, k) => omieMap.set(k, v))
    mapByKey(oldArr, num).forEach((v, k) => oldMap.set(k, v))

    // ...después de llenar omipMap/omieMap/oldMap:
    if (hasLastIndex.value) {
      // suma el fee a OMIP Base
      for (const [k, v] of omipMap.entries()) {
        if (v != null) omipMap.set(k, Number(v) + Number(feeEnergy.value || 0))
      }
    }

    initPeriods()
    rebuildChart()
  } catch (e) {
    console.error('Error GET /api/v1/MultiClick', e)
  } finally {
    loading.value = false
  }
}

// ===================== Periodos y granularidad =====================
const allMonthKeys = ref([])     // todas las claves disponibles ordenadas (YYYY-MM)
const baseMonthKeys = ref([])    // desde el mes siguiente al actual
const periodKeys = ref([])       // lista visible según gran

function addMonthsKey(key, delta) {
  const y = keyYear(key)
  const m0 = keyMonth(key) - 1 // 0..11
  const d = new Date(y, m0 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

function monthRange(startKey, endKey) {
  const out = []
  if (!startKey || !endKey) return out
  let k = startKey
  // genera YYYY-MM consecutivos hasta endKey inclusive
  while (k <= endKey) {
    out.push(k)
    if (k === endKey) break
    k = addMonthsKey(k, 1)
  }
  return out
}

// Reemplaza tu initPeriods() por esta:
function initPeriods() {
  // keys disponibles de la API (ordenadas yyyy-mm)
  const all = Array.from(omipMap.keys()).sort()
  allMonthKeys.value = all

  // "mes actual + 1" con Date para evitar líos de zona horaria / fin de mes
  const today = new Date()
  const firstOfNext = new Date(today.getFullYear(), today.getMonth() + 2, 1)
  const nextKey = `${firstOfNext.getFullYear()}-${pad2(firstOfNext.getMonth() + 1)}`

  // límite superior: último mes que venga de la API; si no hay, usa nextKey
  const lastKey = all.length ? all[all.length - 1] : nextKey

  // construye secuencia continua [nextKey..lastKey]
  baseMonthKeys.value = monthRange(nextKey, lastKey)

  // aplica a la vista actual (M/Q/S/Y)
  periodKeys.value = periodListForGran(gran.value)
}

const toQuarter = m => `Q${Math.ceil(m / 3)}`
const toSemester = m => (m <= 6 ? 'S1' : 'S2')

const quarters = computed(() => {
  const set = new Set()
  baseMonthKeys.value.forEach(k => set.add(`${keyYear(k)}-${toQuarter(keyMonth(k))}`))
  return Array.from(set).sort((a, b) => {
    const [ya, qa] = a.split('-'); const [yb, qb] = b.split('-')
    if (ya !== yb) return Number(ya) - Number(yb)
    return Number(qa.substring(1)) - Number(qb.substring(1))
  })
})
const semesters = computed(() => {
  const set = new Set()
  baseMonthKeys.value.forEach(k => set.add(`${keyYear(k)}-${toSemester(keyMonth(k))}`))
  return Array.from(set).sort((a, b) => {
    const [ya, sa] = a.split('-'); const [yb, sb] = b.split('-')
    if (ya !== yb) return Number(ya) - Number(yb)
    return sa === 'S1' && sb === 'S2' ? -1 : (sa === sb ? 0 : 1)
  })
})
const years = computed(() => Array.from(new Set(baseMonthKeys.value.map(k => keyYear(k)))).sort((a, b) => a - b).map(String))

function periodListForGran(g) {
  if (g === 'M') return baseMonthKeys.value.slice()
  if (g === 'Q') return quarters.value.slice()
  if (g === 'S') return semesters.value.slice()
  if (g === 'Y') return years.value.slice()
  return baseMonthKeys.value.slice()
}

function monthsOfPeriod(periodKey, g) {
  if (g === 'M') return [periodKey]
  if (g === 'Y') return baseMonthKeys.value.filter(k => keyYear(k) === Number(periodKey))
  if (g === 'S') {
    const [y, s] = periodKey.split('-')
    const months = s === 'S1' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
    return baseMonthKeys.value.filter(k => keyYear(k) === Number(y) && months.includes(keyMonth(k)))
  }
  if (g === 'Q') {
    const [y, q] = periodKey.split('-')
    const qNum = Number(q.substring(1))
    const start = (qNum - 1) * 3 + 1
    const months = [start, start + 1, start + 2]
    return baseMonthKeys.value.filter(k => keyYear(k) === Number(y) && months.includes(keyMonth(k)))
  }
  return []
}

const avg = (arr) => {
  const v = arr.filter(x => x != null && !isNaN(x))
  if (!v.length) return null
  return Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2))
}
const shiftYearKey = (k, dy) => `${keyYear(k) + dy}-${pad2(keyMonth(k))}`

function aggregateForPeriod(periodKey, g, map) {
  return avg(monthsOfPeriod(periodKey, g).map(k => map.get(k)))
}
function aggregateForPeriodShifted(periodKey, g, map, dy) {
  return avg(monthsOfPeriod(periodKey, g).map(k => map.get(shiftYearKey(k, dy))))
}

// ===================== Gráfico ApexCharts =====================
const chartRef = ref(null) // ref del <apexchart>
const series = ref([
  { name: 'OMIP Base', data: [] },
  { name: 'OMIE (-5 años)', data: [] },
  { name: 'OMIP Hist (-5 años)', data: [] }
])

const colorOmip = '#ff9f43'
const colorSelected = '#dc3545'
const colorLow = '#198754'

function computeLowFive(keys, g) {
  return new Set(
    keys.map(k => ({ k, v: aggregateForPeriod(k, g, omipMap) }))
      .filter(x => x.v != null && !isNaN(x.v))
      .sort((a, b) => a.v - b.v)
      .slice(0, 5)
      .map(x => x.k)
  )
}
let lowFiveSet = new Set()

function labelsForGran(g, keys) {
  if (g === 'M') return keys.map(labelMonth)
  if (g === 'Q') return keys.map(labelQuarter)
  if (g === 'S') return keys.map(labelSemester)
  if (g === 'Y') return keys.map(labelYear)
  return keys
}

const chartOptions = ref({
  chart: {
    id: 'multiclick',
    height: 400,
    type: 'line',
    toolbar: { show: false },
    zoom: { enabled: false },
    events: {
      dataPointSelection(event, ctx, cfg) { onTogglePoint(cfg) },
      markerClick(event, ctx, cfg) { onTogglePoint(cfg) }
    }
  },
  colors: [colorOmip, '#0d6efd', '#6c757d'],
  markers: { size: 6, hover: { size: 8 }, discrete: [] },
  stroke: { curve: 'straight' },
  dataLabels: { enabled: false },
  tooltip: { shared: true, intersect: false },
  grid: { borderColor: '#e0e0e0' },
  xaxis: { categories: [] },
  yaxis: {
    title: { text: 'Precio (€/MWh)' },
    labels: {
      formatter: (val) => (val == null ? '' : Number(val).toFixed(2)) // ← 2 decimales en el eje
    }
  },
  legend: { show: true, position: 'top', horizontalAlign: 'right', offsetY: 8 }
})

function buildDiscreteMarkers(keys) {
  const disc = []
  keys.forEach((k, idx) => {
    if (selectedSet.has(k)) {
      disc.push({ seriesIndex: 0, dataPointIndex: idx, fillColor: colorSelected, strokeColor: colorSelected, size: 8 })
    } else if (lowFiveSet.has(k)) {
      disc.push({ seriesIndex: 0, dataPointIndex: idx, fillColor: colorLow, strokeColor: colorLow, size: 8 })
    }
  })
  return disc
}

function rebuildChart() {
  const keys = periodListForGran(gran.value)
  periodKeys.value = keys
  lowFiveSet = computeLowFive(keys, gran.value)
  series.value = [
    { name: 'OMIP Base', data: keys.map(k => aggregateForPeriod(k, gran.value, omipMap)) },
    { name: 'OMIE (-5 años)', data: keys.map(k => aggregateForPeriodShifted(k, gran.value, omieMap, -5)) },
    { name: 'OMIP Hist (-5 años)', data: keys.map(k => aggregateForPeriodShifted(k, gran.value, oldMap, -5)) }
  ]
  chartOptions.value = {
    ...chartOptions.value,
    xaxis: { categories: labelsForGran(gran.value, keys) },
    markers: { size: 6, hover: { size: 8 }, discrete: buildDiscreteMarkers(keys) }
  }
  // Enabling/disabling enviar
  btnDisabled.value = !Array.from(selectedSet).some(k => keys.includes(k))
}

function onTogglePoint(cfg) {
  // BLOQUEA selección si no es MES o no hay contrato
  if (gran.value !== 'M' || !hasLastIndex.value) return
  if (cfg.seriesIndex !== 0) return

  const idx = cfg.dataPointIndex
  const k = periodKeys.value[idx]
  if (selectedSet.has(k)) {
    selectedSet.delete(k)
  } else {
    if (selectedSet.size >= MAX_POINTS) {
      alert(`Solo puedes seleccionar hasta ${MAX_POINTS} puntos.`)
      return
    }
    selectedSet.add(k)
  }
  chartOptions.value = {
    ...chartOptions.value,
    markers: { size: 6, hover: { size: 8 }, discrete: buildDiscreteMarkers(periodKeys.value) }
  }
  btnDisabled.value = selectedSet.size === 0 || !Array.from(selectedSet).some(x => periodKeys.value.includes(x))
}

function setGran(g) {
  gran.value = g
  rebuildChart()
}

// ===================== Modal =====================
const modalPoints = ref([]) // [{ key,label,value }]

function average(values) {
  const v = values.filter(x => x != null && !Number.isNaN(Number(x))).map(Number)
  if (!v.length) return null
  return Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2))
}

function openModal() {
  if (!canSend.value) return
  // Ordena: primero los visibles en esta gran, luego el resto
  const ordered = [
    ...periodKeys.value.filter(k => selectedSet.has(k)),
    ...Array.from(selectedSet).filter(k => !periodKeys.value.includes(k))
  ]
  modalPoints.value = ordered.map(k => {
    let label
    if (/^\d{4}-\d{2}$/.test(k)) label = labelMonth(k)
    else if (/^\d{4}-Q[1-4]$/.test(k)) label = labelQuarter(k)
    else if (/^\d{4}-S[12]$/.test(k)) label = labelSemester(k)
    else label = labelYear(k)

    let value
    if (/^\d{4}-\d{2}$/.test(k)) value = aggregateForPeriod(k, 'M', omipMap)
    else if (/^\d{4}-Q[1-4]$/.test(k)) value = aggregateForPeriod(k, 'Q', omipMap)
    else if (/^\d{4}-S[12]$/.test(k)) value = aggregateForPeriod(k, 'S', omipMap)
    else value = aggregateForPeriod(k, 'Y', omipMap)

    return { key: k, label, value }
  })
  showModal.value = true
}

function onRemovePoint(key) {
  if (selectedSet.has(key)) {
    selectedSet.delete(key)
    rebuildChart()
    // También quítalo del resumen
    modalPoints.value = modalPoints.value.filter(p => p.key !== key)
    btnDisabled.value = selectedSet.size === 0
  }
}

async function onSubmitModal(payload) {
  try {
    const res = await api.post('/v1/MultiClick/SendProposalByUser', payload, {
      headers: { 'Content-Type': 'application/json' }
    })

    if (res.data.success) {
      showToast(`Contrato creado con éxito Nº ${res.data.contractNo}`, 'success')
      showModal.value = false
    } else {
      showToast(`Error: ${res.data.error || 'Error desconocido'}`, 'error')
    }
  } catch (e) {
    showToast(e?.response?.data?.error || 'Ocurrió un error inesperado', 'error')
  }
}

onMounted(async () => {
  await loadLastContractIndex()
  await loadData()
})
</script>

<template>
  <DashboardLayout>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h1 class="h4 mb-0">MultiClick · Gráfico</h1>

      <div class="btn-group">
        <button class="btn btn-outline-secondary" :class="{ active: gran === 'M' }" @click="setGran('M')">Mes</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran === 'Q' }"
          @click="setGran('Q')">Trimestre</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran === 'S' }"
          @click="setGran('S')">Semestre</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran === 'Y' }" @click="setGran('Y')">Año</button>
      </div>

      <!-- SOLO EN MES: periodicidad objetivo para la solicitud -->
      <div v-if="gran === 'M'"><span>Duración click: </span>
        <div class="btn-group ms-2" role="group" aria-label="Período cubierto">
          <button class="btn btn-outline-secondary" :class="{ active: periodTarget === 'Q' }"
            @click="periodTarget = 'Q'">Trimestre</button>
          <button class="btn btn-outline-secondary" :class="{ active: periodTarget === 'S' }"
            @click="periodTarget = 'S'">Semestre</button>
          <button class="btn btn-outline-secondary" :class="{ active: periodTarget === 'Y' }"
            @click="periodTarget = 'Y'">Año</button>
        </div>
      </div>

      <button class="btn btn-primary" :disabled="!canSend" @click="openModal">Enviar</button>
    </div>

    <div class="card">
      <div class="card-header d-flex justify-content-between">
        <div>
          <h5 class="card-title mb-0">MultiClick</h5>
          <small class="text-muted">Selecciona 1 punto de “OMIP Base”.</small>
        </div>
      </div>
      <div class="card-body">
        <apexchart ref="chartRef" type="line" height="400" :options="chartOptions" :series="series" />
      </div>
    </div>

    <MultiClickModal :show="showModal" :points="modalPoints" :customer-no="customerNo" :prefilled-cups="prefilledCups"
      :default-period-type="periodTarget" @remove="onRemovePoint" @submit="onSubmitModal" @close="showModal = false" />

    <!-- Toast Bootstrap -->
    <teleport to="body">
  <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 20000;">
    <div
      id="multiClickToast"
      class="toast pretty-toast toast--success"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div class="toast-inner">
        <div class="toast-icon" id="multiClickToastIcon"></div>
        <div class="toast-content">
          <strong class="toast-title" id="multiClickToastTitle">Éxito</strong>
          <div class="toast-body p-0" id="multiClickToastBody"></div>
        </div>
        <button
          type="button"
          class="btn-close btn-close-white ms-2"
          data-bs-dismiss="toast"
          aria-label="Cerrar"
        ></button>
      </div>
      <div class="toast-progress" id="multiClickToastProgress"></div>
    </div>
  </div>
</teleport>

  </DashboardLayout>
</template>

<style scoped>
/* nada especial, el contenedor del toast ya lleva z-index inline */
.pretty-toast {
  --toast-radius: 14px;
  --toast-shadow: 0 10px 30px rgba(0,0,0,.18);
  --toast-fg: #fff;

  border: 0;
  border-radius: var(--toast-radius);
  box-shadow: var(--toast-shadow);
  color: var(--toast-fg);
  overflow: hidden;
  backdrop-filter: saturate(1.15) blur(6px);
  padding: 0; /* lo controla .toast-inner */
}

.pretty-toast .toast-inner {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .8rem 1rem .8rem .9rem;
}

.pretty-toast .toast-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(255,255,255,.18);
}

.pretty-toast .toast-title {
  display: block;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: .15rem;
}

.pretty-toast .toast-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pretty-toast .btn-close {
  filter: invert(1);
  opacity: .9;
}
.pretty-toast .btn-close:hover { opacity: 1; }

/* Barra de progreso inferior */
.pretty-toast .toast-progress {
  height: 3px;
  width: 100%;
  background: rgba(255,255,255,.35);
  transform-origin: left;
  /* se anima via JS -> animation: toastProgress 5000ms linear forwards; */
}

@keyframes toastProgress {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

/* Temas */
.toast--success {
  background: linear-gradient(135deg, #16a34a, #22c55e);
}
.toast--error {
  background: linear-gradient(135deg, #dc2626, #ef4444);
}
.toast--info {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
}

/* Animación de entrada sutil */
.pretty-toast.showing,
.pretty-toast.show {
  animation: toastSlideIn .18s ease-out both;
}
@keyframes toastSlideIn {
  from { transform: translateY(-6px); opacity: .0; }
  to   { transform: translateY(0);    opacity: 1;  }
}

</style>
