<template>
    <DashboardLayout>
        <div class="page">
            <!-- Header -->
            <header class="head">
                <div class="title-wrap">
                    <h1>Propuesta N.º {{ p.proposalNo || '—' }} · <span class="badge-multi">MULTICUPS</span></h1>
                    <div class="sub">
                        <span class="pill" :class="`pill-${(p.productType || 'omip').toLowerCase()}`">{{ p.productType
                            ||
                            'Omip' }}</span>
                        <span class="sep">•</span>
                        <strong>Creación:</strong> {{ fmtDate(p.dateProposal) }}
                        <span class="sep">•</span>
                        <strong>Inicio:</strong> {{ fmtDate(p.startDate) }}
                        <span class="sep">•</span>
                        <strong>Estado:</strong> <span class="pill pill-status">{{ p.status || '—' }}</span>
                    </div>
                </div>
                <div class="head-actions">
                    <button 
                        v-if="p.proposalNo"
                        class="btn btn-pdf" 
                        @click="openPdfModal"
                        :disabled="pdfLoading">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                            <path d="M14 2v6h6"/>
                        </svg>
                        {{ pdfLoading ? 'Cargando...' : 'Ver PDF' }}
                    </button>
                </div>
            </header>

            <!-- Loading / Error -->
            <div v-if="loading" class="muted">Cargando…</div>
            <div v-else-if="error" class="text-danger">{{ error }}</div>

            <section v-else class="card p-5">
                <!-- Resumen -->
                <div class="grid grid-3">
                    <div class="row w-25 mb-5">
                        <h3 class="sec text-primary">Datos</h3>
                        <div class="kv col-md-12 ms-3"><span>Propuesta</span><strong class="mono">{{ p.proposalNo
                        }}</strong>
                        </div>
                        <div class="kv col-md-12 ms-3"><span>Creación</span><strong>{{ fmtDate(p.dateProposal)
                        }}</strong>
                        </div>
                        <div class="kv col-md-12 ms-3"><span>Inicio</span><strong>{{ fmtDate(p.startDate) }}</strong>
                        </div>
                        <div class="kv col-md-12 ms-3"><span>Producto</span><strong>{{ p.productType || 'Omip'
                        }}</strong>
                        </div>
                        <div class="kv col-md-12 ms-3" v-if="(p.productType || '').toLowerCase() === 'index'">
                            <span>FEE Energía</span><strong>{{ fmt2((p.feeEnergy || 0) / 1000) }}</strong>
                        </div>
                    </div>
                </div>
                <div class="grid grid-3">
                    <div class="row">
                        <div class="col-md-6">
                            <h3 class="sec text-primary">Cliente</h3>
                            <div class="kv"><span>N.º cliente</span><strong class="mono">{{ p.customerNo || '—'
                            }}</strong>
                            </div>
                            <div class="kv"><span>Nombre</span><strong>{{ p.customerName || '—' }}</strong></div>
                            <div class="kv"><span>Contacto</span><strong>{{ p.acceptanceSend || '—' }}</strong></div>
                            <div class="flags p-5">
                                <label class="flag">
                                    <input type="checkbox" :checked="p.receiveInvoiceElectronically" disabled />
                                    <span>Recibir factura electrónicamente</span>
                                </label>
                                <label class="flag">
                                    <input type="checkbox" :checked="p.sendingCommunications" disabled />
                                    <span>Envío de comunicaciones</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div>
                            <h3 class="sec text-primary">Agente</h3>
                            <div class="kv"><span>N.º agente</span><strong class="mono">{{ p.agentNumber || '—'
                            }}</strong>
                            </div>
                            <div class="kv"><span>Nombre</span><strong>{{ p.agentName || '—' }}</strong></div>

                            <template v-if="p.feeGroupId">
                                <!-- <div class="kv"><span>Grupo</span><strong>{{ p.feeGroupId }}</strong></div> -->
                            </template>
                            <template v-else>
                                <h4 class="sec mt-sm">Fee aplicados</h4>
                                <div class="kv"><span>Potencia</span><strong>{{ fmt2(p.oldFeePotency) }}</strong></div>
                                <div class="kv"><span>Energía</span><strong>{{ fmt2(p.oldFeeEnergy) }}</strong></div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Cabecera comercial -->
                <h3 class="sec mt text-primary"></h3>
                <div class="table-scroll">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Comercializadora</th>
                                <th>Tiempo</th>
                                <th>Tipo</th>
                                <th>Fecha de Inicio</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{{ p.marketerName || '—' }}</td>
                                <td>{{ p.times || '—' }}</td>
                                <td>{{ p.type || '—' }}</td>
                                <td>{{ fmtDate(p.startDate) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- FEE (solo si hay FeeGroupId) -->
                <!-- <template v-if="p.feeGroupId">
                    <h3 class="sec mt text-primary">FEE</h3>
                    <div class="p-5 pt-0">
                        <h6 class="subsec">FEE POTENCIA</h6>
                        <div class="table-scroll">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Tarifa</th>
                                        <th>P1</th>
                                        <th>P2</th>
                                        <th>P3</th>
                                        <th>P4</th>
                                        <th>P5</th>
                                        <th>P6</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(r, i) in p.feePower" :key="'feepow-' + i">
                                        <td>{{ r.rateNo }}</td>
                                        <td>{{ fmt6z(r.p1) }}</td>
                                        <td>{{ fmt6z(r.p2) }}</td>
                                        <td>{{ fmt6z(r.p3) }}</td>
                                        <td>{{ fmt6z(r.p4) }}</td>
                                        <td>{{ fmt6z(r.p5) }}</td>
                                        <td>{{ fmt6z(r.p6) }}</td>
                                    </tr>
                                    <tr v-if="!p.feePower.length">
                                        <td colspan="7" class="empty">Sin datos</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h6 v-if="p.productType === 'Omip'" class="subsec mt-sm">FEE ENERGÍA</h6>
                        <div v-if="p.productType === 'Omip'" class="table-scroll">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Tarifa</th>
                                        <th>P1</th>
                                        <th>P2</th>
                                        <th>P3</th>
                                        <th>P4</th>
                                        <th>P5</th>
                                        <th>P6</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(r, i) in p.feeEnergyList" :key="'feeene-' + i">
                                        <td>{{ r.rateNo }}</td>
                                        <td>{{ fmt6z(r.p1) }}</td>
                                        <td>{{ fmt6z(r.p2) }}</td>
                                        <td>{{ fmt6z(r.p3) }}</td>
                                        <td>{{ fmt6z(r.p4) }}</td>
                                        <td>{{ fmt6z(r.p5) }}</td>
                                        <td>{{ fmt6z(r.p6) }}</td>
                                    </tr>
                                    <tr v-if="!p.feeEnergyList.length">
                                        <td colspan="7" class="empty">Sin datos</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </template> -->

                <!-- MULTICUPS
                <h3 class="sec mt">MULTICUPS</h3>
                <div class="table-scroll">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>CUPS</th>
                                <th>Tarifa</th>
                                <th>P1</th>
                                <th>P2</th>
                                <th>P3</th>
                                <th>P4</th>
                                <th>P5</th>
                                <th>P6</th>
                                <th>Activación</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(r, idx) in p.multiCups" :key="'mc-' + idx">
                                <td>{{ idx + 1 }}</td>
                                <td class="mono">{{ r.customerCups }}</td>
                                <td>{{ r.rateNo }}</td>
                                <td>{{ fmt6z(r.p1) }}</td>
                                <td>{{ fmt6z(r.p2) }}</td>
                                <td>{{ fmt6z(r.p3) }}</td>
                                <td>{{ fmt6z(r.p4) }}</td>
                                <td>{{ fmt6z(r.p5) }}</td>
                                <td>{{ fmt6z(r.p6) }}</td>
                                <td>{{ r.activationDate ? fmtDate(r.activationDate) : '—' }}</td>
                            </tr>
                            <tr v-if="!p.multiCups.length">
                                <td colspan="10" class="empty">Sin CUPS asociados</td>
                            </tr>
                        </tbody>
                    </table>
                </div> -->

                <!-- PRECIOS -->
                <h3 class="sec mt text-primary">PRECIOS</h3>
                <div class="p-5 pt-0">

                    <h6 class="subsec">PRECIO POTENCIA</h6>
                    <div class="table-scroll">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Tarifa</th>
                                    <th>P1</th>
                                    <th>P2</th>
                                    <th>P3</th>
                                    <th>P4</th>
                                    <th>P5</th>
                                    <th>P6</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in p.power" :key="'pow-' + i">
                                    <td>{{ r.rateNo }}</td>
                                    <td>{{ fmt6z(r.p1) }}</td>
                                    <td>{{ fmt6z(r.p2) }}</td>
                                    <td>{{ fmt6z(r.p3) }}</td>
                                    <td>{{ fmt6z(r.p4) }}</td>
                                    <td>{{ fmt6z(r.p5) }}</td>
                                    <td>{{ fmt6z(r.p6) }}</td>
                                </tr>
                                <tr v-if="!p.power.length">
                                    <td colspan="7" class="empty">Sin datos</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- <h6 class="subsec mt-sm">PRECIO ENERGÍA</h6>
                    <div class="table-scroll">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Año</th>
                                    <th>P1</th>
                                    <th>P2</th>
                                    <th>P3</th>
                                    <th>P4</th>
                                    <th>P5</th>
                                    <th>P6</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in energyYears" :key="'ene-' + i">
                                    <td>Año {{ i + 1 }}</td>
                                    <td>{{ fmt6z(r.p1) }}</td>
                                    <td>{{ fmt6z(r.p2) }}</td>
                                    <td>{{ fmt6z(r.p3) }}</td>
                                    <td>{{ fmt6z(r.p4) }}</td>
                                    <td>{{ fmt6z(r.p5) }}</td>
                                    <td>{{ fmt6z(r.p6) }}</td>
                                </tr>
                                <tr v-if="!energyYears.length">
                                    <td colspan="7" class="empty">Sin datos</td>
                                </tr>
                            </tbody>
                        </table>
                    </div> -->
                </div>

                <!-- INFORMACIÓN CONSUMOS -->
                <h3 class="sec mt text-primary">INFORMACIÓN CONSUMOS</h3>
                <div class="p-5 pt-0">
                    <h6 class="subsec">TÉRMINO DE POTENCIA CONTRATADA</h6>
                    <div class="table-scroll">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>CUPS</th>
                                    <th>P1</th>
                                    <th>P2</th>
                                    <th>P3</th>
                                    <th>P4</th>
                                    <th>P5</th>
                                    <th>P6</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in p.contractedPower" :key="'cp-' + i">
                                    <td></td>
                                    <td class="mono">{{ r.cups }}</td>
                                    <td>{{ fmt2z(r.p1) }}</td>
                                    <td>{{ fmt2z(r.p2) }}</td>
                                    <td>{{ fmt2z(r.p3) }}</td>
                                    <td>{{ fmt2z(r.p4) }}</td>
                                    <td>{{ fmt2z(r.p5) }}</td>
                                    <td>{{ fmt2z(r.p6) }}</td>
                                </tr>
                                <tr v-if="!p.contractedPower.length">
                                    <td colspan="8" class="empty">Sin datos</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h6 class="subsec mt-sm">CONSUMO ANUAL DECLARADO</h6>
                    <div class="table-scroll">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>CUPS</th>
                                    <th>P1</th>
                                    <th>P2</th>
                                    <th>P3</th>
                                    <th>P4</th>
                                    <th>P5</th>
                                    <th>P6</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(r, i) in p.consumptionDeclared" :key="'cd-' + i">
                                    <td></td>
                                    <td class="mono">{{ r.cups }}</td>
                                    <td>{{ fmt2z(r.p1) }}</td>
                                    <td>{{ fmt2z(r.p2) }}</td>
                                    <td>{{ fmt2z(r.p3) }}</td>
                                    <td>{{ fmt2z(r.p4) }}</td>
                                    <td>{{ fmt2z(r.p5) }}</td>
                                    <td>{{ fmt2z(r.p6) }}</td>
                                </tr>
                                <tr v-if="!p.consumptionDeclared.length">
                                    <td colspan="8" class="empty">Sin datos</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </section>
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

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'

const route = useRoute()

const loading = ref(false)
const error = ref('')
const raw = ref(null)

/* ---------------- Normalizadores ---------------- */
const n = (x) => x ?? undefined
const nn = (x) => (x == null ? null : Number(x))

const normLine = (x) => ({
    rateNo: n(x?.rateNo ?? x?.RateNo) || '—',
    p1: nn(x?.p1 ?? x?.P1),
    p2: nn(x?.p2 ?? x?.P2),
    p3: nn(x?.p3 ?? x?.P3),
    p4: nn(x?.p4 ?? x?.P4),
    p5: nn(x?.p5 ?? x?.P5),
    p6: nn(x?.p6 ?? x?.P6),
})

const normEnergy = (x) => ({
    rateNo: n(x?.rateNo ?? x?.RateNo) || '—',
    times: n(x?.times ?? x?.Times),
    p1: nn(x?.p1 ?? x?.P1),
    p2: nn(x?.p2 ?? x?.P2),
    p3: nn(x?.p3 ?? x?.P3),
    p4: nn(x?.p4 ?? x?.P4),
    p5: nn(x?.p5 ?? x?.P5),
    p6: nn(x?.p6 ?? x?.P6),
})

const normMulti = (x) => ({
    customerCups: n(x?.customerCUPS ?? x?.CustomerCUPS ?? x?.customerCups ?? x?.CustomerCups) || '—',
    rateNo: n(x?.rateNo ?? x?.RateNo) || '—',
    p1: nn(x?.p1 ?? x?.P1),
    p2: nn(x?.p2 ?? x?.P2),
    p3: nn(x?.p3 ?? x?.P3),
    p4: nn(x?.p4 ?? x?.P4),
    p5: nn(x?.p5 ?? x?.P5),
    p6: nn(x?.p6 ?? x?.P6),
    activationDate: n(x?.activationDate ?? x?.ActivationDate),
})

const normCupsQty = (x) => ({
    cups: n(x?.cups ?? x?.Cups) || '—',
    p1: nn(x?.p1 ?? x?.P1),
    p2: nn(x?.p2 ?? x?.P2),
    p3: nn(x?.p3 ?? x?.P3),
    p4: nn(x?.p4 ?? x?.P4),
    p5: nn(x?.p5 ?? x?.P5),
    p6: nn(x?.p6 ?? x?.P6),
})

const normalize = (d = {}) => ({
    proposalNo: n(d.proposalNo ?? d.ProposalNo),
    dateProposal: n(d.dateProposal ?? d.DateProposal),
    startDate: n(d.startDate ?? d.StartDate),
    productType: n(d.productType ?? d.ProductType),
    times: n(d.times ?? d.Times),
    type: n(d.type ?? d.Type),
    marketerName: n(d.marketerName ?? d.MarketerName),
    status: n(d.status ?? d.Status),

    customerNo: n(d.customerNo ?? d.CustomerNo),
    customerName: n(d.customerName ?? d.CustomerName),
    acceptanceSend: n(d.acceptanceSend ?? d.AcceptanceSend),
    receiveInvoiceElectronically: !!(d.receiveInvoiceElectronically ?? d.ReceiveInvoiceElectronically),
    sendingCommunications: !!(d.sendingCommunications ?? d.SendingCommunications),

    agentNumber: n(d.agentNumber ?? d.AgentNumber),
    agentName: n(d.agentName ?? d.AgentName),

    feeGroupId: n(d.feeGroupId ?? d.FeeGroupId),
    feeEnergy: nn(d.feeEnergy ?? d.FeeEnergy),
    feePotency: nn(d.feePotency ?? d.FeePotency),
    oldFeeEnergy: nn(d.oldFeeEnergy ?? d.OldFeeEnergy),
    oldFeePotency: nn(d.oldFeePotency ?? d.OldFeePotency),

    // Líneas
    power: (d.sucOmipPowerEntry ?? d.SucOmipPowerEntry ?? []).map(normLine),
    energy: (d.sucOmipEnergyEntry ?? d.SucOmipEnergyEntry ?? []).map(normEnergy),
    feeEnergyList: (d.feeEnergyDocLists ?? d.FEEEnergyDocLists ?? []).map(normLine),
    feePower: (d.feePowerDocLists ?? d.FEEPowerDocLists ?? []).map(normLine),
    contractedPower: (d.contractedPower ?? d.ContractedPower ?? []).map(normCupsQty),
    consumptionDeclared: (d.consumptionDeclared ?? d.ConsumptionDeclared ?? []).map(normCupsQty),
    multiCups: (d.multiCups ?? d.MultiCups ?? []).map(normMulti),
})

const p = computed(() => normalize(raw.value || {}))

/* ---------------- Formateadores ---------------- */
function fmtDate(x) { if (!x) return '—'; const d = new Date(x); return isNaN(d) ? '—' : d.toLocaleDateString('es-ES') }
function fmt2(n) { if (n == null) return '0'; const v = Number(n); return v > 0 ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0' }
function fmt6(n) { if (n == null) return '0.000000'; return Number(n).toFixed(6) }
function fmt6z(n) { const v = Number(n || 0); return v > 0 ? fmt6(v) : '0' }
function fmt2z(n) { const v = Number(n || 0); return v > 0 ? fmt2(v) : '0' }

/* Para energía: solo filas con algún periodo > 0 (como tu Razor) */
const energyYears = computed(() =>
    p.value.energy.filter(r => [r.p1, r.p2, r.p3, r.p4, r.p5, r.p6].some(v => (Number(v || 0) > 0)))
)

/* ---------------- Carga ---------------- */
async function load() {
    loading.value = true; error.value = ''
    try {
        const id = route.params.proposalId
        const { data } = await api.get('/v1/ProposalCliente/ProposalById', { params: { proposalNo: id } })
        raw.value = data
    } catch (e) {
        error.value = e?.response?.data?.message || e?.message || 'No se pudo cargar la propuesta'
    } finally {
        loading.value = false
    }
}
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
  const url = `/v1/ProposalCliente/ProposalPdf/${encodeURIComponent(id)}/false`
  const { data } = await api.get(url, { responseType: 'text' })
  let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
  if (!base64) throw new Error('PDF vacío')
  if (base64.startsWith('"')) {
    try { base64 = JSON.parse(base64) } catch { }
  }
  return base64
}

async function openPdfModal() {
  const id = p.value?.proposalNo
  if (!id) { 
    error.value = 'No hay identificador de PDF para esta propuesta.'
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

function onKey(e) {
  if (e.key === 'Escape' && showPdf.value) closePdf()
}
onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
</script>

<style scoped>
.page {
    display: grid;
    gap: 1rem;
    padding: 1rem
}

.head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap
}

.title-wrap h1 {
    margin: 0;
    font-size: 1.25rem
}

.sub {
    margin-top: .25rem;
    color: #6b7280;
    display: flex;
    gap: .5rem;
    align-items: center;
    flex-wrap: wrap
}

.sep {
    opacity: .5
}

.head-actions {
    display: flex;
    gap: .5rem
}

.card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: .75rem;
    padding: 1rem
}

.sec {
    margin: .25rem 0 .5rem
}

.subsec {
    margin: .25rem 0
}

.mt {
    margin-top: 1rem
}

.mt-sm {
    margin-top: .5rem
}

.grid {
    display: grid;
    gap: 1rem
}

.grid-3 {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))
}

