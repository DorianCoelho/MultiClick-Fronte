<template>
    <DashboardLayout>
        <div class="suggestions-page">
            <header class="header">
                <h1>Propuestas</h1>
                <p class="muted">Listado de propuestas del cliente</p>
            </header>

            <!-- Controles -->
            <section class="controls">
                <input v-model="search" type="search" class="input" placeholder="Buscar propuesta"
                    aria-label="Buscar" />

                <select v-model="filters.status" class="select" aria-label="Filtrar por estado">
                    <option value="">Todos los estados</option>
                    <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
                </select>

                <select v-model="filters.productType" class="select"
                    aria-label="Filtrar por tipo de producto (cliente)">
                    <option value="">Todos los tipos</option>
                    <option v-for="t in productTypeOptions" :key="t" :value="t">{{ t }}</option>
                </select>

                <button class="btn" @click="resetFilters">Limpiar</button>
            </section>

            <!-- Tabla -->
            <section class="card">
                <div class="table-scroll">
                    <table class="table">
                        <thead>
                            <tr>
                                <th @click="toggleSort('proposalNo')" :class="thClass('proposalNo')">Propuesta</th>
                                <th @click="toggleSort('contractNo')" :class="thClass('contractNo')">Contrato</th>
                                <th @click="toggleSort('marketerName')" :class="thClass('marketerName')">
                                    Comercializadora</th>
                                <th @click="toggleSort('customerCups')" :class="thClass('customerCups')">CUPS</th>
                                <th @click="toggleSort('product')" :class="thClass('product')">Producto</th>
                                <!--<th @click="toggleSort('startDate')" :class="thClass('startDate')">Inicio</th>-->
                                <th @click="toggleSort('status')" :class="thClass('status')">Estado</th>
                                <th @click="toggleSort('createdAt')" :class="thClass('createdAt')">Creada</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr v-for="row in pagedClientRows" :key="row.proposalNo">
                                <td>
                                    <button class="link-like mono" @click="goDetails(row)">{{ row.proposalNo }}</button>
                                    <small class="muted d-block">Agente: {{ row.agentName }}</small>
                                </td>
                                <td class="mono">{{ row.contractNo || '—' }}</td>
                                <td>{{ row.marketerName }}</td>
                                <td class="mono">
                                    <span v-if="row.multicups" class="badge-multicups">MULTICUPS</span>
                                    <span v-else>{{ row.customerCups }}</span>
                                </td>
                                <td>
                                    <div class="prod">
                                        <span class="tag" :class="(row.productType || 'na').toLowerCase()">
                                            {{ row.productType || '—' }}
                                        </span>
                                        <!-- <span class="prod-name">{{ row.rate || '—' }} <small>{{ row.times || ''
                                                }}</small></span> -->
                                        <span class="prod-name">{{ row.rate || '—' }}</span>
                                    </div>
                                </td>

                                <!-- <td>{{ formatDate(row.startDate) }}</td> -->
                                <td>
                                    <span class="pill" :class="statusClass(row.status)">{{ row.status }}</span>
                                </td>
                                <td>{{ formatDate(row.createdAt) }}</td>
                                <td class="actions">
                                    <button class="icon-btn" @click="viewDetails(row)" aria-label="Ver detalles"
                                        title="Ver detalles">
                                        <!-- Lupa (SVG inline) -->
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" />
                                            <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="1.8"
                                                stroke-linecap="round" />
                                        </svg>
                                        <span class="sr-only">Ver detalles</span>
                                    </button>
                                    <!-- Ver PDF en modal -->
                                    <button 
                                        class="icon-btn" 
                                        :class="{ 'loading': pdfLoadingRows.has(row.proposalNo || row.ProposalNo) }"
                                        :disabled="pdfLoadingRows.has(row.proposalNo || row.ProposalNo)"
                                        :title="pdfLoadingRows.has(row.proposalNo || row.ProposalNo) ? 'Cargando PDF...' : 'Ver PDF'"
                                        @click="openPdfModal(row)">
                                        <!-- Icono documento -->
                                        <svg v-if="!pdfLoadingRows.has(row.proposalNo || row.ProposalNo)" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
                                                stroke="currentColor" stroke-width="2" fill="none" />
                                            <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" fill="none" />
                                        </svg>
                                        <svg v-else class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none">
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416" fill="none" opacity="0.3"/>
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="23.562" fill="none"/>
                                        </svg>
                                    </button>
                                    <!--Enviar -->
                                    <button class="icon-btn" @click="sendToBtp(row)"
                                        :disabled="sending.has(row.proposalNo)"
                                        :title="sending.has(row.proposalNo) ? 'Enviando…' : 'Enviar'"
                                        :aria-busy="sending.has(row.proposalNo)">
                                        <svg v-if="!sending.has(row.proposalNo)" viewBox="0 0 24 24" width="18"
                                            height="18" aria-hidden="true">
                                            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                        </svg>
                                        <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
                                            class="spin">
                                            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"
                                                stroke-width="3" stroke-linecap="round" stroke-dasharray="56"
                                                stroke-dashoffset="28" />
                                        </svg>
                                    </button>
                                </td>
                            </tr>

                            <tr v-if="!loading && pagedClientRows.length === 0">
                                <td colspan="8" class="empty">No hay resultados.</td>
                            </tr>
                            <tr v-if="loading">
                                <td colspan="8" class="empty">Cargando…</td>
                            </tr>
                            <tr v-if="error">
                                <td colspan="8" class="empty text-danger">{{ error }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Paginación (servidor) -->
                <div class="pagination">
                    <button class="btn" :disabled="page === 1 || loading" @click="page--">Anterior</button>
                    <span>Página {{ page }} / {{ totalPages }}</span>
                    <button class="btn" :disabled="page === totalPages || totalPages === 0 || loading"
                        @click="page++">Siguiente</button>

                    <select v-model.number="pageSize" class="select compact" :disabled="loading"
                        aria-label="Elementos por página">
                        <option :value="10">10</option>
                        <option :value="20">20</option>
                        <option :value="50">50</option>
                    </select>
                </div>
                <!-- MODAL PDF -->
                <div v-if="showPdf" class="pdf-modal" @keydown.esc="closePdf" tabindex="0">
                    <div class="pdf-toolbar">
                        <div class="left">
                            <strong class="mono">PDF · {{ currentPdfId || '—' }}</strong>
                        </div>
                        <div class="right">
                            <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener" class="btn-ghost">Abrir en
                                pestaña</a>
                            <button class="btn-ghost" @click="downloadFromModal" :disabled="!pdfUrl">Descargar</button>
                            <button class="btn" @click="closePdf">Cerrar ✕</button>
                        </div>
                    </div>

                    <div class="pdf-body">
                        <div v-if="pdfLoading" class="pdf-center muted">Cargando PDF…</div>
                        <div v-else-if="pdfError" class="pdf-center text-danger">{{ pdfError }}</div>
                        <iframe v-else class="pdf-frame" :src="pdfUrl" title="Documento PDF"></iframe>
                    </div>
                </div>
            </section>
        </div>
        <!-- Toast -->
        <teleport to="body">
            <transition name="toast-fade">
                <div v-if="toast.show" class="app-toast" role="status" aria-live="polite">
                    <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path fill="currentColor"
                            d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
                    </svg>
                    <span>{{ toast.text }}</span>
                    <button class="app-toast__close" @click="toast.show = false" aria-label="Cerrar">×</button>
                </div>
            </transition>
        </teleport>
    </DashboardLayout>
</template>




<script setup>

import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import config from '@/config/env'

const showPdf = ref(false)
const pdfUrl = ref(null)
const pdfLoading = ref(false)
const pdfError = ref('')
const currentPdfId = ref(null)
const pdfLoadingRows = reactive(new Set()) // Para rastrear qué fila está cargando
const sending = reactive(new Set())
const toast = reactive({ show: false, text: '', type: 'success' }) // type: 'success' | 'error'
let toastTimer

function showToast(text, type = 'success', ms = 2200) {

    clearTimeout(toastTimer)
    toast.text = text
    toast.type = type
    toast.show = true

    toastTimer = setTimeout(() => { toast.show = false }, ms)
}

function normalizeStatus(s) {
    return (s || '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
}

function isPendingAcceptance(s) {
    const v = normalizeStatus(s)
    return v.includes('pendiente') && v.includes('acept')
}

// Soporta ISO y dd/MM/yyyy (con o sin hora)
function toDateSafe(val) {
    if (!val) return null
    const t = Date.parse(val)
    if (!Number.isNaN(t)) return new Date(t)
    const m = String(val).match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
    if (!m) return null
    const [, dd, mm, yyyy, HH = '00', MM = '00', SS = '00'] = m
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM), Number(SS))
}

