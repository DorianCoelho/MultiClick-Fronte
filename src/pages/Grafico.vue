<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import MultiClickModal from '@/components/MultiClickModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useRoute } from 'vue-router'
import { Toast } from 'bootstrap'
import config from '@/config/env'

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

/* ===================== MultiClick Contracts ===================== */
const multiclickRows = ref([])
const multiclickLoading = ref(false)
const multiclickError = ref('')

/* ===================== PDF Modal ===================== */
const showPdf = ref(false)
const pdfUrl = ref(null)
const pdfLoading = ref(false)
const pdfError = ref('')
const currentPdfId = ref(null)

/* ===================== Aprobar MultiClick ===================== */
const approving = reactive(new Set())

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
  hasLastIndex.value && selectedSet.size > 0
)

// ===================== Cargar datos =====================
async function loadLastContractIndex() {
  hasLastIndex.value = false
  feeEnergy.value = 0
  feeLoaded.value = true
  try {
    const { data } = await api.get('/v1/ContractCliente/LastContractIndex', {
      params: { customerNo: customerNo.value, marketer: config.MARKETER }
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
        //if (v != null) omipMap.set(k, Number(v) + Number(feeEnergy.value || 0))
        if (v != null) omipMap.set(k, Number(v))
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
const colorUsed = '#9333ea'  // Morado para puntos ya utilizados con estado "Aceptado"
const colorUsedOther = '#ff6b35'  // Naranja para puntos con click vigente pero estado diferente de "Aceptado"

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
      markerClick(event, ctx, cfg) { onTogglePoint(cfg) },
      legendClick(chartContext, seriesIndex, config) {
        const w = chartContext.w
        const collapsed = w.globals.collapsedSeriesIndices || []
        
        // Verificar si esta serie está actualmente visible
        const isVisible = !collapsed.includes(seriesIndex)
        
        // Contar cuántas series están visibles
        const visibleCount = series.value.length - collapsed.length
        
        console.log('Legend click:', { 
          seriesIndex, 
          seriesName: w.globals.seriesNames[seriesIndex],
          isVisible, 
          visibleCount, 
          collapsed,
          totalSeries: series.value.length
        })
        
        // Si intentamos ocultar la última serie visible, bloquear
        if (isVisible && visibleCount <= 1) {
          console.log('⚠️ No se puede ocultar la última serie visible')
          // Retornar sin hacer nada
          return
        }
        
        // Permitir toggle manualmente
        console.log('✅ Toggle permitido para serie:', w.globals.seriesNames[seriesIndex])
        chartContext.toggleSeries(w.globals.seriesNames[seriesIndex])
      }
    }
  },
  colors: [colorOmip, '#0d6efd', '#6c757d'],
  markers: { size: 6, hover: { size: 8 }, discrete: [] },
  stroke: { curve: 'straight' },
  dataLabels: { enabled: false },
  tooltip: { 
    shared: true, 
    intersect: false,
    custom: function({ series, seriesIndex, dataPointIndex, w }) {
      const monthKey = periodKeys.value[dataPointIndex]
      const contract = getContractForMonth(monthKey)
      
      // Obtener el label correcto (mes/año)
      const label = w.globals.categoryLabels?.[dataPointIndex] || w.globals.labels[dataPointIndex] || monthKey
      
      // Construir tooltip estándar
      let html = '<div class="apexcharts-tooltip-standard">'
      
      // Título con el mes
      html += `<div class="tooltip-title">${label}</div>`
      
      // Mostrar todas las series con sus valores
      for (let i = 0; i < series.length; i++) {
        const value = series[i][dataPointIndex]
        const colorDot = w.globals.colors[i]
        html += `<div class="tooltip-row">
          <span class="tooltip-series">
            <span class="tooltip-dot" style="background-color: ${colorDot};"></span>
            ${w.globals.seriesNames[i]}:
          </span>
          <span class="tooltip-value">${value != null ? value.toFixed(2) + ' €/MWh' : '-'}</span>
        </div>`
      }
      
      // Si hay contrato, agregar footer de advertencia
      if (contract) {
        const contractStatus = contract.status
        const blockingStates = ['Pendiente de aceptación', 'Aceptado', 'Sugerido']
        const isBlockingState = blockingStates.includes(contractStatus)
        const isLowPrice = lowFiveSet.has(monthKey)
        
        const message = isBlockingState 
          ? '⚠️ Este punto ya tiene un click vigente' 
          : '⚠️ Este punto ya tiene un Click'
        const statusInfo = ` | Estado: ${contractStatus || 'N/A'}`
        
        // Color del fondo según el estado (morado si bloqueante, naranja si no)
        const bgColor = isBlockingState 
          ? 'linear-gradient(135deg, #7c3aed, #9333ea)' 
          : 'linear-gradient(135deg, #ff6b35, #ff8c42)'
        const borderColor = isBlockingState ? '#a855f7' : '#ff9f6b'
        
        // Si también es uno de los 5 precios más bajos, agregar nota sobre el borde
        const borderNote = isLowPrice 
          ? `<br/><small>🟢 5 precios más bajos | Borde ${isBlockingState ? 'morado' : 'naranja'} = Click vigente</small>`
          : ''
        
        html += `<div class="tooltip-footer" style="background: ${bgColor}; border-top: 2px solid ${borderColor};">
          <strong>${message}</strong><br/>
          <small>CUPS: ${contract.cups} | Contrato: ${contract.contractNo}${statusInfo}</small>${borderNote}
        </div>`
      }
      
      html += '</div>'
      return html
    }
  },
  grid: { borderColor: '#e0e0e0' },
  xaxis: { categories: [] },
  yaxis: {
    title: { text: 'Precio (€/MWh)' },
    labels: {
      formatter: (val) => (val == null ? '' : Number(val).toFixed(2)) // ← 2 decimales en el eje
    }
  },
  legend: { 
    show: true, 
    position: 'top', 
    horizontalAlign: 'right', 
    offsetY: 8,
    onItemClick: {
      toggleDataSeries: false  // Deshabilitar toggle automático para controlarlo manualmente
    }
  }
})

