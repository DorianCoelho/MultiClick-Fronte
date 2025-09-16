<script setup>
import { ref, reactive, computed, onMounted,watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import MultiClickModal from '@/components/MultiClickModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
const route = useRoute()

// CUPS que puede venir en la query (p.ej. /grafico?cups=ES123...)
const prefilledCups = ref('')
watch(
  () => route.query.cups,
  (v) => { prefilledCups.value = v ? String(v) : '' },
  { immediate: true }
)

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

// Datos API
const omipMap = new Map() // YYYY-MM -> number
const omieMap = new Map()
const oldMap  = new Map()

// Helpers
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
const labelQuarter  = p => p.replace('-', ' ')
const labelSemester = p => p.replace('-', ' ')
const labelYear     = p => p

const safeNum = v => (v == null || v === '' ? null : Number(v))

// ===================== Cargar datos =====================
async function loadData () {
  loading.value = true
  try {
    // 👇 API versionada
    const { data } = await api.get('/v1/MultiClick')

    // tolera camelCase o PascalCase en el DTO
    const omipArr = data.omipMultiClicks ?? data.OmipMultiClicks ?? []
    const omieArr = data.omieMultiClicks ?? data.OmieMultiClicks ?? []
    const oldArr  = data.oldOmipMultiClicks ?? data.OldOmipMultiClicks ?? []

    const mapByKey = (arr, selector) => {
      const map = new Map()
      ;(arr || []).forEach(x => {
        const year  = x.year  ?? x.Year
        const month = x.month ?? x.Month
        const price = selector(x)
        if (year != null && month != null) {
          const key = `${Number(year)}-${String(month).padStart(2,'0')}` // YYYY-MM
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
    mapByKey(omipArr, num).forEach((v,k) => omipMap.set(k, v))
    mapByKey(omieArr, num).forEach((v,k) => omieMap.set(k, v))
    mapByKey(oldArr , num).forEach((v,k) => oldMap.set(k, v))

    initPeriods()
    rebuildChart()
  } catch (e) {
    console.error('Error GET /api/v1/MultiClick', e)
  } finally {
    loading.value = false
  }
}

// ===================== Periodos y granularidad =====================
const gran = ref('M') // M/Q/S/Y
const allMonthKeys = ref([])     // todas las claves disponibles ordenadas (YYYY-MM)
const baseMonthKeys = ref([])    // desde el mes siguiente al actual
const periodKeys = ref([])       // lista visible según gran
const selectedSet = reactive(new Set()) // selección usuario
const MAX_POINTS = 5

function initPeriods () {
  allMonthKeys.value = Array.from(omipMap.keys()).sort()
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const minKey = `${nextMonth.getFullYear()}-${pad2(nextMonth.getMonth() + 1)}`
  baseMonthKeys.value = allMonthKeys.value.filter(k => k >= minKey)
  periodKeys.value = periodListForGran(gran.value)
}

const toQuarter = m => `Q${Math.ceil(m/3)}`
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
    return sa === 'S1' && sb === 'S2' ? -1 : (sa===sb?0:1)
  })
})
const years = computed(() => Array.from(new Set(baseMonthKeys.value.map(k => keyYear(k)))).sort((a,b)=>a-b).map(String))

function periodListForGran (g) {
  if (g === 'M') return baseMonthKeys.value.slice()
  if (g === 'Q') return quarters.value.slice()
  if (g === 'S') return semesters.value.slice()
  if (g === 'Y') return years.value.slice()
  return baseMonthKeys.value.slice()
}

function monthsOfPeriod (periodKey, g) {
  if (g === 'M') return [periodKey]
  if (g === 'Y') return baseMonthKeys.value.filter(k => keyYear(k) === Number(periodKey))
  if (g === 'S') {
    const [y, s] = periodKey.split('-')
    const months = s === 'S1' ? [1,2,3,4,5,6] : [7,8,9,10,11,12]
    return baseMonthKeys.value.filter(k => keyYear(k) === Number(y) && months.includes(keyMonth(k)))
  }
  if (g === 'Q') {
    const [y, q] = periodKey.split('-')
    const qNum = Number(q.substring(1))
    const start = (qNum - 1) * 3 + 1
    const months = [start, start+1, start+2]
    return baseMonthKeys.value.filter(k => keyYear(k) === Number(y) && months.includes(keyMonth(k)))
  }
  return []
}

const avg = (arr) => {
  const v = arr.filter(x => x != null && !isNaN(x))
  if (!v.length) return null
  return Number((v.reduce((a,b)=>a+b,0)/v.length).toFixed(2))
}
const shiftYearKey = (k, dy) => `${keyYear(k) + dy}-${pad2(keyMonth(k))}`

function aggregateForPeriod (periodKey, g, map) {
  return avg(monthsOfPeriod(periodKey, g).map(k => map.get(k)))
}
function aggregateForPeriodShifted (periodKey, g, map, dy) {
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
        .sort((a,b) => a.v - b.v)
        .slice(0, 5)
        .map(x => x.k)
  )
}
let lowFiveSet = new Set()