function hoursFrom(dateLike) {
    const d = toDateSafe(dateLike)
    if (!d) return null
    return (Date.now() - d.getTime()) / 36e5
}

async function sendToBtp(row) {
  const id = row?.proposalNo || row?.ProposalNo
  if (!id) return

  // Validaciones de estado/caducidad
  const status    = row?.status    || row?.Status
  const createdAt = row?.createdAt || row?.CreatedAt

  const pending  = isPendingAcceptance(status)
  const hoursOld = hoursFrom(createdAt)
  const isOld60h = hoursOld != null && hoursOld > 60

  if (!pending || isOld60h) {
    let msg
    if (!pending && isOld60h) {
      msg = 'La propuesta ya no está en estado "Pendiente de aceptación" y además está caducada.'
    } else if (!pending) {
      msg = 'La propuesta ya no está en estado "Pendiente de aceptación".'
    } else {
      msg = 'La propuesta ya está caducada.'
    }
    showToast(msg, 'error', 4000)
    return
  }

  // Evita doble click
  if (sending.has(id)) return

  try {
    sending.add(id)
    await api.get(`/v1/ProposalCliente/ProposalSendToBtp/${encodeURIComponent(id)}`)
    showToast('Propuesta enviada correctamente.', 'success')
    // opcional: await load()
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo enviar la propuesta!', 'error', 4000)
  } finally {
    sending.delete(id)
  }
}