// Función auxiliar para expandir cualquier periodo a sus meses componentes
function expandPeriodToMonths(periodKey) {
  // Si es mes (formato: "YYYY-MM")
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    return [periodKey]
  }
  
  // Si es trimestre (formato: "YYYY-Q1")
  if (/^\d{4}-Q[1-4]$/.test(periodKey)) {
    const [year, q] = periodKey.split('-')
    const qNum = Number(q.substring(1))
    const startMonth = (qNum - 1) * 3 + 1
    return [
      `${year}-${pad2(startMonth)}`,
      `${year}-${pad2(startMonth + 1)}`,
      `${year}-${pad2(startMonth + 2)}`
    ]
  }
  
  // Si es semestre (formato: "YYYY-S1")
  if (/^\d{4}-S[12]$/.test(periodKey)) {
    const [year, s] = periodKey.split('-')
    const startMonth = s === 'S1' ? 1 : 7
    return [
      `${year}-${pad2(startMonth)}`,
      `${year}-${pad2(startMonth + 1)}`,
      `${year}-${pad2(startMonth + 2)}`,
      `${year}-${pad2(startMonth + 3)}`,
      `${year}-${pad2(startMonth + 4)}`,
      `${year}-${pad2(startMonth + 5)}`
    ]
  }
  
  // Si es año (formato: "YYYY")
  if (/^\d{4}$/.test(periodKey)) {
    const year = periodKey
    return Array.from({ length: 12 }, (_, i) => `${year}-${pad2(i + 1)}`)
  }
  
  return []
}