function labelsForGran (g, keys) {
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
      dataPointSelection (event, ctx, cfg) { onTogglePoint(cfg) },
      markerClick (event, ctx, cfg) { onTogglePoint(cfg) }
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

function rebuildChart () {
  const keys = periodListForGran(gran.value)
  periodKeys.value = keys
  lowFiveSet = computeLowFive(keys, gran.value)
  series.value = [
    { name: 'OMIP Base', data: keys.map(k => aggregateForPeriod(k, gran.value, omipMap)) },
    { name: 'OMIE (-5 años)', data: keys.map(k => aggregateForPeriodShifted(k, gran.value, omieMap, -5)) },
    { name: 'OMIP Hist (-5 años)', data: keys.map(k => aggregateForPeriodShifted(k, gran.value, oldMap , -5)) }
  ]
  chartOptions.value = {
    ...chartOptions.value,
    xaxis: { categories: labelsForGran(gran.value, keys) },
    markers: { size: 6, hover: { size: 8 }, discrete: buildDiscreteMarkers(keys) }
  }
  // Enabling/disabling enviar
  btnDisabled.value = !Array.from(selectedSet).some(k => keys.includes(k))
}

function onTogglePoint (cfg) {
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

function setGran (g) {
  gran.value = g
  rebuildChart()
}

// ===================== Modal =====================
const modalPoints = ref([]) // [{ key,label,value }]

function openModal () {
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

function onRemovePoint (key) {
  if (selectedSet.has(key)) {
    selectedSet.delete(key)
    rebuildChart()
    // También quítalo del resumen
    modalPoints.value = modalPoints.value.filter(p => p.key !== key)
    btnDisabled.value = selectedSet.size === 0
  }
}

async function onSubmitModal ({ customerNo, customerCups }) {
  // Ajusta la URL al endpoint real de tu API que guarda el multiclick
  const payload = {
    customerNo,
    customerCups,
    selectedPoints: modalPoints.value // [{key,label,value}]
  }
  // await api.post('/v1/MultiClick/Submit', payload)
  showModal.value = false
}

onMounted(loadData)
</script>

<template>
  <DashboardLayout>
    <div class="d-flex align-items-center justify-content-between mb-3">
      <h1 class="h4 mb-0">MultiClick · Gráfico</h1>

      <div class="btn-group">
        <button class="btn btn-outline-secondary" :class="{ active: gran==='M' }" @click="setGran('M')">Mes</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran==='Q' }" @click="setGran('Q')">Trimestre</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran==='S' }" @click="setGran('S')">Semestre</button>
        <button class="btn btn-outline-secondary" :class="{ active: gran==='Y' }" @click="setGran('Y')">Año</button>
      </div>

      <button class="btn btn-primary" :disabled="btnDisabled" @click="openModal">Enviar</button>
    </div>

    <div class="card">
      <div class="card-header d-flex justify-content-between">
        <div>
          <h5 class="card-title mb-0">MultiClick</h5>
          <small class="text-muted">Selecciona hasta 5 puntos de “OMIP Base”.</small>
        </div>
      </div>
      <div class="card-body">
        <apexchart
          ref="chartRef"
          type="line"
          height="400"
          :options="chartOptions"
          :series="series"
        />
      </div>
    </div>

    <MultiClickModal
      :show="showModal"
      :points="modalPoints"
      :customer-no="customerNo"
      :prefilled-cups="prefilledCups"
      @remove="onRemovePoint"
      @submit="onSubmitModal"
      @close="showModal = false"
    />
  </DashboardLayout>
</template>