function revokePdfUrl() {
    if (pdfUrl.value) {
        URL.revokeObjectURL(pdfUrl.value)
        pdfUrl.value = null
    }
}

function base64ToBlobUrl(base64, mime = 'application/pdf') {
    // Construye Blob a partir de base64
    const binStr = atob(base64)
    const len = binStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })
    return URL.createObjectURL(blob)
}

async function openPdfModal(row) {
    const id = row?.proposalNo || row?.ProposalNo
    if (!id) return
    
    // Usar proposalNo como clave única para esta fila específica
    const key = id
    if (pdfLoadingRows.has(key)) return

    pdfLoadingRows.add(key)
    pdfLoading.value = true
    pdfError.value = ''
    currentPdfId.value = id
    revokePdfUrl() // limpia si había uno anterior

    try {
        const url = `/v1/ProposalCliente/ProposalPdf/${encodeURIComponent(id)}/false`
        // Pedimos como texto para evitar problemas con JSON
        const { data } = await api.get(url, { responseType: 'text' })

        // data puede venir como string JSON con comillas -> intenta parsear
        let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
        if (!base64) throw new Error('PDF vacío')
        if (base64.startsWith('"')) {
            try { base64 = JSON.parse(base64) } catch { }
        }

        pdfUrl.value = base64ToBlobUrl(base64)
        showPdf.value = true

        // Foco para que ESC funcione
        requestAnimationFrame(() => {
            const el = document.querySelector('.pdf-modal')
            if (el && el.focus) el.focus()
        })
    } catch (e) {
        pdfError.value = e?.response?.data?.message || e?.message || 'No se pudo cargar el PDF'
        showPdf.value = true
    } finally {
        pdfLoading.value = false
        pdfLoadingRows.delete(key)
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
    document.body.appendChild(a)
    a.click()
    a.remove()
}

function onKey(e) {
    if (e.key === 'Escape' && showPdf.value) closePdf()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

const router = useRouter()




// ===== Auth / customerNo =====
const auth = useAuthStore()
// usa el campo que tengas disponible
const customerNo = computed(() =>
    auth.user?.id || auth.user?.nameUser || auth.user?.id || ''
)

function toOrderByEnum(by, dir) {
    const desc = dir === 'desc'
    switch (by) {
        case 'proposalNo': return desc ? 'ProposalNoDesc' : 'ProposalNo'
        case 'marketerName': return desc ? 'MarketerNameDesc' : 'MarketerName'
        case 'customerPhoneNo': return desc ? 'CustomerPhoneNoDesc' : 'CustomerPhoneNo'
        case 'customerVatRegistrationNo': return desc ? 'CustomerVatRegistrationNoDesc' : 'CustomerVatRegistrationNo'
        case 'customerName': return desc ? 'CustomerNameDesc' : 'CustomerName'
        case 'status': return desc ? 'StatusDesc' : 'Status'
        case 'contractNo': return desc ? 'ContractNoDesc' : 'ContractNo'
        case 'acceptanceMethod': return desc ? 'AcceptanceMethodDesc' : 'AcceptanceMethod'
        case 'acceptanceSend': return desc ? 'AcceptanceSendDesc' : 'AcceptanceSend'
        case 'dateProposal': return desc ? 'DateProposalDesc' : 'DateProposal'
        case 'feeGroupId': return desc ? 'FeeGroupIdDesc' : 'FeeGroupId'
        case 'product': return desc ? 'ProductDesc' : 'Product'
        default: return desc ? 'ProposalNoDesc' : 'ProposalNo'
    }
}

// ===== Estado =====
const loading = ref(false)
const error = ref('')
const rows = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)

const search = ref('')
const filters = reactive({ status: '', productType: '' })

const sortState = reactive({ by: 'proposalNo', dir: 'desc' })

// clases del <th>
const thClass = (key) => ({
    sortable: true,
    active: sortState.by === key,
    asc: sortState.by === key && sortState.dir === 'asc',
    desc: sortState.by === key && sortState.dir === 'desc',
})

// selects
const statusOptions = ['Aceptado', 'Pendiente de aceptación', 'Fuera de tiempo', 'Rechazado']
const productTypeOptions = ['Omip', 'Index']

// ===== Helpers =====
function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}
function statusClass(s) {
    const k = (s || '').toLowerCase()
    return {
        'pill-draft': k.includes('borr') || k.includes('draft'),
        'pill-pending': k.includes('pend'),
        'pill-signed': k.includes('firm') || k.includes('sign'),
        'pill-rejected': k.includes('rech') || k.includes('reject'),
        'pill-expired': k.includes('cadu') || k.includes('expir'),
    }
}