// Función para verificar si un periodo está ocupado por algún contrato
function isMonthUsed(periodKey) {
  // Expandir el periodo a todos sus meses
  const months = expandPeriodToMonths(periodKey)
  
  // Si no hay meses o no hay contratos, no está ocupado
  if (months.length === 0 || multiclickRows.value.length === 0) return false
  
  console.log(`🔍 Verificando periodo: ${periodKey}`)
  console.log(`📅 Meses expandidos:`, months)
  console.log(`📋 Contratos disponibles:`, multiclickRows.value.length)
  
  // Verificar si ALGUNO de los meses está ocupado
  for (const monthKey of months) {
    const [year, month] = monthKey.split('-').map(Number)
    if (!year || !month) continue
    
    // Crear fecha al inicio del mes (día 1)
    const checkDate = new Date(year, month - 1, 1)
    checkDate.setHours(0, 0, 0, 0)
    
    // Verificar si este mes está dentro del rango de algún contrato
    for (const contract of multiclickRows.value) {
      if (!contract.startDate || !contract.endDate) continue
      
      // Parsear fechas del contrato y normalizar a inicio de mes
      const startDate = new Date(contract.startDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(contract.endDate)
      endDate.setHours(23, 59, 59, 999)
      
      console.log(`  ⏰ Comparando ${monthKey} con contrato ${contract.contractNo}:`, {
        check: checkDate.toISOString().split('T')[0],
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        overlaps: checkDate >= startDate && checkDate <= endDate
      })
      
      // Verificar si checkDate está dentro del rango del contrato
      if (checkDate >= startDate && checkDate <= endDate) {
        console.log(`  ✅ OCUPADO por contrato: ${contract.contractNo}`)
        return true
      }
    }
  }
  
  console.log(`  ❌ No ocupado`)
  return false
}

// Función para obtener el contrato de un periodo específico
function getContractForMonth(periodKey) {
  // Expandir el periodo a todos sus meses
  const months = expandPeriodToMonths(periodKey)
  
  // Si no hay meses o no hay contratos, retornar null
  if (months.length === 0 || multiclickRows.value.length === 0) return null
  
  // Buscar el contrato en el primer mes ocupado
  for (const monthKey of months) {
    const [year, month] = monthKey.split('-').map(Number)
    if (!year || !month) continue
    
    // Crear fecha al inicio del mes (día 1)
    const checkDate = new Date(year, month - 1, 1)
    checkDate.setHours(0, 0, 0, 0)
    
    // Buscar el contrato que incluye este mes
    for (const contract of multiclickRows.value) {
      if (!contract.startDate || !contract.endDate) continue
      
      // Parsear fechas del contrato y normalizar
      const startDate = new Date(contract.startDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(contract.endDate)
      endDate.setHours(23, 59, 59, 999)
      
      // Verificar si checkDate está dentro del rango del contrato
      if (checkDate >= startDate && checkDate <= endDate) {
        return contract
      }
    }
  }
  
  return null
}

function buildDiscreteMarkers(keys) {
  const disc = []
  keys.forEach((k, idx) => {
    // Prioridad: Seleccionado > Verde con borde de contrato > Verde normal > Usado solo
    if (selectedSet.has(k)) {
      disc.push({ seriesIndex: 0, dataPointIndex: idx, fillColor: colorSelected, strokeColor: colorSelected, size: 8 })
    } else if (lowFiveSet.has(k)) {
      // Punto verde: verificar si también hay contrato
      if (isMonthUsed(k)) {
        // Hay punto verde Y contrato: punto más pequeño con borde más grueso
        const contract = getContractForMonth(k)
        const contractStatus = contract?.status
        const blockingStates = ['Pendiente de aceptación', 'Aceptado', 'Sugerido']
        const isBlockingState = blockingStates.includes(contractStatus)
        
        // Usar color morado si es bloqueante, naranja si no
        const borderColor = isBlockingState ? colorUsed : colorUsedOther
        disc.push({ 
          seriesIndex: 0, 
          dataPointIndex: idx, 
          fillColor: colorLow, 
          strokeColor: borderColor, 
          strokeWidth: 5,
          size: 7 
        })
      } else {
        // Solo punto verde: borde blanco
        disc.push({ 
          seriesIndex: 0, 
          dataPointIndex: idx, 
          fillColor: colorLow, 
          strokeColor: '#ffffff', 
          strokeWidth: 3,
          size: 10 
        })
      }
    } else if (isMonthUsed(k)) {
      // Solo punto usado (sin verde)
      const contract = getContractForMonth(k)
      const contractStatus = contract?.status
      const blockingStates = ['Pendiente de aceptación', 'Aceptado', 'Sugerido']
      const isBlockingState = blockingStates.includes(contractStatus)
      
      // Usar color morado si es bloqueante, naranja si no
      const colorToUse = isBlockingState ? colorUsed : colorUsedOther
      disc.push({ seriesIndex: 0, dataPointIndex: idx, fillColor: colorToUse, strokeColor: colorToUse, size: 8 })
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
  // Solo verificar que haya contrato, permitir cualquier granularidad
  if (!hasLastIndex.value) return
  if (cfg.seriesIndex !== 0) return

  const idx = cfg.dataPointIndex
  const k = periodKeys.value[idx]
  
  // Permitir seleccionar cualquier punto (la validación se hace en el modal)
  
  if (selectedSet.has(k)) {
    // Si ya está seleccionado, deseleccionarlo
    selectedSet.delete(k)
    // Actualizar marcadores
    chartOptions.value = {
      ...chartOptions.value,
      markers: { size: 6, hover: { size: 8 }, discrete: buildDiscreteMarkers(periodKeys.value) }
    }
  } else {
    // Si ya hay puntos seleccionados, limpiar todo primero
    if (selectedSet.size >= MAX_POINTS) {
      selectedSet.clear()
    }
    // Agregar el nuevo punto
    selectedSet.add(k)
    
    // Actualizar marcadores
    chartOptions.value = {
      ...chartOptions.value,
      markers: { size: 6, hover: { size: 8 }, discrete: buildDiscreteMarkers(periodKeys.value) }
    }
    
    // Abrir el modal automáticamente
    openModal()
  }
  
  btnDisabled.value = selectedSet.size === 0 || !Array.from(selectedSet).some(x => periodKeys.value.includes(x))
}

function setGran(g) {
  gran.value = g
  // Limpiar selección al cambiar de granularidad
  selectedSet.clear()
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

    return { 
      key: k, 
      label, 
      value,
      granularity: gran.value  // Pasar la granularidad del click
    }
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
      showToast(`Orden de compra creada con éxito Nº ${res.data.contractNo}`, 'success')
      showModal.value = false
      // Limpiar selección
      selectedSet.clear()
      modalPoints.value = []
      // Recargar la lista de contratos
      await loadMultiClickContracts()
    } else {
      showToast(`Error: ${res.data.error || 'Error desconocido'}`, 'error')
    }
  } catch (e) {
    showToast(e?.response?.data?.error || 'Ocurrió un error inesperado', 'error')
  }
}

/* ===================== Cargar MultiClick Contracts ===================== */
async function loadMultiClickContracts() {
  multiclickError.value = ''
  multiclickRows.value = []
  if (!customerNo.value) { multiclickError.value = 'Falta CustomerNo en sesión.'; return }

  multiclickLoading.value = true
  try {
    const { data } = await api.get('/v1/MultiClick/GetMultiClickEnergyContract', {
      params: {
        customerNo: customerNo.value,
        pageNumber: 1,
        pageSize: 50
      }
    })

    const items = Array.isArray(data) ? data
      : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.result) ? data.result
          : []
    multiclickRows.value = items.map(x => ({
      contractNo: x.contractNo ?? x.ContractNo,
      customerNo: x.customerNo ?? x.CustomerNo,
      refApplicationOperNo: x.refApplicationOperNo ?? x.RefApplicationOperNo,
      cups: x.cups ?? x.Cups,
      multiClickDocumentType: x.multiClickDocumentType ?? x.MultiClickDocumentType,
      multiClickDocumentNo: x.multiClickDocumentNo ?? x.MultiClickDocumentNo,
      status: x.status ?? x.Status,
      rateNo: x.rateNo ?? x.RateNo,
      feeEnergy: Number(x.feeEnergy ?? x.FeeEnergy),
      selectedPrice: Number(x.selectedPrice ?? x.SelectedPrice),
      duration: x.duration ?? x.Duration,
      startDate: x.startDate ?? x.StartDate,
      endDate: x.endDate ?? x.EndDate,
      dateTimeCreated: x.dateTimeCreated ?? x.DateTimeCreated,
      p1: Number(x.p1 ?? x.P1),
      p2: Number(x.p2 ?? x.P2),
      p3: Number(x.p3 ?? x.P3),
      p4: Number(x.p4 ?? x.P4),
      p5: Number(x.p5 ?? x.P5),
      p6: Number(x.p6 ?? x.P6),
    }))
    
    // Actualizar el gráfico para mostrar los puntos utilizados
    rebuildChart()
  } catch (e) {
    multiclickError.value = e?.response?.data || e?.message || 'No se pudo cargar la lista.'
  } finally {
    multiclickLoading.value = false
  }
}

/* ===================== Helpers ===================== */
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES')
}

function fmtNum(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function isSugerido(s) { 
  return String(s || '').trim().toLowerCase() === 'sugerido' 
}

/* ===================== PDF Modal ===================== */
function getRowPdfId(row) {
  return row?.multiClickDocumentNo ?? row?.MultiClickDocumentNo ?? ''
}

function revokePdfUrl() {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
}

function base64ToBlobUrl(base64, mime = 'application/pdf') {
  const binStr = atob(base64)
  const len = binStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  return URL.createObjectURL(blob)
}

async function fetchPdfBase64ById(id) {
  const url = `/v1/ProposalCliente/ProposalPdf/${encodeURIComponent(id)}/false`
  const { data } = await api.get(url, { responseType: 'text' })
  let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
  if (!base64) throw new Error('PDF vacío')
  if (base64.startsWith('"')) {
    try { base64 = JSON.parse(base64) } catch { }
  }
  return base64
}

async function openPdfModal(row) {
  if (pdfLoading.value) return
  const id = getRowPdfId(row)
  if (!id) { showToast('No hay identificador de PDF para esta fila.', 'error'); return }

  pdfLoading.value = true
  pdfError.value = ''
  currentPdfId.value = id
  revokePdfUrl()

  try {
    const base64 = await fetchPdfBase64ById(id)
    pdfUrl.value = base64ToBlobUrl(base64)
    showPdf.value = true
    requestAnimationFrame(() => {
      const el = document.querySelector('.pdf-modal')
      if (el && typeof el.focus === 'function') el.focus()
    })
  } catch (e) {
    pdfError.value = e?.response?.data?.message || e?.message || 'No se pudo cargar el PDF'
    showPdf.value = true
  } finally {
    pdfLoading.value = false
  }
}

function closePdf() {
  showPdf.value = false
  currentPdfId.value = null
  pdfError.value = ''
  revokePdfUrl()
}

function downloadFromModal() {
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `${currentPdfId.value || 'documento'}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
}

/* ===================== Aprobar MultiClick ===================== */
async function approve(row) {
  if (!isSugerido(row.status)) return
  const key = `${row.customerNo}|${row.contractNo}|${row.cups}`
  if (approving.has(key)) return
  approving.add(key)
  try {
    await api.get('/v1/MultiClick/UpdateMultiClickEnergyContractAsync', {
      params: {
        multiclickDocumentType: row.multiClickDocumentType,
        customerNo: row.customerNo,
        contractNo: row.contractNo,
        cups: row.cups
      }
    })
    showToast('MultiClick aprobado correctamente.', 'success')
    await loadMultiClickContracts()
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo aprobar el MultiClick', 'error')
  } finally {
    approving.delete(key)
  }
}

onMounted(async () => {
  await loadLastContractIndex()
  await loadData()
  await loadMultiClickContracts()
})
</script>

<template>
  <DashboardLayout>
    <div class="header-controls mb-3">
      <h1 class="h4 mb-0">MultiClick · Gráfico</h1>

      <div class="controls-group">
        <div class="control-item">
          <span class="control-label"></span>
          <div class="btn-group">
            <button class="btn btn-outline-secondary" :class="{ active: gran === 'M' }" @click="setGran('M')">Mes</button>
            <button class="btn btn-outline-secondary" :class="{ active: gran === 'Q' }"
              @click="setGran('Q')">Trimestre</button>
            <button class="btn btn-outline-secondary" :class="{ active: gran === 'S' }"
              @click="setGran('S')">Semestre</button>
            <button class="btn btn-outline-secondary" :class="{ active: gran === 'Y' }" @click="setGran('Y')">Año</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <div>
          <h5 class="card-title mb-0">MultiClick</h5>
          <small class="text-muted">Selecciona 1 punto de "OMIP Base".</small>
        </div>
      </div>
      <div class="card-body">
        <apexchart ref="chartRef" type="line" height="400" :options="chartOptions" :series="series" />
        
        <!-- Leyenda de colores -->
        <div class="chart-legend mt-3 d-flex justify-content-between align-items-center">
          <div class="legend-items d-flex flex-wrap gap-3">
            <div class="legend-item">
              <span class="legend-dot" style="background-color: #dc3545;"></span>
              <span class="legend-text">Seleccionado</span>
            </div>
          <div class="legend-item">
            <span class="legend-dot" style="background-color: #9333ea;"></span>
            <span class="legend-text">Click Aceptado</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot" style="background-color: #ff6b35;"></span>
            <span class="legend-text">Click Pendientes</span>
          </div>
            <div class="legend-item">
              <span class="legend-dot" style="background-color: #198754;"></span>
              <span class="legend-text">5 precios más bajos</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="background-color: #ff9f43;"></span>
              <span class="legend-text">Disponible</span>
            </div>
          </div>
          <span class="badge text-dark ms-3">Datos orientativos de mercado</span>
        </div>
      </div>
    </div>

    <!-- MultiClick Contracts -->
    <section class="card mt-3">
        <div class="card-head">
          <h2 class="card-title">Listado de Multiclick</h2>
        </div>
        <div v-if="multiclickLoading" class="card-body center muted">Cargando…</div>
        <div v-else-if="multiclickError" class="card-body text-danger">{{ multiclickError }}</div>

        <div v-else class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>CUPS</th>
                <th>No. referencia operación</th>
                <th>Tarifa</th>
                
                <th>Fee</th>
                <th>Duración</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th class="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in multiclickRows" :key="r.contractNo + '|' + r.cups">
                <td class="mono">
                  {{ r.contractNo }}
                  <small class="muted d-block">{{ r.multiClickDocumentType }} · {{ r.multiClickDocumentNo }}</small>
                </td>
                <td class="mono">{{ r.cups }}</td>
                <td class="mono">{{ r.refApplicationOperNo }}</td>
                <td>{{ r.rateNo }}</td>
                
                <td class="mono">{{ fmtNum(r.feeEnergy) }}</td>
                <td>{{ r.duration }}</td>
                <td>{{ fmtDate(r.startDate) }}</td>
                <td>{{ fmtDate(r.endDate) }}</td>
                <td>
                  <span class="pill" :class="{ 'pill-sug': isSugerido(r.status) }">{{ r.status }}</span>
                </td>
                <td class="text-end">
                  <div class="actions actions--end">
                    <!-- Ver PDF en modal -->
                    <button class="icon-btn" title="Ver PDF" @click="openPdfModal(r)">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor"
                          stroke-width="2" fill="none" />
                        <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" fill="none" />
                      </svg>
                    </button>

                    <button class="btn-ghost btn-ghost-custom" 
                      :disabled="!isSugerido(r.status) || approving.has(`${r.customerNo}|${r.contractNo}|${r.cups}`)"
                      @click="approve(r)"
                      :title="isSugerido(r.status) ? 'Aprobar' : 'Solo disponible si el estado es Sugerido'">
                      {{ approving.has(`${r.customerNo}|${r.contractNo}|${r.cups}`) ? 'Enviando…' : 'Aprobar' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!multiclickLoading && multiclickRows.length === 0">
                <td colspan="11" class="empty">No hay resultados.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    <MultiClickModal :show="showModal" :points="modalPoints" :customer-no="customerNo" :prefilled-cups="prefilledCups"
      :default-period-type="periodTarget" :omip-data="omipMap" :multiclick-contracts="multiclickRows" 
      :fee-energy="feeEnergy"
      @remove="onRemovePoint" @submit="onSubmitModal" @close="showModal = false" />

    <!-- MODAL PDF -->
    <Teleport to="body">
      <div v-if="showPdf" class="pdf-modal" @keydown.esc="closePdf" tabindex="0">
        <div class="pdf-toolbar">
          <div class="left">
            <strong class="mono">PDF · {{ currentPdfId || '—' }}</strong>
          </div>
          <div class="right">
            <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener" class="btn-ghost">Abrir en pestaña</a>
            <button class="btn-ghost" @click="downloadFromModal" :disabled="!pdfUrl">Descargar</button>
            <button class="btn btn-close-pdf" @click="closePdf">Cerrar ✕</button>
          </div>
        </div>
        <div class="pdf-body">
          <div v-if="pdfLoading" class="pdf-center muted">Cargando PDF…</div>
          <div v-else-if="pdfError" class="pdf-center text-danger">{{ pdfError }}</div>
          <iframe v-else class="pdf-frame" :src="pdfUrl" title="Documento PDF"></iframe>
        </div>
      </div>
    </Teleport>

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
/* ===================== Header Controls ===================== */
.header-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

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

/* ===================== Estilos para tabla de propuestas ===================== */
.card-head {
  padding: .75rem 1rem;
  border-bottom: 1px solid #eef2f7;
}
.card-title {
  margin: 0;
  font-size: 1.05rem;
}
.card-body {
  padding: 1rem;
}
.center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
}
.muted {
  color: #6b7280;
}
.text-danger {
  color: #ef4444;
}
.table-scroll {
  overflow: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: .95rem;
}
.table th,
.table td {
  padding: .6rem .7rem;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap;
}
.table thead th {
  background: #f8fafc;
  position: sticky;
  top: 0;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}
.small {
  font-size: .85rem;
}
.tag {
  font-size: .75rem;
  padding: .15rem .35rem;
  border: 1px solid #e5e7eb;
  border-radius: .4rem;
  background: #f8fafc;
}
.ms {
  margin-left: .35rem;
}
.pill {
  display: inline-block;
  padding: .15rem .45rem;
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  font-size: .75rem;
  background: #f8fafc;
}
.pill-status {
  background: #eef2ff;
  border-color: #c7d2fe;
}
.empty {
  padding: 1rem;
  text-align: center;
  color: #6b7280;
}
.actions {
  display: flex;
  gap: .35rem;
  align-items: center;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: .5rem;
  background: #fff;
  cursor: pointer;
}
.icon-btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.icon-btn:hover:not(:disabled) {
  background: #f8fafc;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.d-block {
  display: block;
}
.actions--end {
  justify-content: flex-end;
}
.btn-ghost-custom {
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 .75rem;
  line-height: 1;
  cursor: pointer;
  height: 36px;
}
.btn-ghost-custom:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.btn-ghost-custom:hover:not(:disabled) {
  background: #f8fafc;
}
.pill-sug {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3;
}

/* ===================== PDF Modal ===================== */
.pdf-modal {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: grid;
  grid-template-rows: auto 1fr;
  background: rgba(17, 24, 39, .92);
  backdrop-filter: blur(2px);
  outline: none;
}
.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .5rem .75rem;
  color: #fff;
  background: #111827;
  border-bottom: 1px solid #1f2937;
}
.pdf-toolbar .left {
  display: flex;
  align-items: center;
}
.pdf-toolbar .right {
  display: flex;
  gap: .5rem;
  align-items: center;
}
.pdf-body {
  position: relative;
}
.pdf-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #111827;
}
.pdf-center {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .95rem;
}
.btn-ghost {
  background: transparent;
  border: 1px solid transparent;
  color: #e5e7eb;
  cursor: pointer;
  padding: .45rem .75rem;
  border-radius: .5rem;
}
.btn-ghost:hover {
  border-color: #374151;
}
.btn-close-pdf {
  padding: .45rem .75rem;
  border: 1px solid #d1d5db;
  border-radius: .5rem;
  background: #f9fafb;
  cursor: pointer;
  color: #111827;
}
.btn-close-pdf:hover {
  background: #111827;
  color: #fff;
}

/* ===================== Leyenda del gráfico ===================== */
.chart-legend {
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.legend-items {
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.legend-text {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

</style>

<style>
/* Estilos globales para tooltip personalizado de ApexCharts */
.apexcharts-tooltip-standard {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: 0;
  min-width: 220px;
  font-family: inherit;
}

.apexcharts-tooltip-standard .tooltip-title {
  background: #f8fafc;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 0.875rem;
  color: #111827;
}

.apexcharts-tooltip-standard .tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.875rem;
}

.apexcharts-tooltip-standard .tooltip-row:last-of-type {
  border-bottom: none;
}

.apexcharts-tooltip-standard .tooltip-series {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
}

.apexcharts-tooltip-standard .tooltip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.apexcharts-tooltip-standard .tooltip-value {
  font-weight: 600;
  color: #111827;
}

.apexcharts-tooltip-standard .tooltip-footer {
  background: linear-gradient(135deg, #7c3aed, #9333ea);
  color: #ffffff;
  padding: 0.6rem 0.75rem;
  border-top: 2px solid #a855f7;
  font-size: 0.8rem;
  line-height: 1.4;
}

.apexcharts-tooltip-standard .tooltip-footer strong {
  font-weight: 600;
  display: block;
  margin-bottom: 0.25rem;
}

.apexcharts-tooltip-standard .tooltip-footer small {
  opacity: 0.9;
  font-size: 0.75rem;
}
</style>