.kv {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: .3rem 0;
    border-bottom: 1px dashed #eef2f7
}

.kv span {
    color: #6b7280
}

.flags {
    display: grid;
    gap: .35rem;
    margin-top: .5rem
}

.flag {
    display: flex;
    align-items: center;
    gap: .5rem;
    color: #374151
}

.flag input {
    pointer-events: none
}

.table {
    width: 100%;
    border-collapse: collapse;
    font-size: .95rem
}

.table th,
.table td {
    padding: .55rem .65rem;
    border-bottom: 1px solid #f1f5f9;
    white-space: nowrap
}

.table thead th {
    background: #f8fafc;
    position: sticky;
    top: 0
}

.table-scroll {
    overflow: auto
}

.empty {
    color: #6b7280;
    text-align: center;
    padding: .5rem
}

.muted {
    color: #6b7280
}

.text-danger {
    color: #ef4444
}

.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace
}

.btn {
    padding: .45rem .75rem;
    border: 1px solid #d1d5db;
    border-radius: .5rem;
    background: #f9fafb;
    cursor: pointer
}

.btn:hover {
    background: #f3f4f6
}

.pill {
    display: inline-block;
    padding: .15rem .45rem;
    border-radius: .5rem;
    border: 1px solid #e5e7eb;
    font-size: .75rem
}

.pill-status {
    background: #eef2ff;
    border-color: #c7d2fe
}

.pill-omip {
    background: #ecfeff;
    border-color: #a5f3fc
}

.pill-index {
    background: #eef2ff;
    border-color: #c7d2fe
}

.badge-multi {
    display: inline-block;
    padding: .05rem .4rem;
    border-radius: .4rem;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #3730a3;
    font-weight: 600;
    font-size: .8rem
}

.btn-pdf {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
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
</style>