// Normaliza ProposalDto -> fila de tabla (incluye multicups)
function mapProposal(p) {
    return {
        proposalNo: p.proposalNo ?? p.ProposalNo,
        contractNo: p.contractNo ?? p.ContractNo,
        createdAt: p.createdAt ?? p.CreatedAt,
        customerCups: p.customerCups ?? p.CustomerCups,
        agentName: p.agentName ?? p.AgentName,
        marketerName: p.marketerName ?? p.MarketerName,
        status: p.status ?? p.Status,
        productType: p.productType ?? p.ProductType,
        rate: p.rate ?? p.Rate,
        times: p.times ?? p.Times,
        multicups: p.multicups ?? p.Multicups ?? false,
    }
}

// ===== Carga desde API =====
async function load() {
    error.value = ''
    if (!customerNo.value) { rows.value = []; totalCount.value = 0; return }
    loading.value = true
    try {
        const orderByParam = toOrderByEnum(sortState.by, sortState.dir)
        const { data } = await api.get('/v1/ProposalCliente/ProposalList', {
            params: {
                customerNo: customerNo.value,
                pageNumber: page.value,
                pageSize: pageSize.value,
                searchProposal: (search.value || undefined),
                status: (filters.status || undefined),
                marketer: config.MARKETER,
                orderBy: orderByParam
            }
        })
        const count = data?.count ?? data?.Count ?? 0
        const items = data?.items ?? data?.Items ?? []
        totalCount.value = Number(count) || 0
        rows.value = items.map(mapProposal)
    } catch (e) {
        error.value = e?.response?.data?.message || e?.message || 'No se pudo cargar la lista'
        rows.value = []
        totalCount.value = 0
    } finally {
        loading.value = false
    }
}

