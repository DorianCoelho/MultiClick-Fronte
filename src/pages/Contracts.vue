<template>
  <DashboardLayout>
    <div class="contracts-page">
      <header class="header">
        <h1>Contratos</h1>
        <p class="muted">Listado de contratos del cliente</p>
      </header>

      <!-- Controles -->
      <section class="controls">
        <input v-model="search" type="search" class="input" placeholder="Buscar contrato"
               aria-label="Buscar" />

        <select v-model="filters.status" class="select" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
        </select>

        <select v-model="filters.productType" class="select" aria-label="Filtrar por tipo de producto">
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
                <th @click="toggleSort('no')" :class="thClass('no')">Contrato</th>
                <th @click="toggleSort('marketerName')" :class="thClass('marketerName')">Comercializadora</th>
                <th>CUPS</th>
                <th @click="toggleSort('product')" :class="thClass('product')">Producto</th>
                <th @click="toggleSort('status')" :class="thClass('status')">Estado</th>
                <th @click="toggleSort('createdAt')" :class="thClass('createdAt')">Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="row in pagedClientRows" :key="row.no">
                <td>
                  <div class="mono">{{ row.no }}</div>
                  <small class="muted d-block">Agente: {{ row.agentName || '—' }}</small>
                </td>
                <td>{{ row.marketerName || '—' }}</td>
                <td class="mono">
                  <span v-if="row.multicups" class="badge-multicups">MULTICUPS</span>
                  <span v-else>{{ row.customerCups || '—' }}</span>
                </td>
                <td>
                  <div class="prod">
                    <span class="tag" :class="(row.productType || 'na').toLowerCase()">
                      {{ row.productType || '—' }}
                    </span>
                    <span class="prod-name">{{ row.rateNo || '—' }} <small>{{ row.times || '' }}</small></span>
                  </div>
                </td>
                <td><span class="pill" :class="statusClass(row.status)">{{ row.status || '—' }}</span></td>
                <td>{{ formatDate(row.createdAt) }}</td>
                <td class="actions">
                  <!-- Ver PDF en modal -->
                  <button class="icon-btn" @click="openPdfModal(row)" :disabled="pdfLoading" title="Ver PDF">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="2" />
                      <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" />
                    </svg>
                  </button>

                  <!--Enviar -->
                  <button class="icon-btn" @click="sendToBtp(row)"
                          :disabled="sending.has(row.no)"
                          :title="sending.has(row.no) ? 'Enviando…' : 'Enviar'"
                          :aria-busy="sending.has(row.no)">
                    <svg v-if="!sending.has(row.no)" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="spin">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"
                              stroke-linecap="round" stroke-dasharray="56" stroke-dashoffset="28"/>
                    </svg>
                  </button>
                </td>
              </tr>

              <tr v-if="!loading && pagedClientRows.length === 0">
                <td colspan="7" class="empty">No hay resultados.</td>
              </tr>
              <tr v-if="loading">
                <td colspan="7" class="empty">Cargando…</td>
              </tr>
              <tr v-if="error">
                <td colspan="7" class="empty text-danger">{{ error }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="pagination">
          <button class="btn" :disabled="page===1 || loading" @click="page--">Anterior</button>
          <span>Página {{ page }} / {{ totalPages }}</span>
          <button class="btn" :disabled="page===totalPages || totalPages===0 || loading" @click="page++">Siguiente</button>

          <select v-model.number="pageSize" class="select compact" :disabled="loading" aria-label="Elementos por página">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </section>
    </div>

    <!-- MODAL PDF -->
    <div v-if="showPdf" class="pdf-modal" @keydown.esc="closePdf" tabindex="0">
      <div class="pdf-toolbar">
        <div class="left"><strong class="mono">PDF · {{ currentPdfId || '—' }}</strong></div>
        <div class="right">
          <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener" class="btn-ghost">Abrir en pestaña</a>
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

    <!-- Toast -->
     <!-- Toast -->
    <teleport to="body">
  <transition name="toast-fade">
    <div
      v-if="toast.show"
      class="app-toast"
      role="status"
      aria-live="polite"
    >
      <svg v-if="toast.type==='success'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/>
      </svg>
      <span>{{ toast.text }}</span>
      <button class="app-toast__close" @click="toast.show=false" aria-label="Cerrar">×</button>
    </div>
  </transition>
</teleport>
  </DashboardLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/* ======= helpers ======= */
function isPendingStatus(status){
  return String(status || '').toLowerCase().includes('pend')
}
function hoursFrom(dateLike){
  const t = new Date(dateLike).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 36e5
}
function isExpired(row){
  // Prioriza timeLeft del backend si existe
  if (row.timeLeft != null && !Number.isNaN(Number(row.timeLeft))){
    return Number(row.timeLeft) <= 0
  }
  // Si no hay timeLeft, calcula por createdAt
  const h = hoursFrom(row.createdAt)
  return h != null ? h > 60 : false
}

/* ======= Toast ======= */
const toast = reactive({ show: false, text: '', type: 'success' })
let toastTimer
function showToast(text, type='success', ms=2200){
  clearTimeout(toastTimer)
  toast.text = text
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(()=>{ toast.show = false }, ms)
}

/* ======= PDF modal ======= */
const showPdf = ref(false)
const pdfUrl = ref(null)
const pdfLoading = ref(false)
const pdfError = ref('')
const currentPdfId = ref(null)

function revokePdfUrl () {
  if (pdfUrl.value) { URL.revokeObjectURL(pdfUrl.value); pdfUrl.value = null }
}
function base64ToBlobUrl(base64, mime='application/pdf'){
  const binStr = atob(base64); const len = binStr.length
  const bytes = new Uint8Array(len)
  for (let i=0;i<len;i++) bytes[i] = binStr.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  return URL.createObjectURL(blob)
}
async function openPdfModal(row){
  const id = row?.no || row?.No
  if (!id || pdfLoading.value) return
  pdfLoading.value = true; pdfError.value = ''; currentPdfId.value = id; revokePdfUrl()
  try{
    const { data } = await api.get(`/v1/ContractCliente/ContractPdf/${encodeURIComponent(id)}/false`, { responseType: 'text' })
    let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
    if (!base64) throw new Error('PDF vacío')
    if (base64.startsWith('"')) { try { base64 = JSON.parse(base64) } catch {} }
    pdfUrl.value = base64ToBlobUrl(base64)
    showPdf.value = true
    requestAnimationFrame(()=> document.querySelector('.pdf-modal')?.focus())
  }catch(e){
    pdfError.value = e?.response?.data?.message || e?.message || 'No se pudo cargar el PDF'
    showPdf.value = true
  }finally{
    pdfLoading.value = false
  }
}
function closePdf(){ showPdf.value=false; currentPdfId.value=null; pdfError.value=''; revokePdfUrl() }
function downloadFromModal(){
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value; a.download = `${currentPdfId.value || 'contrato'}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
}
function onKey(e){ if (e.key === 'Escape' && showPdf.value) closePdf() }
onMounted(()=> window.addEventListener('keydown', onKey))
onUnmounted(()=> window.removeEventListener('keydown', onKey))

/* =======Enviar ======= */
const sending = ref(new Set())
async function sendToBtp(row){
  const id = row?.no || row?.No
  if (!id || sending.value.has(id)) return

  // —— RESTRICCIONES ——
  if (!isPendingStatus(row.status)){
    showToast('El contrato ya no está en estado "Pendiente de aceptación".', 'error', 3500)
    return
  }
  if (isExpired(row)){
    showToast('El contrato ya está caducado (más de 60 horas).', 'error', 3500)
    return
  }

  try{
    sending.value.add(id)
    await api.get(`/v1/ContractCliente/ContractSendToBtp/${encodeURIComponent(id)}`)
    showToast('Contrato enviado correctamente.', 'success')
  }catch(e){
    showToast(e?.response?.data || e?.message || 'No se pudo enviar el contrato!', 'error', 4500)
  }finally{
    sending.value.delete(id)
  }
}

/* ======= Estado / filtros / orden ======= */
const auth = useAuthStore()
const customerNo = computed(() => auth.user?.id || auth.user?.id || '')

const loading = ref(false)
const error = ref('')
const rows = ref([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)

const search = ref('')
const filters = reactive({ status: '', productType: '' })

const sortState = reactive({ by: 'no', dir: 'desc' })
const thClass = (key) => ({
  sortable: true,
  active: sortState.by === key,
  asc: sortState.by === key && sortState.dir === 'asc',
  desc: sortState.by === key && sortState.dir === 'desc',
})

const statusOptions = ['Aceptado','Pendiente de aceptación','Rechazado','Fuera de tiempo']
const productTypeOptions = ['Omip','Index']

function formatDate(iso){
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}
function statusClass(s){
  const k = (s || '').toLowerCase()
  return {
    'pill-draft':    k.includes('borr') || k.includes('draft'),
    'pill-pending':  k.includes('pend'),
    'pill-signed':   k.includes('firm') || k.includes('sign') || k.includes('activo'),
    'pill-rejected': k.includes('rech'),
    'pill-expired':  k.includes('cadu') || k.includes('expir') || k.includes('inactivo'),
  }
}

/* Map row */
function mapContract(c){
  return {
    no:            c.no ?? c.No,
    createdAt:     c.createdAt ?? c.CreatedAt ?? c.CreatedAtFull,
    timeLeft:      c.timeLeft ?? c.TimeLeft,        // 👈 NUEVO
    customerCups:  c.customerCUPS ?? c.CustomerCUPS,
    agentName:     c.agentName ?? c.AgentName,
    marketerName:  c.marketerName ?? c.MarketerName,
    status:        c.status ?? c.Status,
    productType:   c.productType ?? c.ProductType,
    rateNo:        c.rateNo ?? c.RateNo,
    times:         c.times ?? c.Times,
    multicups:     c.multicups ?? c.Multicups ?? false,
  }
}

/* OrderBy enum mapping (usa lo disponible en ContractsOrderBy) */
function toOrderByEnum(by, dir){
  const desc = dir === 'desc'
  switch (by){
    case 'no':            return desc ? 'NoDesc'      : 'No'
    case 'marketerName':  return desc ? 'MarketerDesc': 'Marketer'
    case 'status':        return desc ? 'StatusDesc'  : 'Status'
    case 'product':       return desc ? 'ProductDesc' : 'Product'
    // No hay CUPS/createdAt en enum → fallback
    default:              return desc ? 'NoDesc'      : 'No'
  }
}

/* Carga API */
async function load(){
  error.value = ''
  if (!customerNo.value){ rows.value = []; totalCount.value = 0; return }
  loading.value = true
  try{
    const orderByParam = toOrderByEnum(sortState.by, sortState.dir)
    const { data } = await api.get('/v1/ContractCliente/ContractList', {
      params: {
        customerNo: customerNo.value,
        pageNumber: page.value,
        pageSize: pageSize.value,
        marketer: "NAB",
        SearchContractNo: (search.value || undefined),
        status: (filters.status || undefined),
        searchProduct: (filters.productType || undefined),
        orderBy: orderByParam
      }
    })
    const count = data?.count ?? data?.Count ?? 0
    const items = data?.items ?? data?.Items ?? []
    totalCount.value = Number(count) || 0
    rows.value = items.map(mapContract)
  }catch(e){
    error.value = e?.response?.data?.message || e?.message || 'No se pudo cargar la lista'
    rows.value = []; totalCount.value = 0
  }finally{
    loading.value = false
  }
}

const totalPages = computed(()=> Math.ceil(totalCount.value / pageSize.value))

/* Filtro cliente por productType */
const clientFiltered = computed(()=>{
  const type = (filters.productType || '').toLowerCase()
  return type ? rows.value.filter(r => (r.productType || '').toLowerCase() === type) : rows.value
})

/* Orden cliente (sobre la página actual) */
const clientSorted = computed(()=>{
  const arr = [...clientFiltered.value]
  const { by, dir } = sortState
  const factor = dir === 'asc' ? 1 : -1
  arr.sort((a,b)=>{
    let va = a[by], vb = b[by]
    if (by === 'createdAt'){
      va = va ? new Date(va).getTime() : 0
      vb = vb ? new Date(vb).getTime() : 0
    }
    if (by === 'product'){
      va = `${a.productType || ''} ${a.rateNo || ''} ${a.times || ''}`.toLowerCase()
      vb = `${b.productType || ''} ${b.rateNo || ''} ${b.times || ''}`.toLowerCase()
    }
    if (va < vb) return -1 * factor
    if (va > vb) return  1 * factor
    return 0
  })
  return arr
})
const pagedClientRows = computed(()=> clientSorted.value)

/* Controles */
function resetFilters(){ search.value=''; filters.status=''; filters.productType=''; page.value=1 }
function toggleSort(key){
  if (sortState.by === key) sortState.dir = (sortState.dir === 'asc' ? 'desc' : 'asc')
  else { sortState.by = key; sortState.dir = 'asc' }
}

/* Watchers */
let t
watch([search, () => filters.status], ()=>{
  clearTimeout(t)
  t = setTimeout(()=> { page.value = 1; load() }, 300)
})
watch([() => sortState.by, () => sortState.dir], ()=> { page.value = 1; load() })
watch([page, pageSize], ()=> { load() })

onMounted(load)
</script>

<style scoped>
/* ——— base (reusa estilos de Suggestions) ——— */
.contracts-page{ display:grid; gap:1rem; padding:1rem; }
.header h1{ margin:0; font-size:1.4rem; }
.muted{ color:#6b7280; margin:.25rem 0 0; }
.controls{ display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
.input,.select{ padding:.5rem .6rem; border:1px solid #d1d5db; border-radius:.5rem; min-width:220px; }
.select.compact{ min-width:80px; }
.btn{ padding:.5rem .75rem; border:1px solid #d1d5db; border-radius:.5rem; background:#f9fafb; cursor:pointer; }
.btn:disabled{ opacity:.6; cursor:not-allowed; }
.btn-ghost{ background:transparent; border:1px solid transparent; color:#111827; cursor:pointer; }
.btn-ghost:hover{ border-color:#e5e7eb; }
.card{ background:#fff; border:1px solid #e5e7eb; border-radius:.75rem; overflow:hidden; }
.table-scroll{ overflow:auto; }
.table{ width:100%; border-collapse:collapse; font-size:.95rem; }
.table th,.table td{ padding:.65rem .75rem; border-bottom:1px solid #f1f5f9; white-space:nowrap; }
.table thead th{ position:sticky; top:0; background:#f8fafc; cursor:pointer; }
.table thead th.sortable::after{ content:' ⇅'; opacity:.35; }
.table thead th.active.asc::after{ content:' ↑'; opacity:.8; }
.table thead th.active.desc::after{ content:' ↓'; opacity:.8; }

.prod{ display:flex; align-items:center; gap:.5rem; }
.tag{ font-size:.75rem; padding:.2rem .45rem; border-radius:.5rem; border:1px solid #e5e7eb; }
.tag.index{ background:#eef2ff; border-color:#c7d2fe; }
.tag.omip{ background:#ecfeff; border-color:#a5f3fc; }
.prod-name{ font-weight:600; }

.pill{ padding:.2rem .5rem; border-radius:999px; font-size:.75rem; border:1px solid #e5e7eb; }
.pill-draft{ background:#f3f4f6; }
.pill-pending{ background:#fef9c3; }
.pill-signed{ background:#dcfce7; }
.pill-rejected{ background:#fee2e2; }
.pill-expired{ background:#e5e7eb; }

.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
.empty{ text-align:center; padding:1rem; color:#6b7280; }
.pagination{ display:flex; align-items:center; gap:.5rem; padding:.75rem; justify-content:flex-end; }

.badge-multicups{ display:inline-block; padding:.15rem .45rem; border-radius:.5rem; font-size:.75rem; font-weight:600; background:#eef2ff; border:1px solid #c7d2fe; color:#3730a3; }

/* acciones */
.actions{ display:flex; align-items:center; gap:.35rem; }
.icon-btn{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid #e5e7eb; border-radius:.5rem; background:#fff; cursor:pointer; color:#374151; }
.icon-btn:disabled{ opacity:.6; cursor:not-allowed; }
.icon-btn:hover:not(:disabled){ background:#f8fafc; }

/* modal pdf */
.pdf-modal{ position:fixed; inset:0; z-index:9999; display:grid; grid-template-rows:auto 1fr; background:rgba(17,24,39,.92); backdrop-filter:blur(2px); outline:none; }
.pdf-toolbar{ display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.5rem .75rem; color:#fff; background:#111827; border-bottom:1px solid #1f2937; }
.pdf-body{ position:relative; }
.pdf-center{ height:100%; display:flex; align-items:center; justify-content:center; font-size:.95rem; color:#e5e7eb; }
.pdf-frame{ width:100%; height:100%; border:0; background:#111827; }

/* toast */
.toast{ position:fixed; right:1rem; bottom:1rem; display:flex; align-items:center; gap:.5rem; padding:.6rem .9rem; border-radius:.5rem; box-shadow:0 10px 30px rgba(0,0,0,.12); color:#0f172a; background:#fff; border:1px solid #e2e8f0; z-index:10000; }
.toast-success{ border-color:#86efac; }
.toast-error{ border-color:#fca5a5; }
.toast-close{ background:transparent; border:none; font-size:1.1rem; line-height:1; cursor:pointer; margin-left:.25rem; }

.spin{ animation:spin 1s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg) } }

/* SIN scoped */
.app-toast{
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647; /* arriba de todo */
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  max-width: min(92vw, 420px);
  padding: .55rem .75rem;
  border-radius: .75rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 10px 30px rgba(0,0,0,.12);
}

.app-toast svg{ flex: 0 0 18px; }
.app-toast__close{
  margin-left:.25rem;
  border:none;
  background:transparent;
  font-size:1.1rem;
  line-height:1;
  cursor:pointer;
  color:inherit;
  opacity:.7;
}
.app-toast__close:hover{ opacity:1; }

/* variantes */
.app-toast--success{ border-color:#bbf7d0; background:#f0fdf4; color:#166534; }
.app-toast--error{ border-color:#fecaca; background:#fef2f2; color:#991b1b; }

/* transición */
.toast-fade-enter-from, .toast-fade-leave-to{ opacity:0; transform: translateY(-6px); }
.toast-fade-enter-active, .toast-fade-leave-active{ transition: all .2s ease; }
</style>