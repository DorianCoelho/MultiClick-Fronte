<script setup>
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import api from '@/services/api'
import config from '@/config/env'
import { useAuthStore } from '@/stores/auth'

const isSubmitting = ref(false)

const props = defineProps({
  show: { type: Boolean, default: false },
  points: { type: Array, default: () => [] },
  customerNo: { type: [String, Number], default: '' },
  prefilledCups: { type: String, default: '' },
  defaultPeriodType: { type: String, default: 'Q' },
  omipData: { type: Map, default: () => new Map() },  // Datos OMIP del gráfico
  multiclickContracts: { type: Array, default: () => [] },  // Contratos MultiClick existentes
  feeEnergy: { type: Number, default: 0 }  // Fee energy del contrato
})
const emit = defineEmits(['close', 'submit', 'remove'])

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

// Mapa para relacionar CUPS con su contrato
const cupsToContractMap = ref(new Map())

// Nuevos campos para mes inicio/fin
const startMonth = ref('')
const endMonth = ref('')

// Estado para error de solapamiento
const overlapError = ref('')
const hasOverlap = ref(false)

// Estado para modal simple de CUPS no disponible
const showSimpleModal = ref(false)
const multicupsEnabled = ref(true)  // Indica si el contrato permite multicups
const modalReady = ref(false)  // Controla si el modal está listo para mostrarse

// Estado del wizard (2 pasos)
const currentStep = ref(1)

// Campo Coverage
const auth = useAuthStore()
const coverage = ref('')

// Computed para obtener el nombre completo del marketer
const marketerFullName = computed(() => {
  const marketer = config.MARKETER || localStorage.getItem('marketer') || ''
  if (marketer.toUpperCase() === 'NAB') {
    return 'NABALIA ENERGIA 2000, S.A.'
  } else if (marketer.toUpperCase() === 'ACIS') {
    return 'ACIS ENERGÍA, S.A.'
  }
  return marketer
})


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

// Helpers para fechas
function parseMonthKey(key) {
  // key formato: "YYYY-MM" o "jun 2027"
  const match = key.match(/(\d{4})-(\d{2})/)
  if (match) {
    return { year: parseInt(match[1]), month: parseInt(match[2]) }
  }
  // Intentar parsear formato "jun 2027"
  const months = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 }
  const parts = key.toLowerCase().split(' ')
  if (parts.length === 2 && months[parts[0]]) {
    return { year: parseInt(parts[1]), month: months[parts[0]] }
  }
  return null
}