const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value))

// Filtro cliente (solo productType)
const clientFiltered = computed(() => {
    const type = (filters.productType || '').toLowerCase()
    return type ? rows.value.filter(r => (r.productType || '').toLowerCase() === type) : rows.value
})

// Orden cliente (sobre la página recibida)
const clientSorted = computed(() => {
    const arr = [...clientFiltered.value]
    const { by, dir } = sortState
    const factor = dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
        let va = a[by], vb = b[by]
        if (by === 'createdAt') { va = va ? new Date(va).getTime() : 0; vb = vb ? new Date(vb).getTime() : 0 }
        if (by === 'product') {
            va = `${a.productType || ''} ${a.rate || ''} ${a.times || ''}`.toLowerCase()
            vb = `${b.productType || ''} ${b.rate || ''} ${b.times || ''}`.toLowerCase()
        }
        if (va < vb) return -1 * factor
        if (va > vb) return 1 * factor
        return 0
    })
    return arr
})

const pagedClientRows = computed(() => clientSorted.value)

function resetFilters() {
    search.value = ''
    filters.status = ''
    filters.productType = ''
    page.value = 1
}

function toggleSort(key) {
    if (sortState.by === key) sortState.dir = (sortState.dir === 'asc' ? 'desc' : 'asc')
    else { sortState.by = key; sortState.dir = 'asc' }
}

// Navegación a detalles según multicups
function goDetails(row) {
    const id = row.proposalNo
    if (!id) return
    router.push({ name: row.multicups ? 'ProposalDetailsMulti' : 'ProposalDetails', params: { proposalId: id } })
}
function viewDetails(row) { goDetails(row) }

// Debounce búsqueda + filtro de estado (servidor)
let t
watch([search, () => filters.status], () => {
    clearTimeout(t)
    t = setTimeout(() => { page.value = 1; load() }, 300)
})
watch([() => sortState.by, () => sortState.dir], () => { page.value = 1; load() })
watch([page, pageSize], () => { load() })

onMounted(load)
</script>

<style scoped>
.suggestions-page {
    display: grid;
    gap: 1rem;
    padding: 1rem;
}

.header h1 {
    margin: 0;
    font-size: 1.4rem;
}

.muted {
    color: #6b7280;
    margin: .25rem 0 0;
}

.controls {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    align-items: center;
}

.input,
.select {
    padding: .5rem .6rem;
    border: 1px solid #d1d5db;
    border-radius: .5rem;
    min-width: 220px;
}

.select.compact {
    min-width: 80px;
}

.btn {
    padding: .5rem .75rem;
    border: 1px solid #d1d5db;
    border-radius: .5rem;
    background: #f9fafb;
    cursor: pointer;
}

.btn:disabled {
    opacity: .6;
    cursor: not-allowed;
}

.btn-ghost {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: .25rem .5rem;
}

.btn-ghost:hover {
    text-decoration: underline;
}

.card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: .75rem;
    overflow: hidden;
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
    padding: .65rem .75rem;
    border-bottom: 1px solid #f1f5f9;
    white-space: nowrap;
}

.table thead th {
    position: sticky;
    top: 0;
    background: #f8fafc;
    cursor: pointer;
}

.table thead th.sortable::after {
    content: ' ⇅';
    opacity: .35;
}

.table thead th.active.asc::after {
    content: ' ↑';
    opacity: .8;
}

.table thead th.active.desc::after {
    content: ' ↓';
    opacity: .8;
}

