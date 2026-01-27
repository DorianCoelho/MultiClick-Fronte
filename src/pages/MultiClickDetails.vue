<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const customerNo = computed(() =>
  auth.user?.id || auth.user?.customerNo || auth.user?.customerId || ''
)

const loading = ref(false)
const error = ref('')
const contractData = ref(null)

// Periodos según tarifa (ej: 2.0TD -> P1-P3; resto -> P1-P6)
const activePeriods = computed(() => {
  const rate = String(contractData.value?.rateNo || '').trim().toUpperCase()
  if (!rate) return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
  // Casuística solicitada: 2.0TD no pinta P4, P5, P6
  if (rate.startsWith('2')) return ['P1', 'P2', 'P3']
  return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']
})

const periodRows = computed(() => {
  const d = contractData.value
  if (!d) return []
  const valByKey = (k) => {
    const key = String(k || '').toLowerCase() // P1 -> p1
    return d[key]
  }
  return activePeriods.value.map(k => ({ key: k, value: valByKey(k) }))
})

// Computed para mostrar correctamente el tipo y número de documento
const documentTypeDisplay = computed(() => {
  if (!contractData.value) return '—'
  const docType = String(contractData.value.multiclickDocumentType || '').toLowerCase()
  if (docType === 'contrato') return 'Contrato'
  if (docType === 'propuesta') return 'Propuesta'
  return contractData.value.multiclickDocumentType || '—'
})

const documentNoDisplay = computed(() => {
  if (!contractData.value) return '—'
  const docType = String(contractData.value.multiclickDocumentType || '').toLowerCase()
  // Si es Contrato, mostrar contractNo; si es Propuesta, mostrar multiclickDocumentNo
  if (docType === 'contrato') {
    return contractData.value.contractNo || '—'
  }
  return contractData.value.multiclickDocumentNo || '—'
})

// Helpers
function fmtDate(dateLike) {
  if (!dateLike) return '—'
  if (typeof dateLike === 'string') {
    const d = new Date(dateLike)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES')
  }
  // Si es DateOnly de C#
  if (dateLike.year && dateLike.month && dateLike.day) {
    return `${String(dateLike.day).padStart(2, '0')}/${String(dateLike.month).padStart(2, '0')}/${dateLike.year}`
  }
  return '—'
}

function fmtDateTime(dateTimeLike) {
  if (!dateTimeLike) return '—'
  const d = new Date(dateTimeLike)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-ES')
}

function fmtNum(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function fmtNum6Digits(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 6, maximumFractionDigits: 6 }) : '—'
}