function formatMonthLabel(year, month) {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${months[month - 1]} ${year}`
}

function addMonths(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function getMonthValue(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

// Helper para obtener el mes de inicio según la granularidad del click
function getStartMonthFromKey(key, granularity) {
  // Si es mes, retornar directamente
  if (granularity === 'M' && /^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-').map(Number)
    return { year, month }
  }
  
  // Si es trimestre (formato: "2027-Q1")
  if (granularity === 'Q' && /^\d{4}-Q[1-4]$/.test(key)) {
    const [year, q] = key.split('-')
    const qNum = Number(q.substring(1))
    const month = (qNum - 1) * 3 + 1  // Q1=1, Q2=4, Q3=7, Q4=10
    return { year: Number(year), month }
  }
  
  // Si es semestre (formato: "2027-S1")
  if (granularity === 'S' && /^\d{4}-S[12]$/.test(key)) {
    const [year, s] = key.split('-')
    const month = s === 'S1' ? 1 : 7  // S1=enero, S2=julio
    return { year: Number(year), month }
  }
  
  // Si es año (formato: "2027")
  if (granularity === 'Y' && /^\d{4}$/.test(key)) {
    return { year: Number(key), month: 1 }  // Enero
  }
  
  // Fallback: intentar parsear como mes
  return parseMonthKey(key)
}

// Computed: opciones de meses disponibles según duración
const startMonthOptions = computed(() => {
  if (!props.points || props.points.length === 0) return []
  
  // Obtener el primer punto seleccionado
  const firstPoint = props.points[0]
  const granularity = firstPoint.granularity || 'M'
  
  // Obtener el mes de inicio según la granularidad
  const startInfo = getStartMonthFromKey(firstPoint.key, granularity)
  if (!startInfo) return []
  
  const { year, month } = startInfo
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  const options = []
  for (let i = 0; i < duration; i++) {
    const { year: y, month: m } = addMonths(year, month, i)
    options.push({
      value: getMonthValue(y, m),
      label: formatMonthLabel(y, m)
    })
  }
  
  return options
})

// Computed: calcular mes final basado en mes inicio y duración
const calculatedEndMonth = computed(() => {
  if (!startMonth.value) return ''
  
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return ''
  
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  // Mes final = mes inicio + duración - 1
  const { year: endYear, month: endMonth } = addMonths(year, month, duration - 1)
  return formatMonthLabel(endYear, endMonth)
})

// Computed: obtener fecha de inicio formateada
const startDateFormatted = computed(() => {
  if (!startMonth.value) return ''
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return ''
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  return formatMonthLabel(year, month)
})

// Computed: obtener fecha de fin formateada
const endDateFormatted = computed(() => {
  return calculatedEndMonth.value
})

// Computed: generar periodos de duración del click (meses)
const clickPeriods = computed(() => {
  if (!startMonth.value) return []
  
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return []
  
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  const periods = []
  for (let i = 0; i < duration; i++) {
    const { year: y, month: m } = addMonths(year, month, i)
    periods.push({
      key: getMonthValue(y, m),
      label: formatMonthLabel(y, m),
      cmm: 0  // Consumo media mensual - se inicializa en 0
    })
  }
  
  return periods
})

// Estado para almacenar CMM de cada periodo
const periodCmm = ref({})  // { "2027-01": 100, "2027-02": 150, ... }
const loadingCmm = ref(false)  // Estado de carga de CMM

// Computed: calcular volumen total de energía declarada (CMM con cobertura aplicada)
const totalVolume = computed(() => {
  return clickPeriods.value.reduce((sum, period) => {
    const cmmWithCoverage = getCmmWithCoverage(period.key)
    return sum + cmmWithCoverage
  }, 0)
})

// Computed: calcular volumen total sin cobertura (para referencia)
const totalVolumeWithoutCoverage = computed(() => {
  return Object.values(periodCmm.value).reduce((sum, val) => {
    const num = Number(val) || 0
    return sum + num
  }, 0)
})

// Función para actualizar CMM de un periodo
function updatePeriodCmm(periodKey, value) {
  const numValue = Number(value) || 0
  // Crear nuevo objeto para forzar reactividad
  periodCmm.value = {
    ...periodCmm.value,
    [periodKey]: numValue
  }
  console.log(`CMM actualizado para ${periodKey}: ${numValue}`)
}

// Función para obtener CMM de un periodo
function getPeriodCmm(periodKey) {
  const value = periodCmm.value[periodKey] || 0
  return value
}

// Función para calcular CMM con cobertura aplicada
function getCmmWithCoverage(periodKey) {
  const cmm = periodCmm.value[periodKey] || 0
  const coverageNum = parseNumLike(coverage.value) || 0
  // Calcular: CMM * (Cobertura / 100)
  const result = cmm * (coverageNum / 100)
  return Math.round(result) // Redondear a entero sin decimales
}

// Función para calcular fecha de inicio en formato YYYY-MM-DD
function getStartDateFormatted() {
  if (!startMonth.value) return null
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return null
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  // Primer día del mes
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// Función para calcular fecha de fin en formato YYYY-MM-DD
function getEndDateFormatted() {
  if (!startMonth.value) return null
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return null
  
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  // Calcular mes final
  const { year: endYear, month: endMonth } = addMonths(year, month, duration - 1)
  
  // Último día del mes final
  const lastDay = new Date(endYear, endMonth, 0).getDate()
  return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

// Función para cargar CMM desde el API
async function loadMonthlyConsumption() {
  if (!cups.value || !startMonth.value) {
    // Limpiar CMM si no hay datos
    periodCmm.value = {}
    return
  }
  
  loadingCmm.value = true
  
  try {
    const startDate = getStartDateFormatted()
    const endDate = getEndDateFormatted()
    
    if (!startDate || !endDate) {
      console.warn('No se pudieron calcular las fechas')
      return
    }
    
    const { data } = await api.post('/v1/SipsDailyReading/MonthlyConsumption', {
      cups: cups.value,
      startDate: startDate,
      endDate: endDate,
      page: 1,
      size: 3000
    })
    
    // Normalizar respuesta (puede venir como array o dentro de un objeto)
    const items = Array.isArray(data) ? data : (data?.items || data?.result || [])
    
    console.log('Respuesta API MonthlyConsumption:', items)
    
    // Crear mapa de consumo por mes (ignorando el año, ya que usamos datos históricos)
    const consumptionByMonth = {}
    
    // Primero, crear un mapa de consumo por mes desde los datos históricos
    items.forEach(item => {
      const month = item.month ?? item.Month ?? null
      const cmm = item.cmm ?? item.Cmm ?? 0
      
      if (month != null) {
        // Guardar el consumo por número de mes (1-12)
        const monthKey = String(month).padStart(2, '0')
        consumptionByMonth[monthKey] = Number(cmm) || 0
        console.log(`CMM histórico para mes ${monthKey} (${item.monthName}): ${cmm}`)
      }
    })
    
    // Crear nuevo objeto para almacenar CMM mapeado a los períodos del click
    const newPeriodCmm = {}
    
    // Mapear el consumo histórico a los períodos del click
    clickPeriods.value.forEach(period => {
      // Extraer el mes del período del click (ej: "2028-01" -> "01")
      const monthPart = period.key.split('-')[1]
      
      // Asignar el consumo histórico de ese mes al período del click
      if (consumptionByMonth[monthPart] !== undefined) {
        newPeriodCmm[period.key] = consumptionByMonth[monthPart]
        console.log(`Asignando CMM ${consumptionByMonth[monthPart]} al período ${period.key} (${period.label})`)
      } else {
        newPeriodCmm[period.key] = 0
        console.warn(`No hay datos de CMM para el mes ${monthPart} en el período ${period.key}`)
      }
    })
    
    // Asignar el nuevo objeto completo para forzar reactividad
    periodCmm.value = newPeriodCmm
    
    console.log('CMM final asignado a períodos del click:', periodCmm.value)
  } catch (e) {
    console.error('Error cargando consumo mensual:', e)
    // No mostrar error al usuario, solo limpiar
    periodCmm.value = {}
  } finally {
    loadingCmm.value = false
  }
}

// Watch para actualizar endMonth cuando cambie startMonth o periodType
watch([startMonth, periodType], () => {
  endMonth.value = calculatedEndMonth.value
})

// Computed: calcular el precio promedio basado en mes inicio y duración
const calculatedAveragePrice = computed(() => {
  if (!startMonth.value) {
    console.log('No hay startMonth')
    return null
  }
  
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) {
    console.log('No match en startMonth:', startMonth.value)
    return null
  }
  
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  console.log('Calculando precio promedio:', { startMonth: startMonth.value, year, month, duration, omipDataSize: props.omipData?.size })
  
  // Obtener los valores de OMIP para los meses de la duración
  const values = []
  const monthsUsed = []
  for (let i = 0; i < duration; i++) {
    const { year: y, month: m } = addMonths(year, month, i)
    const key = getMonthValue(y, m)
    const value = props.omipData?.get(key)
    monthsUsed.push({ key, value })
    if (value != null && !isNaN(value)) {
      values.push(Number(value))
    }
  }
  
  console.log('Meses y valores:', monthsUsed)
  console.log('Valores válidos:', values)
  
  // Calcular promedio
  if (values.length === 0) {
    console.log('No hay valores válidos')
    return null
  }
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  console.log('Promedio calculado:', avg)
  return Number(avg.toFixed(2))
})

// Watch para actualizar fixedPrice cuando cambie el mes de inicio o la duración
watch([startMonth, periodType], () => {
  console.log('Watch disparado - startMonth:', startMonth.value, 'periodType:', periodType.value)
  const avgPrice = calculatedAveragePrice.value
  console.log('Precio promedio calculado:', avgPrice)
  if (avgPrice != null) {
    fixedPrice.value = String(avgPrice)
    console.log('fixedPrice actualizado a:', fixedPrice.value)
  }
}, { immediate: false })

// Helper para formatear fecha en español
function formatDateES(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Función para validar solapamiento de fechas
function checkDateOverlap(cupsToCheck) {
  if (!cupsToCheck || !startMonth.value) return null
  
  // Parsear fecha de inicio
  const match = startMonth.value.match(/(\d{4})-(\d{2})/)
  if (!match) return null
  
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  const duration = periodType.value === 'Q' ? 3 : periodType.value === 'S' ? 6 : 12
  
  // Calcular fecha final
  const { year: endYear, month: endMonth } = addMonths(year, month, duration - 1)
  
  const newStart = new Date(year, month - 1, 1)
  const newEnd = new Date(endYear, endMonth - 1, 1)
  
  console.log('Validando solapamiento para CUPS:', cupsToCheck)
  console.log('Rango nuevo:', { start: newStart, end: newEnd })
  
  // Buscar contratos del mismo CUPS
  const existingContracts = props.multiclickContracts.filter(c => c.cups === cupsToCheck)
  console.log('Contratos existentes para este CUPS:', existingContracts)
  
  for (const contract of existingContracts) {
    if (!contract.startDate || !contract.endDate) continue
    
    const contractStart = new Date(contract.startDate)
    const contractEnd = new Date(contract.endDate)
    
    console.log('Comparando con contrato:', { 
      contractNo: contract.contractNo,
      status: contract.status,
      start: contractStart, 
      end: contractEnd 
    })
    
    // Verificar solapamiento
    // Hay solapamiento si: (newStart <= contractEnd) && (newEnd >= contractStart)
    if (newStart <= contractEnd && newEnd >= contractStart) {
      console.log('¡Solapamiento detectado!')
      
      // Estados que bloquean la creación de click
      const blockingStates = ['Pendiente de aceptación', 'Aceptado', 'Sugerido']
      const isBlockingState = blockingStates.includes(contract.status)
      
      return {
        overlaps: isBlockingState,  // Bloquear si el estado es bloqueante
        contract: contract,
        message: `Ya existe un Click con este CUPS en las fechas seleccionadas (Contrato: ${contract.contractNo})`,
        detailedMessage: `El CUPS ya está siendo utilizado en el contrato ${contract.contractNo} durante el periodo ${formatDateES(contract.startDate)} a ${formatDateES(contract.endDate)}`,
        isAccepted: isBlockingState
      }
    }
  }
  
  console.log('No hay solapamiento')
  return { overlaps: false }
}

const canSubmit = computed(() => {
  formError.value = ''
  
  // Si hay solapamiento, bloquear el envío
  if (hasOverlap.value) {
    return false
  }
  
  if (!props.customerNo) { formError.value = 'Falta el CustomerId.'; return false }
  if (!cups.value) { formError.value = 'Selecciona un CUPS.'; return false }
  if (!['Q', 'S', 'Y'].includes(periodType.value)) { formError.value = 'Selecciona un período cubierto.'; return false }

  const price = parseNumLike(fixedPrice.value)
  if (price == null || price <= 0) { formError.value = 'Indica un precio válido.'; return false }
  if (!props.points.length) { formError.value = 'No hay puntos seleccionados.'; return false }
  
  // Validar Coverage (debe estar entre 1 y 100)
  const coverageNum = parseNumLike(coverage.value)
  if (coverageNum == null || coverageNum < 1 || coverageNum > 100) { formError.value = 'Indica un % de entre 1 y 100 en números enteros.'; return false }
  
  return true
})

/* ========= NUEVO: cargar CUPS desde LastsContractIndex ========= */
async function loadCups() {
  cupsOptions.value = []
  cupsToContractMap.value.clear()
  loadError.value = ''
  if (!props.customerNo) {
    loadError.value = 'No hay CustomerId en sesión.'
    return
  }
  loadingCups.value = true
  try {
    const { data } = await api.get('/v1/ContractCliente/LastsContractIndex', {
      params: { customerNo: String(props.customerNo), marketer: config.MARKETER }
    })

    // Ahora data es una lista de contratos
    if (!data || !Array.isArray(data) || data.length === 0) {
      loadError.value = 'El cliente no tiene contratos Index activos.'
      cups.value = ''
      return
    }

    // Procesar cada contrato de la lista
    const cupsArray = []
    let hasMulticups = false
    
    data.forEach(contract => {
      const multicups = contract.multicups ?? contract.Multicups ?? false
      const list = contract.multiCupsList ?? contract.MultiCupsList ?? null
      const singleCup = contract.customerCUPS ?? contract.CustomerCUPS ?? ''
      const contractNumber = contract.no ?? contract.No ?? ''
      
      // Guardar datos comunes del primer contrato
      if (cupsArray.length === 0) {
        userName.value = contract.customerName ?? contract.CustomerName ?? ''
        cif.value = contract.vatRegistrationNo ?? contract.VatRegistrationNo ?? ''
      }
      
      if (multicups) {
        hasMulticups = true
        const cupsList = Array.isArray(list) ? list.filter(Boolean) : []
        cupsList.forEach(cup => {
          if (!cupsArray.includes(cup)) {
            cupsArray.push(cup)
            cupsToContractMap.value.set(cup, contractNumber)
          }
        })
      } else if (singleCup) {
        if (!cupsArray.includes(singleCup)) {
          cupsArray.push(singleCup)
          cupsToContractMap.value.set(singleCup, contractNumber)
        }
      }
    })

    multicupsEnabled.value = hasMulticups

    if (cupsArray.length === 0) {
      loadError.value = 'No se encontraron CUPS en los contratos.'
      cups.value = ''
      cupsOptions.value = []
      return
    }

    cupsOptions.value = cupsArray

    // Preselección por query si coincide, luego autoseleccionar si solo hay uno
    if (props.prefilledCups && cupsArray.includes(props.prefilledCups)) {
      cups.value = props.prefilledCups
      contractNo.value = cupsToContractMap.value.get(props.prefilledCups) || ''
      // Validar solapamiento
      await nextTick()
      const overlapResult = checkDateOverlap(cups.value)
      // Si hay solapamiento
      if (overlapResult && overlapResult.contract) {
        // Si no permite multicups, mostrar modal simple
        if (!multicupsEnabled.value) {
          overlapError.value = overlapResult.detailedMessage
          showSimpleModal.value = true
        } else {
          // Si permite multicups, comportamiento normal
          overlapError.value = overlapResult.detailedMessage
          hasOverlap.value = true
        }
      }
    } else if (cupsArray.length === 1) {
      cups.value = cupsArray[0]
      contractNo.value = cupsToContractMap.value.get(cupsArray[0]) || ''
      // Validar solapamiento automáticamente
      await nextTick()
      const overlapResult = checkDateOverlap(cups.value)
      // Si hay solapamiento
      if (overlapResult && overlapResult.contract) {
        // Si no permite multicups, mostrar modal simple
        if (!multicupsEnabled.value) {
          overlapError.value = overlapResult.detailedMessage
          showSimpleModal.value = true
        } else {
          // Si permite multicups, comportamiento normal
          overlapError.value = overlapResult.detailedMessage
          hasOverlap.value = true
        }
      }
    } else {
      cups.value = ''
      contractNo.value = ''
    }
  } catch (e) {
    console.error('Error cargando LastsContractIndex:', e)
    loadError.value = e?.response?.data?.message || 'No se pudieron cargar los CUPS desde los contratos.'
  } finally {
    loadingCups.value = false
    // Activar el modal después de que se complete la carga
    modalReady.value = true
  }
}
/* =============================================================== */

watch(() => props.show, async (v) => {
  if (!v) {
    // Resetear estado al cerrar el modal
    isSubmitting.value = false
    overlapError.value = ''
    hasOverlap.value = false
    showSimpleModal.value = false
    modalReady.value = false
    currentStep.value = 1
    periodCmm.value = {}
    return
  }
  
  // Limpiar errores al abrir
  overlapError.value = ''
  hasOverlap.value = false
  showSimpleModal.value = false
  modalReady.value = false
  currentStep.value = 1
  periodCmm.value = {}
  
  // Inicializar Coverage desde localStorage o auth store
  const savedCoverage = auth.coverage ?? localStorage.getItem('coverage')
  coverage.value = savedCoverage ? String(savedCoverage) : ''
  
  console.log('Modal abierto. Props:', { 
    points: props.points, 
    defaultPeriodType: props.defaultPeriodType,
    omipDataSize: props.omipData?.size 
  })
  
  periodType.value = ['Q', 'S', 'Y'].includes(props.defaultPeriodType) ? props.defaultPeriodType : 'Q'
  formError.value = ''
  
  // Inicializar mes de inicio con la primera opción disponible
  await nextTick()
  console.log('startMonthOptions:', startMonthOptions.value)
  
  if (startMonthOptions.value.length > 0) {
    startMonth.value = startMonthOptions.value[0].value
    console.log('startMonth inicializado a:', startMonth.value)
    
    // Esperar a que se actualice el computed
    await nextTick()
    
    // Calcular el precio promedio basado en el mes de inicio
    const avgPrice = calculatedAveragePrice.value
    console.log('Precio promedio inicial:', avgPrice)
    fixedPrice.value = avgPrice != null ? String(avgPrice) : ''
    console.log('fixedPrice inicializado a:', fixedPrice.value)
  }
  
  await loadCups() // ← ahora usa LastContractIndex
  await nextTick()
  
  // Cargar CMM si ya tenemos CUPS y startMonth
  if (cups.value && startMonth.value) {
    await loadMonthlyConsumption()
  }
  
  document.getElementById('mc-modal')?.focus()
})

watch(() => props.prefilledCups, (v) => {
  if (!props.show || !v) return
  if (cupsOptions.value.includes(v)) cups.value = v
})

// Función para validar el CUPS actual
async function validateCurrentCups() {
  if (!props.show || !cups.value) {
    overlapError.value = ''
    hasOverlap.value = false
    showSimpleModal.value = false
    return
  }
  
  await nextTick()
  const overlapResult = checkDateOverlap(cups.value)
  
  // Si hay solapamiento
  if (overlapResult && overlapResult.contract) {
    // Si no permite multicups, mostrar modal simple
    if (!multicupsEnabled.value) {
      overlapError.value = overlapResult.detailedMessage
      showSimpleModal.value = true
    } else {
      // Si permite multicups, comportamiento normal
      overlapError.value = overlapResult.detailedMessage
      hasOverlap.value = true
    }
  } else {
    overlapError.value = ''
    hasOverlap.value = false
    showSimpleModal.value = false
  }
}

// Watch para validar cuando el usuario selecciona un CUPS
watch(cups, async (newCups, oldCups) => {
  // Solo validar si el modal está abierto y el CUPS cambió
  if (!props.show || newCups === oldCups) return
  
  // Actualizar el número de contrato según el CUPS seleccionado
  if (newCups && cupsToContractMap.value.has(newCups)) {
    contractNo.value = cupsToContractMap.value.get(newCups)
  } else {
    contractNo.value = ''
  }
  
  await validateCurrentCups()
})

// Watch para revalidar cuando cambia el mes de inicio o la duración
watch([startMonth, periodType], async () => {
  if (!props.show) return
  await validateCurrentCups()
  // Cargar CMM cuando cambien las fechas
  if (cups.value && startMonth.value) {
    await loadMonthlyConsumption()
  }
})

// Watch para cargar CMM cuando cambie el CUPS
watch(cups, async (newCups) => {
  if (!props.show || !newCups || !startMonth.value) return
  await loadMonthlyConsumption()
})
function blockSubmit() {
  if (isSubmitting.value) return
  isSubmitting.value = true
  onSubmit()
}

function onSubmit() {

  if (!canSubmit.value) return

  const basePrice = Number(parseNumLike(fixedPrice.value) || 0)
  const fee = Number(props.feeEnergy || 0)
  const coverageNum = Number(parseNumLike(coverage.value) || 0)
  
  const payload = {
    contractNo: contractNo.value,
    customerNo: String(props.customerNo),
    customerCups: cups.value,
    periodType: periodType.value,
    fixedPriceOmip: basePrice,                               // Precio base + fee energy
    periodKeys: props.points.map(p => `${p.key}-01`),
    volumeMw: totalVolume.value,                              // Volumen total calculado
    startMonth: startMonth.value ? `${startMonth.value}-01` : '',   // Fecha mes inicio (YYYY-MM-01)
    endMonth: endMonth.value,                                       // Mes final calculado (texto)
    feeEnergy: fee,                                                 // Fee energy del contrato
    coverage: coverageNum                                           // Coverage (porcentaje)
  }

  emit('submit', payload)


}

// Funciones de navegación del wizard
async function nextStep() {
  if (currentStep.value === 1) {
    // Validar que se haya seleccionado mes de inicio
    if (!startMonth.value) {
      formError.value = 'Selecciona un mes de inicio.'
      return
    }
    
    console.log('Avanzando al paso 2...')
    console.log('CUPS:', cups.value)
    console.log('Start Month:', startMonth.value)
    console.log('Period Type:', periodType.value)
    console.log('Click Periods:', clickPeriods.value)
    
    currentStep.value = 2
    
    // Cargar CMM cuando se avanza al paso 2
    if (cups.value && startMonth.value) {
      console.log('Cargando consumo mensual...')
      await loadMonthlyConsumption()
    } else {
      console.warn('No se puede cargar CMM - Falta CUPS o Start Month')
    }
  }
}

function prevStep() {
  if (currentStep.value === 2) {
    currentStep.value = 1
  }
}

// Validación para el paso 1
const canGoToNextStep = computed(() => {
  return !!startMonth.value && periodType.value && ['Q', 'S', 'Y'].includes(periodType.value)
})
function onRemove(key) { emit('remove', key) }
</script>

<template>
  <Teleport to="body">
    <div v-if="show && modalReady && !showSimpleModal" class="mc-backdrop" aria-modal="true" role="dialog" @click.self="$emit('close')"
      @keydown.esc="$emit('close')">
      <div id="mc-modal" class="mc-modal" tabindex="-1">
        <div class="mc-header">
          <h5 class="m-0">GENERAR NUEVO CLICK</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="$emit('close')">×</button>
        </div>

        <div class="mc-body">
          <!-- Indicador de pasos -->
          <div class="wizard-steps mb-4">
            <div class="step-indicator" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
              <span class="step-number">1</span>
              <span class="step-label">Selección</span>
            </div>
            <div class="step-indicator" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
              <span class="step-number">2</span>
              <span class="step-label">Datos</span>
            </div>
          </div>

          <!-- PASO 1: Selección de punto y duración -->
          <div v-if="currentStep === 1" class="wizard-step">
            <h5 class="mb-5">INFORMACIÓN ORIENTATIVA:</h5>

            <!-- Tabla puntos -->
            <div class="mb-3 mt-3">
              <h6 class="mb-2">Punto (OMIP Base)</h6>
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mes / Año</th>
                      <th>Mes Inicio</th>
                      <th>Mes Final</th>
                      <th>Valor (€/MWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, i) in points" :key="p.key">
                      <td>{{ i + 1 }}</td>
                      <td>{{ p.label }}</td>
                      <td>
                        <select class="form-select form-select-sm" v-model="startMonth" style="min-width: 120px;">
                          <option value="">Seleccionar</option>
                          <option v-for="opt in startMonthOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                          </option>
                        </select>
                      </td>
                      <td>
                        <input type="text" class="form-control form-control-sm" :value="endMonth" readonly style="min-width: 100px;" />
                      </td>
                      <td>{{ fixedPrice ? `${fixedPrice} € / MWh` : '-' }}</td>
                    </tr>
                    <tr v-if="!points.length">
                      <td colspan="5" class="text-center text-muted">Sin punto seleccionado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <small class="text-muted">Máximo 1 punto.</small>
            </div>

            <hr class="my-3" />

            <!-- Duración click -->
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
          </div>

          <!-- PASO 2: Datos del cliente y detalles -->
          <div v-if="currentStep === 2" class="wizard-step">
            <h5 class="mb-3">SOLICITUD DE OPERACIÓN:</h5>
            
            <div class="row g-3 p-3 justify-content-center align-items-center">
              <div class="col-12 col-md-6">
                <label class="form-label">Nombre</label>
                <input class="form-control" type="text" :value="userName" readonly />
              </div>
            </div>
            <div class="row g-3 p-3 justify-content-center align-items-center">
              <div class="col-12 col-md-6">
                <label class="form-label">DNI/CIF</label>
                <input class="form-control" type="text" :value="cif" readonly />
              </div>
            </div>

            <div class="row g-3 p-3 justify-content-center align-items-center">
              <div class="col-12 col-md-6">
                <label class="form-label">CUPS <span class="text-danger">*</span></label>
                <select class="form-select" v-model="cups" :disabled="loadingCups || !!loadError" 
                        :class="{ 'is-invalid': hasOverlap }">
                  <option value="">Selecciona la opción</option>
                  <option v-for="c in cupsOptions" :key="c" :value="c">{{ c }}</option>
                </select>
                <div v-if="loadingCups" class="form-text">Cargando CUPS…</div>
                <div v-if="loadError" class="text-danger small">{{ loadError }}</div>
                
                <!-- Mensaje de error de solapamiento debajo del CUPS -->
                <div v-if="overlapError" class="alert alert-danger mt-2 mb-0" style="font-size: 0.875rem;">
                  <strong>⚠️ CUPS no disponible</strong><br/>
                  {{ overlapError }}
                </div>
              </div>
            </div>
            <div class="row g-3 p-3 justify-content-center align-items-center">
              <div class="col-12 col-md-6">
                <label class="form-label">N.º Contrato</label>
                <input class="form-control" type="text" :value="contractNo" readonly />
              </div>
            </div>
            <div class="row g-3 p-3 justify-content-center align-items-center">
              <div class="col-12 col-md-6">
                <label class="form-label">Precio referencia mercado (OMIP) <span class="text-danger">*</span></label>
                <div class="input-group">
                  <input class="form-control" type="number" inputmode="decimal" step="0.01" min="0" v-model="fixedPrice"
                    placeholder="Ej. 85.50" readonly />
                  <span class="input-group-text">€/MWh</span>
                </div>
                <small class="text-muted">Sugerido: media de los puntos seleccionados.</small>
              </div>
            </div>

            <hr class="my-4" />

            <!-- Duración del Click -->
            <div class="row g-3 p-3">
              <div class="col-12">
                <h5 class="mb-3">Duración del Click:</h5>
                
                <div class="row g-3 mb-3">
                  <div class="col-12 col-md-4">
                    <label class="form-label">Fecha Inicio</label>
                    <input class="form-control" type="text" :value="startDateFormatted" readonly />
                  </div>
                  <div class="col-12 col-md-4">
                    <label class="form-label">Fecha Fin</label>
                    <input class="form-control" type="text" :value="endDateFormatted" readonly />
                  </div>
                  <div class="col-12 col-md-4">
                    <label class="form-label">% Volumen energía a contratar <span class="text-danger">*</span></label>
                    <div class="input-group">
                      <input 
                        class="form-control" 
                        type="number" 
                        inputmode="numeric" 
                        step="1" 
                        min="1" 
                        max="100"
                        v-model.number="coverage"
                        placeholder="Ej. 50"
                        @input="coverage = Math.round($event.target.value) || ''"
                      />
                      <span class="input-group-text">%</span>
                    </div>
                    <small class="text-muted">Indicar un % de entre 1 y 100 en números enteros</small>
                  </div>
                </div>

                <div class="table-responsive">
                  <table class="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>Periodos de duración de Click</th>
                        <th>Consumo media mensual (CMM) en MWh</th>
                        <th>CMM × Cobertura (MWh)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="period in clickPeriods" :key="period.key">
                        <td>{{ period.label }}</td>
                        <td>
                          <div class="input-group input-group-sm">
                            <input 
                              class="form-control form-control-sm" 
                              type="number" 
                              inputmode="decimal" 
                              step="0.01" 
                              min="0"
                              :value="getPeriodCmm(period.key)"
                              @input="updatePeriodCmm(period.key, $event.target.value)"
                              placeholder="0.00" 
                              style="min-width: 150px;"
                              :disabled="loadingCmm"
                            />
                            <span v-if="loadingCmm" class="input-group-text">
                              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <input 
                            class="form-control form-control-sm" 
                            type="text" 
                            :value="getCmmWithCoverage(period.key).toLocaleString('es-ES')"
                            readonly
                            style="min-width: 150px; background-color: #f8f9fa;"
                          />
                        </td>
                      </tr>
                      <tr v-if="clickPeriods.length === 0">
                        <td colspan="3" class="text-center text-muted">No hay periodos disponibles</td>
                      </tr>
                      <tr v-if="clickPeriods.length > 0" class="table-active fw-bold">
                        <td>TOTAL</td>
                        <td>
                          {{ totalVolumeWithoutCoverage.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} MWh
                        </td>
                        <td>
                          {{ totalVolume.toLocaleString('es-ES') }} MWh
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div v-if="formError" class="alert alert-warning mt-3 mb-0">
            {{ formError }}
          </div>

          <!-- Texto legal antes del botón (solo en paso 2) -->
          <div v-if="currentStep === 2" class="legal-text mt-4 p-3">
            <p class="mb-0 text-justify">
              Al pulsar el botón "Solicitar Click", solicito expresamente a {{ marketerFullName }}, oferta comercial de precio fijo para un Click conforme a las características que constan expresadas en el presente formulario, bajo mi contrato de suministro eléctrico activo, y el producto E-PRO Multiclick contratado por mi parte.
            </p>
          </div>
        </div>

        <div class="mc-footer">
          <!-- Botones del paso 1 -->
          <template v-if="currentStep === 1">
            <!-- <button class="btn btn-outline-secondary" @click="$emit('close')">Cancelar</button> -->
            <button class="btn btn-primary" :disabled="!canGoToNextStep" @click="nextStep">
              Siguiente
            </button>
          </template>
          
          <!-- Botones del paso 2 -->
          <template v-if="currentStep === 2">
            <button class="btn btn-outline-secondary" @click="prevStep" :disabled="isSubmitting">Atrás</button>
            <button class="btn btn-primary" :disabled="!canSubmit || isSubmitting" @click="blockSubmit">
              <span v-if="isSubmitting">Enviando...</span>
              <span v-else>Solicitar Click</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modal simple para CUPS no disponible cuando multicups = false -->
  <Teleport to="body">
    <div v-if="show && showSimpleModal" class="mc-backdrop" aria-modal="true" role="dialog" @click.self="showSimpleModal = false; $emit('close')"
      @keydown.esc="showSimpleModal = false; $emit('close')">
      <div class="mc-modal" style="max-width: 500px;">
        <div class="mc-header">
          <h5 class="m-0">Click aplicado para este período y CUPS</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="showSimpleModal = false; $emit('close')">×</button>
        </div>

        <div class="mc-body" style="padding: 2rem;">
          <div class="text-center">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎯</div>
            <h6 class="mb-3">Ya has fijado precio para este mismo periodo con tu CUPS {{ cups }}</h6>
            <!-- <p class="text-muted mb-4">{{ overlapError }}</p> -->
            <button class="btn btn-primary" @click="showSimpleModal = false; $emit('close')">
              Cerrar
            </button>
          </div>
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
  justify-content: flex-end;
  gap: 0.5rem;
}

.mc-body {
  padding: 1rem;
  overflow: auto;
}

.btn-close {
  appearance: none;
  background: none !important;
  background-image: none !important;
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
  color: #111827;
}

.btn-close:hover {
  background: #f3f4f6 !important;
  background-image: none !important;
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

/* Estilos del wizard */
.wizard-steps {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #eef2f7;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  flex: 1;
  max-width: 200px;
}

.step-indicator::after {
  content: '';
  position: absolute;
  top: 1rem;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #e5e7eb;
  z-index: 0;
}

.step-indicator:last-child::after {
  display: none;
}

.step-indicator.completed::after {
  background: #0d6efd;
}

.step-number {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.step-indicator.active .step-number {
  background: #0d6efd;
  color: #fff;
}

.step-indicator.completed .step-number {
  background: #198754;
  color: #fff;
}

.step-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.step-indicator.active .step-label {
  color: #0d6efd;
  font-weight: 600;
}

.step-indicator.completed .step-label {
  color: #198754;
}

.wizard-step {
  min-height: 300px;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
  border-width: 0.15em;
}

.spinner-border {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  vertical-align: text-bottom;
  border: 0.15em solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spinner-border 0.75s linear infinite;
}

@keyframes spinner-border {
  to {
    transform: rotate(360deg);
  }
}

/* Estilos para el texto legal */
.legal-text {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #495057;
}

.legal-text p {
  margin: 0;
  text-align: justify;
}
</style>