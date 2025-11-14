<script setup>
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import api from '@/services/api'
import config from '@/config/env'

const isSubmitting = ref(false)
let submitTimerId = null
const LOCK_MS = 1000

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
      params: { customerNo: String(props.customerNo), marketer: config.MARKETER }
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
    multicupsEnabled.value = multicups


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
    } else if (arr.length === 1) {
      cups.value = arr[0]
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
    }
  } catch (e) {
    console.error('Error cargando LastContractIndex:', e)
    loadError.value = e?.response?.data?.message || 'No se pudieron cargar los CUPS desde el contrato.'
  } finally {
    loadingCups.value = false
    // Activar el modal después de que se complete la carga
    modalReady.value = true
  }
}
/* =============================================================== */

watch(() => props.show, async (v) => {
  if (!v) {
    isSubmitting.value = false
    if (submitTimerId) { clearTimeout(submitTimerId); submitTimerId = null }
    // Limpiar errores al cerrar
    overlapError.value = ''
    hasOverlap.value = false
    showSimpleModal.value = false
    modalReady.value = false
    return
  }
  
  // Limpiar errores al abrir
  overlapError.value = ''
  hasOverlap.value = false
  showSimpleModal.value = false
  modalReady.value = false
  
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
  
  await validateCurrentCups()
})

// Watch para revalidar cuando cambia el mes de inicio o la duración
watch([startMonth, periodType], async () => {
  if (!props.show) return
  await validateCurrentCups()
})
function blockSubmit() {
  if (isSubmitting.value) return
  isSubmitting.value = true

  onSubmit()


  if (submitTimerId) { clearTimeout(submitTimerId); submitTimerId = null }
  submitTimerId = setTimeout(() => {
    isSubmitting.value = false
    submitTimerId = null
  }, LOCK_MS)
}

function onSubmit() {

  if (!canSubmit.value) return

  const basePrice = Number(parseNumLike(fixedPrice.value) || 0)
  const fee = Number(props.feeEnergy || 0)
  
  const payload = {
    contractNo: contractNo.value,
    customerNo: String(props.customerNo),
    customerCups: cups.value,
    periodType: periodType.value,
    fixedPriceOmip: basePrice,                               // Precio base + fee energy
    periodKeys: props.points.map(p => `${p.key}-01`),
    volumeMw: 0,
    startMonth: startMonth.value ? `${startMonth.value}-01` : '',   // Fecha mes inicio (YYYY-MM-01)
    endMonth: endMonth.value,                                       // Mes final calculado (texto)
    feeEnergy: fee                                                  // Fee energy del contrato
  }

  emit('submit', payload)


}
function onRemove(key) { emit('remove', key) }
</script>

<template>
  <Teleport to="body">
    <div v-if="show && modalReady && !showSimpleModal" class="mc-backdrop" aria-modal="true" role="dialog" @click.self="$emit('close')"
      @keydown.esc="$emit('close')">
      <div id="mc-modal" class="mc-modal" tabindex="-1">
        <div class="mc-header">
          <h5 class="m-0">PLANTILLA DE SOLICITUD DE OPERACIÓN</h5>
          <button type="button" class="btn-close" aria-label="Cerrar" @click="$emit('close')">×</button>
        </div>

        <div class="mc-body">
          <!-- Tabla puntos -->
          <div class="mb-3">
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
                    <th></th>
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
                    <td>
                      <button type="button" class="btn btn-sm btn-outline-danger" @click="onRemove(p.key)">
                        Quitar
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!points.length">
                    <td colspan="6" class="text-center text-muted">Sin punto seleccionado</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <small class="text-muted">Máximo 1 punto.</small>
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
              <label class="form-label">N.º Contrato</label>
              <input class="form-control" type="text" :value="contractNo" readonly />
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
              <label class="form-label">Precio referencia mercado (OMIP) <span class="text-danger">*</span></label>
              <div class="input-group">
                <input class="form-control" type="number" inputmode="decimal" step="0.01" min="0" v-model="fixedPrice"
                  placeholder="Ej. 85.50" readonly />
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
          <button class="btn btn-primary" :disabled="!canSubmit || isSubmitting" @click="blockSubmit">
            <span v-if="isSubmitting">Enviando…</span>
            <span v-else>Aceptar y enviar</span>
          </button>
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
</style>