function fmtNumPercentage(n) {
  const v = Number(n)
  return Number.isFinite(v) ? `${v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
}

async function loadContractDetails() {
  loading.value = true
  error.value = ''
  contractData.value = null

  const contractNo = route.query.contractNo
  const proposalNo = route.query.proposalNo
  const customerNoParam = route.query.customerNo || customerNo.value

  if (!contractNo || !customerNoParam) {
    error.value = 'Faltan parámetros requeridos (contractNo, customerNo)'
    loading.value = false
    return
  }

  try {
    const { data } = await api.get('/v1/MultiClick/GetMultiClickEnergyContractByContract', {
      params: {
        customerNo: customerNoParam,
        contractNo: contractNo,
        proposalNo: proposalNo
      }
    })

    // Normalizar datos (soporta camelCase y PascalCase)
    contractData.value = {
      contractNo: data.contractNo ?? data.ContractNo ?? '',
      customerNo: data.customerNo ?? data.CustomerNo ?? '',
      cups: data.cups ?? data.Cups ?? '',
      multiclickDocumentType: data.multiclickDocumentType ?? data.MulticlickDocumentType ?? '',
      multiclickDocumentNo: data.multiclickDocumentNo ?? data.MulticlickDocumentNo ?? '',
      status: data.status ?? data.Status ?? '',
      rateNo: data.rateNo ?? data.RateNo ?? '',
      refApplicationOperNo: data.refApplicationOperNo ?? data.RefApplicationOperNo ?? '',
      feeEnergy: Number(data.feeEnergy ?? data.FeeEnergy ?? 0),
      selectedPrice: Number(data.selectedPrice ?? data.SelectedPrice ?? 0),
      duration: data.duration ?? data.Duration ?? '',
      startDate: data.startDate ?? data.StartDate,
      endDate: data.endDate ?? data.EndDate,
      dateTimeCreated: data.dateTimeCreated ?? data.DateTimeCreated,
      p1: Number(data.p1 ?? data.P1 ?? 0),
      p2: Number(data.p2 ?? data.P2 ?? 0),
      p3: Number(data.p3 ?? data.P3 ?? 0),
      p4: Number(data.p4 ?? data.P4 ?? 0),
      p5: Number(data.p5 ?? data.P5 ?? 0),
      p6: Number(data.p6 ?? data.P6 ?? 0),
      multiclickFEEPowerDocuments: (data.multiclickFEEPowerDocuments ?? data.MulticlickFEEPowerDocuments ?? []).map(doc => ({
        documentType: doc.documentType ?? doc.DocumentType ?? '',
        documentNo: doc.documentNo ?? doc.DocumentNo ?? '',
        marketerNo: doc.marketerNo ?? doc.MarketerNo ?? '',
        rateNo: doc.rateNo ?? doc.RateNo ?? '',
        feeProductType: doc.feeProductType ?? doc.FeeProductType ?? '',
        p1: Number(doc.p1 ?? doc.P1 ?? 0),
        p2: Number(doc.p2 ?? doc.P2 ?? 0),
        p3: Number(doc.p3 ?? doc.P3 ?? 0),
        p4: Number(doc.p4 ?? doc.P4 ?? 0),
        p5: Number(doc.p5 ?? doc.P5 ?? 0),
        p6: Number(doc.p6 ?? doc.P6 ?? 0),
        p1Percentage: Number(doc.p1Percentage ?? doc.P1Percentage ?? 0),
        p2Percentage: Number(doc.p2Percentage ?? doc.P2Percentage ?? 0),
        p3Percentage: Number(doc.p3Percentage ?? doc.P3Percentage ?? 0),
        p4Percentage: Number(doc.p4Percentage ?? doc.P4Percentage ?? 0),
        p5Percentage: Number(doc.p5Percentage ?? doc.P5Percentage ?? 0),
        p6Percentage: Number(doc.p6Percentage ?? doc.P6Percentage ?? 0),
        totalP1P6: Number(doc.totalP1P6 ?? doc.TotalP1P6 ?? 0),
        totalP1P6Percentage: Number(doc.totalP1P6Percentage ?? doc.TotalP1P6Percentage ?? 0),
        systemId: doc.systemId ?? doc.SystemId ?? ''
      })),
      multiclickFEEEnergyDocuments: (data.multiclickFEEEnergyDocuments ?? data.MulticlickFEEEnergyDocuments ?? []).map(doc => ({
        documentType: doc.documentType ?? doc.DocumentType ?? '',
        documentNo: doc.documentNo ?? doc.DocumentNo ?? '',
        marketerNo: doc.marketerNo ?? doc.MarketerNo ?? '',
        rateNo: doc.rateNo ?? doc.RateNo ?? '',
        feeProductType: doc.feeProductType ?? doc.FeeProductType ?? '',
        p1: Number(doc.p1 ?? doc.P1 ?? 0),
        p2: Number(doc.p2 ?? doc.P2 ?? 0),
        p3: Number(doc.p3 ?? doc.P3 ?? 0),
        p4: Number(doc.p4 ?? doc.P4 ?? 0),
        p5: Number(doc.p5 ?? doc.P5 ?? 0),
        p6: Number(doc.p6 ?? doc.P6 ?? 0),
        totalP1P6: Number(doc.totalP1P6 ?? doc.TotalP1P6 ?? 0),
        systemId: doc.systemId ?? doc.SystemId ?? ''
      }))
    }
    console.log(contractData.value)
  } catch (e) {
    error.value = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'No se pudo cargar el contrato'
    console.error('Error cargando detalles del contrato:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadContractDetails()
})

// === PDF state & utils ===
const showPdf = ref(false)
const pdfUrl = ref(null)
const pdfLoading = ref(false)
const pdfError = ref('')
const currentPdfId = ref(null)

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
  const url = `/v1/MultiClick/GetPdf/${encodeURIComponent(id)}`
  const { data } = await api.get(url, { responseType: 'text' })
  let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
  if (!base64) throw new Error('PDF vacío')
  if (base64.startsWith('"')) {
    try { base64 = JSON.parse(base64) } catch { }
  }
  return base64
}

async function fetchOperationPdfBase64ById(id) {
  // Endpoint MultiClick GetOperationPdf
  const url = `/v1/MultiClick/GetOperationPdf/${encodeURIComponent(id)}`
  const { data } = await api.get(url, { responseType: 'text' })
  let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
  if (!base64) throw new Error('PDF vacío')
  if (base64.startsWith('"')) {
    try { base64 = JSON.parse(base64) } catch { }
  }
  return base64
}

async function openPdfModal() {
  const id = contractData.value?.multiclickDocumentNo
  if (!id) { 
    error.value = 'No hay identificador de PDF para este contrato.'
    return 
  }
  
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

async function openOperationPdfModal() {
  const id = contractData.value?.multiclickDocumentNo
  if (!id) { 
    error.value = 'No hay multiClickDocumentNo para este contrato.'
    return 
  }
  
  pdfLoading.value = true
  pdfError.value = ''
  currentPdfId.value = id
  revokePdfUrl()

  try {
    const base64 = await fetchOperationPdfBase64ById(id)
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

function onKey(e) {
  if (e.key === 'Escape' && showPdf.value) closePdf()
}
onMounted(() => window.addEventListener('keydown', onKey))
</script>

<template>
  <DashboardLayout>
    <div class="page">
      <!-- Header -->
      <header class="head">
        <div class="title-wrap">
          <h1>Detalles Contrato MultiClick</h1>
          <div class="sub">
            <span class="badge-contract">{{ contractData?.contractNo || '—' }}</span>
            <span class="sep">•</span>
            <span class="badge-doc">{{ documentNoDisplay }}</span>
            <span class="sep">•</span>
            <span class="pill" :class="{ 'pill-sug': contractData?.status?.toLowerCase() === 'sugerido' }">
              {{ contractData?.status || '—' }}
            </span>
          </div>
        </div>
        <div class="head-actions">
          <button 
            v-if="contractData?.multiclickDocumentNo"
            class="btn btn-pdf" 
            @click="openPdfModal"
            :disabled="pdfLoading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
              <path d="M14 2v6h6"/>
            </svg>
            {{ pdfLoading ? 'Cargando...' : 'Ver PDF' }}
          </button>
          <button class="btn btn-back" @click="router.back()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Volver
          </button>
        </div>
      </header>

      <!-- Loading / Error -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p class="muted">Cargando detalles del contrato…</p>
      </div>
      <div v-else-if="error" class="error-state">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p class="text-danger">{{ error }}</p>
      </div>

      <div v-else-if="contractData" class="content-wrapper">
        <!-- Información Principal -->
        <div class="cards-grid">
          <!-- Datos del Contrato -->
          <div class="info-card">
            <div class="card-header">
              <div class="card-header-top">
                <h3 class="card-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                  </svg>
                  Datos del Contrato
                </h3>
                <!-- Precio destacado arriba junto al título -->
                <div class="price-highlight-inline">
                  <div class="price-item-inline">
                    <span class="price-label-inline">Precio Ref. OMIP</span>
                    <div class="price-value-inline">
                      <strong>{{ fmtNum(contractData.selectedPrice) }}</strong>
                      <span class="price-unit-inline">€/MWh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">N.º Contrato</span>
                  <strong class="info-value mono">{{ contractData.contractNo }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">N.º Cliente</span>
                  <strong class="info-value mono">{{ contractData.customerNo }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">CUPS</span>
                  <strong class="info-value mono">{{ contractData.cups }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Tipo Documento</span>
                  <strong class="info-value">{{ documentTypeDisplay }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">N.º Documento</span>
                  <strong class="info-value mono">{{ documentNoDisplay }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Estado</span>
                  <span class="pill" :class="{ 'pill-sug': contractData.status?.toLowerCase() === 'sugerido' }">
                    {{ contractData.status }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Tarifa</span>
                  <strong class="info-value">{{ contractData.rateNo }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Ref. Operación</span>
                  <a 
                    v-if="contractData.refApplicationOperNo && contractData.multiclickDocumentNo"
                    href="#" 
                    @click.prevent="openOperationPdfModal"
                    class="info-value mono link-document"
                    :title="`Ver PDF de operación ${contractData.refApplicationOperNo}`">
                    {{ contractData.refApplicationOperNo }}
                  </a>
                  <strong v-else class="info-value mono">{{ contractData.refApplicationOperNo || '—' }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Duración</span>
                  <strong class="info-value">{{ contractData.duration }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Fecha Inicio</span>
                  <strong class="info-value">{{ fmtDate(contractData.startDate) }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Fecha Fin</span>
                  <strong class="info-value">{{ fmtDate(contractData.endDate) }}</strong>
                </div>
                <div class="info-item">
                  <span class="info-label">Fecha Creación</span>
                  <strong class="info-value">{{ fmtDateTime(contractData.dateTimeCreated) }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Precios por período (filtra periodos según tarifa) -->
          <div class="info-card info-card-narrow">
            <div class="card-header">
              <h3 class="card-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Precios por período
              </h3>
            </div>
            <div class="card-body">
              <div class="table-scroll">
                <table class="table-modern">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th class="text-end">Valor (€/KWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in periodRows" :key="p.key">
                      <td><span class="period-badge" :class="`period-${String(p.key).toLowerCase()}`">{{ p.key }}</span></td>
                      <td class="text-end mono">{{ fmtNum6Digits(p.value) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Documentos FEE Power -->
        <!-- <div v-if="contractData.multiclickFEEPowerDocuments?.length > 0" class="info-card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              Documentos FEE Power
            </h3>
          </div>
          <div class="card-body">
            <div v-for="(doc, idx) in contractData.multiclickFEEPowerDocuments" :key="idx" class="document-card">
              <div class="document-header">
                <h4 class="document-title">Documento {{ idx + 1 }}</h4>
                <span class="document-badge">{{ doc.documentType }}</span>
              </div>
              <div class="document-info">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">N.º Documento</span>
                    <strong class="info-value mono">{{ doc.documentNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Comercializadora</span>
                    <strong class="info-value">{{ doc.marketerNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Tarifa</span>
                    <strong class="info-value">{{ doc.rateNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Tipo Producto Fee</span>
                    <strong class="info-value">{{ doc.feeProductType }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">System ID</span>
                    <strong class="info-value mono">{{ doc.systemId }}</strong>
                  </div>
                </div>
              </div>
              <div class="table-scroll">
                <table class="table-modern">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th class="text-end">Valor</th>
                      <th class="text-end">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span class="period-badge period-p1">P1</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p1) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p1Percentage) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p2">P2</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p2) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p2Percentage) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p3">P3</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p3) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p3Percentage) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p4">P4</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p4) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p4Percentage) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p5">P5</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p5) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p5Percentage) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p6">P6</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p6) }}</td>
                      <td class="text-end">{{ fmtNumPercentage(doc.p6Percentage) }}</td>
                    </tr>
                    <tr class="table-total">
                      <td><strong>Total P1-P6</strong></td>
                      <td class="text-end mono"><strong>{{ fmtNum(doc.totalP1P6) }}</strong></td>
                      <td class="text-end"><strong>{{ fmtNumPercentage(doc.totalP1P6Percentage) }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div> -->

        <!-- Documentos FEE Energy -->
        <!-- <div v-if="contractData.multiclickFEEEnergyDocuments?.length > 0" class="info-card">
          <div class="card-header">
            <h3 class="card-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Documentos FEE Energy
            </h3>
          </div>
          <div class="card-body">
            <div v-for="(doc, idx) in contractData.multiclickFEEEnergyDocuments" :key="idx" class="document-card">
              <div class="document-header">
                <h4 class="document-title">Documento {{ idx + 1 }}</h4>
                <span class="document-badge">{{ doc.documentType }}</span>
              </div>
              <div class="document-info">
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">N.º Documento</span>
                    <strong class="info-value mono">{{ doc.documentNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Comercializadora</span>
                    <strong class="info-value">{{ doc.marketerNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Tarifa</span>
                    <strong class="info-value">{{ doc.rateNo }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Tipo Producto Fee</span>
                    <strong class="info-value">{{ doc.feeProductType }}</strong>
                  </div>
                  <div class="info-item">
                    <span class="info-label">System ID</span>
                    <strong class="info-value mono">{{ doc.systemId }}</strong>
                  </div>
                </div>
              </div>
              <div class="table-scroll">
                <table class="table-modern">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th class="text-end">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span class="period-badge period-p1">P1</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p1) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p2">P2</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p2) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p3">P3</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p3) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p4">P4</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p4) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p5">P5</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p5) }}</td>
                    </tr>
                    <tr>
                      <td><span class="period-badge period-p6">P6</span></td>
                      <td class="text-end mono">{{ fmtNum(doc.p6) }}</td>
                    </tr>
                    <tr class="table-total">
                      <td><strong>Total P1-P6</strong></td>
                      <td class="text-end mono"><strong>{{ fmtNum(doc.totalP1P6) }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div> -->
      </div>
    </div>

    <!-- PDF Modal -->
    <div v-if="showPdf" class="pdf-modal" @keydown.esc="closePdf" tabindex="0">
      <div class="pdf-toolbar">
        <div class="left">
          <strong class="mono">PDF · {{ currentPdfId || '—' }}</strong>
        </div>
        <div class="right">
          <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener" class="btn-ghost btn-ghost-p">Abrir en pestaña</a>
          <button class="btn-ghost btn-ghost-p" @click="downloadFromModal" :disabled="!pdfUrl">Descargar</button>
          <button class="btn btn-ghost-custom2" @click="closePdf">Cerrar ✕</button>
        </div>
      </div>

      <div class="pdf-body">
        <div v-if="pdfLoading" class="pdf-center muted">Cargando PDF…</div>
        <div v-else-if="pdfError" class="pdf-center text-danger">{{ pdfError }}</div>
        <iframe v-else class="pdf-frame" :src="pdfUrl" title="Documento PDF"></iframe>
      </div>
    </div>
  </DashboardLayout>
</template>

<style scoped>
.page {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.title-wrap h1 {
  margin: 0 0 0.75rem 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
}

.sub {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #6b7280;
  font-size: 0.9rem;
  flex-wrap: wrap;
}

.badge-contract,
.badge-doc {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.875rem;
}

.sep {
  color: #d1d5db;
  font-weight: 300;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #fff;
  color: #374151;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-back:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #111827;
}

.btn-back svg {
  flex-shrink: 0;
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state svg {
  color: #ef4444;
  margin-bottom: 1rem;
}

/* Content Wrapper */
.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Cards Grid */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}

/* Info Card */
.info-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;
}

.info-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-header {
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e5e7eb;
}

.card-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

/* Precio destacado inline en el header */
.price-highlight-inline {
  display: flex;
  align-items: center;
}

.price-item-inline {
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 0.5rem;
  border: 1px solid #bfdbfe;
}

.price-label-inline {
  display: block;
  font-size: 0.7rem;
  color: #3b82f6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.25rem;
}

.price-value-inline {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.price-value-inline strong {
  font-size: 1.25rem;
  color: #1e40af;
  font-weight: 700;
}

.price-unit-inline {
  font-size: 0.75rem;
  color: #60a5fa;
  font-weight: 500;
}

/* Tarjeta más estrecha para precios por período */
.info-card-narrow {
  max-width: 400px;
}

.card-title svg {
  flex-shrink: 0;
  color: #2563eb;
}

.card-body {
  padding: 1.5rem;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.info-value {
  font-size: 0.9375rem;
  color: #111827;
  font-weight: 600;
}

/* Price Highlight */
.price-highlight {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.price-item {
  padding: 1.25rem;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 0.5rem;
  border: 1px solid #bfdbfe;
}

.price-label {
  display: block;
  font-size: 0.75rem;
  color: #3b82f6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-bottom: 0.5rem;
}

.price-value {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.price-value strong {
  font-size: 1.5rem;
  color: #1e40af;
  font-weight: 700;
}

.price-unit {
  font-size: 0.875rem;
  color: #60a5fa;
  font-weight: 500;
}

/* Document Card */
.document-card {
  padding: 1.5rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.document-card:last-child {
  margin-bottom: 0;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.document-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.document-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  background: #dbeafe;
  color: #1e40af;
  font-size: 0.75rem;
  font-weight: 600;
}

.document-info {
  margin-bottom: 1.25rem;
}

/* Table Modern */
.table-scroll {
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.table-modern {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  background: #fff;
}

.table-modern thead {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.table-modern th {
  padding: 0.875rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid #e5e7eb;
}

.table-modern td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #f1f5f9;
  color: #111827;
}

.table-modern tbody tr:hover {
  background: #f9fafb;
}

.table-modern tbody tr:last-child td {
  border-bottom: none;
}

.table-total {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  font-weight: 600;
}

.table-total td {
  border-top: 2px solid #bfdbfe;
  color: #1e40af;
}

/* Period Badges */
.period-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.period-p1 { background: #fef3c7; color: #92400e; }
.period-p2 { background: #dbeafe; color: #1e40af; }
.period-p3 { background: #d1fae5; color: #065f46; }
.period-p4 { background: #fce7f3; color: #9f1239; }
.period-p5 { background: #e0e7ff; color: #3730a3; }
.period-p6 { background: #fef3c7; color: #92400e; }

/* Pill */
.pill {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  font-size: 0.8125rem;
  font-weight: 500;
}

.pill-sug {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3;
}

/* Utilities */
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.text-end {
  text-align: right;
}

.muted {
  color: #6b7280;
}

.text-danger {
  color: #ef4444;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .page {
    padding: 1rem;
  }

  .head {
    flex-direction: column;
    gap: 1rem;
  }

  .head-actions {
    width: 100%;
  }

  .btn-back {
    width: 100%;
    justify-content: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .cards-grid {
    grid-template-columns: 1fr;
  }
}

/* PDF Modal */
.pdf-modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
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

.pdf-toolbar .btn,
.pdf-toolbar .btn-ghost {
  margin-left: .25rem;
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

.btn-pdf {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid #2563eb;
  border-radius: 0.5rem;
  background: #2563eb;
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-pdf:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #1d4ed8;
}

.btn-pdf:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.btn-pdf svg {
  flex-shrink: 0;
}

.btn-ghost {
  background: transparent;
  border: 1px solid transparent;
  color: #e5e7eb;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}

.btn-ghost:hover {
  border-color: #374151;
}

.btn-ghost-p:hover {
  border: 1px solid #374151 !important;
  background: #111827 !important;
}

.btn-ghost-custom2 {
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #111827;
}

.btn-ghost-custom2:hover {
  border-radius: .5rem;
  background: #111827;
  color: #fff;
}

.link-document {
  color: #2563eb;
  text-decoration: none;
  cursor: pointer;
  font-weight: 500;
}

.link-document:hover {
  color: #1d4ed8;
  text-decoration: underline;
}
</style>