.prod {
    display: flex;
    align-items: center;
    gap: .5rem;
}

.tag {
    font-size: .75rem;
    padding: .2rem .45rem;
    border-radius: .5rem;
    border: 1px solid #e5e7eb;
}

.tag.baseload {
    background: #ecfeff;
    border-color: #a5f3fc;
}

.tag.peakload {
    background: #fef3c7;
    border-color: #fcd34d;
}

.tag.index {
    background: #eef2ff;
    border-color: #c7d2fe;
}

.tag.fixed {
    background: #f0fdf4;
    border-color: #bbf7d0;
}

.prod-name {
    font-weight: 600;
}

.pill {
    padding: .2rem .5rem;
    border-radius: 999px;
    font-size: .75rem;
    border: 1px solid #e5e7eb;
}

.pill-draft {
    background: #f3f4f6;
}

.pill-pending {
    background: #fef9c3;
}

.pill-signed {
    background: #dcfce7;
}

.pill-rejected {
    background: #fee2e2;
}

.pill-expired {
    background: #e5e7eb;
}

.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.empty {
    text-align: center;
    padding: 1rem;
    color: #6b7280;
}

.pagination {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .75rem;
    justify-content: flex-end;
}

.text-danger {
    color: #ef4444;
}

.badge-multicups {
    display: inline-block;
    padding: .15rem .45rem;
    border-radius: .5rem;
    font-size: .75rem;
    font-weight: 600;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    color: #3730a3;
}

.link-like {
    background: none;
    border: none;
    padding: 0;
    color: #2563eb;
    cursor: pointer;
    text-decoration: underline;
}

.link-like:hover {
    opacity: .85;
}

/* opcional util */
.d-block {
    display: block;
}

.actions {
    display: flex;
    align-items: center;
    gap: .25rem;
}

.icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: .5rem;
    cursor: pointer;
    color: #6b7280;
    /* gris */
}

.icon-btn:hover {
    background: #f3f4f6;
    color: #111827;
}

/* hover más oscuro */

.icon-btn svg {
    width: 18px;
    height: 18px;
}

.sr-only {
    position: absolute !important;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 1px, 1px);
    white-space: nowrap;
    border: 0;
}

.actions {
    display: flex;
    align-items: center;
    gap: .25rem;
}

.icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    border-radius: .5rem;
    cursor: pointer;
    color: #6b7280;
}

.icon-btn:hover {
    background: #f3f4f6;
    color: #111827;
}

.icon-btn[disabled] {
    opacity: .5;
    cursor: not-allowed;
}

.icon-btn svg {
    width: 18px;
    height: 18px;
}

.sr-only {
    position: absolute !important;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 1px, 1px);
    white-space: nowrap;
    border: 0;
}

.icon-btn {
    background: transparent;
    border: none;
    padding: .25rem;
    cursor: pointer;
    color: #374151;
}

.icon-btn:hover {
    color: #111827;
}

/* Modal */
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

/* Reusa botones existentes si quieres */
.btn-ghost {
    background: transparent;
    border: 1px solid transparent;
    color: #e5e7eb;
    cursor: pointer;
}

.btn-ghost:hover {
    border-color: #374151;
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

.icon-btn .spinner {
    animation: spin 1s linear infinite;
}

.spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* SIN scoped */
.app-toast {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    /* arriba de todo */
    display: inline-flex;
    align-items: center;
    gap: .5rem;
    max-width: min(92vw, 420px);
    padding: .55rem .75rem;
    border-radius: .75rem;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #111827;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .12);
}

.app-toast svg {
    flex: 0 0 18px;
}

.app-toast__close {
    margin-left: .25rem;
    border: none;
    background: transparent;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    opacity: .7;
}

.app-toast__close:hover {
    opacity: 1;
}

/* variantes */
.app-toast--success {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
}

.app-toast--error {
    border-color: #fecaca;
    background: #fef2f2;
    color: #991b1b;
}

/* transición */
.toast-fade-enter-from,
.toast-fade-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
    transition: all .2s ease;
}
</style>