<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

/* ============ Auth / customerNo oculto ============ */
const auth = useAuthStore()
const customerNo = computed(() =>
  auth.user?.id || auth.user?.customerNo || auth.user?.customerId || ''
)

/* ============ Estado de UI ============ */
const loading = ref(false)
const error = ref('')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil((total.value || 0) / pageSize.value)))

/* Filtros “ligeros” como Propuestas */
const search = ref('')         // Busca por ContractNo o CUPS (auto-detecta)
const status = ref('')         // dropdown
function resetFilters() {
  search.value = ''
  status.value = ''
  page.value = 1
}

/* Ordenación por cabecera */
const sort = reactive({ by: 'ContractNo', dir: 'desc' }) // campo del enum + sentido
function toggleSort(colKey) {
  if (sort.by === colKey) sort.dir = (sort.dir === 'asc' ? 'desc' : 'asc')
  else { sort.by = colKey; sort.dir = 'asc' }
}
const thClass = (key) => ({
  sortable: true,
  active: sort.by === key,
  asc: sort.by === key && sort.dir === 'asc',
  desc: sort.by === key && sort.dir === 'desc',
})

/* Mapeo a tu enum MultiClickEnergyContractsOrderBy */
function toOrderByParam(by, dir) {
  const desc = dir === 'desc'
  switch (by) {
    case 'CustomerName': return desc ? 'CustomerNameDesc' : 'CustomerName'
    case 'Status': return desc ? 'StatusDesc' : 'Status'
    case 'ContractNo': return desc ? 'ContractNoDesc' : 'ContractNo'
    case 'StartDate': return desc ? 'StartDateDesc' : 'StartDate'
    case 'EndDate': return desc ? 'EndDateDesc' : 'EndDate'
    case 'Rate': return desc ? 'RateDesc' : 'Rate'
    default: return desc ? 'ContractNoDesc' : 'ContractNo'
  }
}

/* Helpers */
function isDocType(row, type) {
  return String(row?.multiClickDocumentType || '').toLowerCase() === String(type || '').toLowerCase()
}
function rowClass(row) {
  return {
    'row-propuesta': isDocType(row, 'Propuesta'),
    'row-contrato':  isDocType(row, 'Contrato'),
  }
}
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES')
}
function fmtNum(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
function isSugerido(s) { return String(s || '').trim().toLowerCase() === 'sugerido' }

/* Toast */
const toast = reactive({ show: false, text: '', type: 'success' })
let tHandle
function showToast(text, type = 'success', ms = 2200) {
  clearTimeout(tHandle); toast.text = text; toast.type = type; toast.show = true
  tHandle = setTimeout(() => toast.show = false, ms)
}

/* Detección simple de CUPS vs Contrato para el “search” */
function splitSearch() {
  const q = search.value.trim()
  if (!q) return { contractNo: '', cups: '' }
  // Si parece CUPS (empieza por ES + alfanumérico) lo mandamos como cups; si no, como contractNo
  if (/^ES[0-9A-Z]/i.test(q)) return { contractNo: '', cups: q }
  return { contractNo: q, cups: '' }
}

/* Cargar datos */
async function load() {
  error.value = ''
  rows.value = []
  total.value = 0
  if (!customerNo.value) { error.value = 'Falta CustomerNo en sesión.'; return }

  loading.value = true
  try {
    const { contractNo, cups } = splitSearch()
    const orderBy = toOrderByParam(sort.by, sort.dir)

    const { data } = await api.get('/v1/MultiClick/GetMultiClickEnergyContract', {
      params: {
        customerNo: customerNo.value,
        contractNo: contractNo || undefined,  // 👈 solo si tiene valor
        cups: cups || undefined,              // 👈 solo si tiene valor
        status: status.value || undefined,    // 👈 igual aquí
        orderBy,
        pageNumber: page.value,
        pageSize: pageSize.value
      }
    })

    // resto igual…
    const items = Array.isArray(data) ? data
      : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.result) ? data.result
          : []
    rows.value = items.map(x => ({
      contractNo: x.contractNo ?? x.ContractNo,
      customerNo: x.customerNo ?? x.CustomerNo,
      refApplicationOperNo: x.refApplicationOperNo ?? x.RefApplicationOperNo,
      cups: x.cups ?? x.Cups,
      multiClickDocumentType: x.multiClickDocumentType ?? x.MultiClickDocumentType,
      multiClickDocumentNo: x.multiClickDocumentNo ?? x.MultiClickDocumentNo,
      status: x.status ?? x.Status,
      rateNo: x.rateNo ?? x.RateNo,
      refApplicationOperNo: x.refApplicationOperNo ?? x.RefApplicationOperNo,
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

    total.value = Number(data?.total ?? data?.Total ?? 0)
    if (!total.value) {
      total.value = (page.value - 1) * pageSize.value + rows.value.length + (rows.value.length === pageSize.value ? pageSize.value : 0)
    }
  } catch (e) {
    error.value = e?.response?.data || e?.message || 'No se pudo cargar la lista.'
  } finally {
    loading.value = false
  }
}

/* Aprobar (solo si status = Sugerido) */
const approving = reactive(new Set())
async function approve(row) {
  if (!isSugerido(row.status)) return
  const key = `${row.customerNo}|${row.contractNo}|${row.cups}`
  if (approving.has(key)) return
  approving.add(key)
  try {
    await api.get('/v1/MultiClick/UpdateMultiClickEnergyContractAsync', {
      params: {
        customerNo: row.customerNo,
        contractNo: row.contractNo,
        cups: row.cups
      }
    })
    showToast('MultiClick aprobado correctamente.', 'success')
    await load()
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo aprobar el MultiClick', 'error', 3200)
  } finally {
    approving.delete(key)
  }
}

/* Reactividad de filtros/orden/paginación */
watch([search, status], () => { page.value = 1; load() })
watch(() => sort.by, () => { page.value = 1; load() })
watch(() => sort.dir, () => { page.value = 1; load() })
watch([page, pageSize], () => load())

onMounted(load)

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

// Intenta obtener un ID válido para el PDF a partir de la fila
function getRowPdfId(row) {
  return (
    row?.multiClickDocumentNo ?? row?.MultiClickDocumentNo ?? ''
  )
}

async function fetchPdfBase64ById(id) {
  // el endpoint que ya usas en Propuestas
  const url = `/v1/ProposalCliente/ProposalPdf/${encodeURIComponent(id)}/false`
  // pedimos como texto por si viene como string con comillas
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
async function downloadFromRow(row) {
  const id = getRowPdfId(row)
  if (!id) { showToast('No hay multiClickDocumentNo para esta fila.', 'error'); return }
  try {
    const base64 = await fetchPdfBase64ById(id)
    const url = base64ToBlobUrl(base64)
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}.pdf`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    showToast(e?.response?.data?.message || e?.message || 'No se pudo descargar el PDF', 'error', 3500)
  }
}
function downloadFromModal() {
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `${currentPdfId.value || 'documento'}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
}

// downloadFromRow is unused, so it can be removed to avoid the warning

function onKey(e) {
  if (e.key === 'Escape' && showPdf.value) closePdf()
}
onMounted(() => window.addEventListener('keydown', onKey))
</script>

<template>
  <DashboardLayout>
    <div class="page">
      <header class="header">
        <h1>MultiClick</h1>
        <p class="muted">Listado Contratos de Multiclick</p>
      </header>

      <!-- Controles estilo “Propuestas” -->
      <section class="controls">
        <input v-model="search" type="search" class="input" placeholder="Buscar por Contrato o CUPS"
          aria-label="Buscar" />

        <select v-model="status" class="select" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="Sugerido">Sugerido</option>
          <option value="Pending Acceptance">Pendiente de aceptación</option>
          <option value="Aceptado">Aceptado</option>
          <option value="Rechazado">Rechazado</option>
        </select>

        <button class="btn" @click="resetFilters">Limpiar</button>
      </section>

      <!-- Tabla -->
      <section class="card">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th @click="toggleSort('ContractNo')" :class="thClass('ContractNo')">Contrato</th>
                <th>CUPS</th>
                <th>No. referencia operación</th>
                <th @click="toggleSort('Rate')" :class="thClass('Rate')">Tarifa</th>
                <th>Precio Sel.</th>
                <th>Fee</th>
                <th>Duración</th>
                <th @click="toggleSort('StartDate')" :class="thClass('StartDate')">Inicio</th>
                <th @click="toggleSort('EndDate')" :class="thClass('EndDate')">Fin</th>
                <th @click="toggleSort('Status')" :class="thClass('Status')">Estado</th>
                <th class="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.contractNo + '|' + r.cups" :class="rowClass(r)">
                <td class="mono">
                  {{ r.contractNo }}
                  <small class="muted d-block">{{ r.multiClickDocumentType }} · {{ r.multiClickDocumentNo }}</small>
                </td>
                <td class="mono">{{ r.cups }}</td>
                <td class="mono">{{ r.refApplicationOperNo }}</td>
                <td>{{ r.rateNo }}</td>
                <td class="mono">{{ fmtNum(r.selectedPrice) }}</td>
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
                      :disabled="!isSugerido(r.status) || approving.has(r.customerNo + '|' + r.contractNo + '|' + r.cups)"
                      @click="approve(r)"
                      :title="isSugerido(r.status) ? 'Aprobar' : 'Solo disponible si el estado es Sugerido'">
                      {{ approving.has(r.customerNo + '|' + r.contractNo + '|' + r.cups) ? 'Enviando…' : 'Aprobar' }}
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!loading && rows.length === 0">
                <td colspan="10" class="empty">No hay resultados.</td>
              </tr>
              <tr v-if="loading">
                <td colspan="10" class="empty">Cargando…</td>
              </tr>
              <tr v-if="error">
                <td colspan="10" class="empty text-danger">{{ error }}</td>
              </tr>
            </tbody>
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
          </table>
        </div>

        <!-- Paginación -->
        <div class="pagination">
          <button class="btn" :disabled="page <= 1 || loading" @click="page--">Anterior</button>
          <span>Página {{ page }} / {{ totalPages }}</span>
          <button class="btn" :disabled="page >= totalPages || loading" @click="page++">Siguiente</button>

          <select v-model.number="pageSize" class="select compact" :disabled="loading"
            aria-label="Elementos por página">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </div>
      </section>
    </div>


    <!-- Toast -->
    <teleport to="body">
      <transition name="toast-fade">
        <div v-if="toast.show" class="app-toast"
          :class="{ 'app-toast--error': toast.type === 'error', 'app-toast--success': toast.type === 'success' }"
          role="status" aria-live="polite">
          <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
          </svg>
          <span>{{ toast.text }}</span>
          <button class="app-toast__close" @click="toast.show = false" aria-label="Cerrar">×</button>
        </div>
      </transition>
    </teleport>
  </DashboardLayout>
</template>

<style scoped>
.page {
  display: grid;
  gap: 1rem;
  padding: 1rem
}

.header h1 {
  margin: 0;
  font-size: 1.25rem
}

.muted {
  color: #6b7280
}

.controls {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
  align-items: center
}

.input,
.select {
  padding: .5rem .6rem;
  border: 1px solid #d1d5db;
  border-radius: .5rem;
  min-width: 220px
}

.select.compact {
  min-width: 90px
}

.btn {
  padding: .5rem .75rem;
  border: 1px solid #d1d5db;
  border-radius: .5rem;
  background: #f9fafb;
  cursor: pointer
}

.btn:disabled {
  opacity: .6;
  cursor: not-allowed
}



.btn-ghost:disabled {
  opacity: .6;
  cursor: not-allowed
}

.btn-ghost:hover:not(:disabled) {
  background: #f8fafc
}

.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: .75rem;
  overflow: hidden
}

.table-scroll {
  overflow: auto
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: .95rem
}

.table th,
.table td {
  padding: .6rem .7rem;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap
}

.table thead th {
  background: #f8faff;
  position: sticky;
  top: 0;
  z-index: 1;
  cursor: pointer
}

.table thead th.sortable::after {
  content: ' ⇅';
  opacity: .35
}

.table thead th.active.asc::after {
  content: ' ↑';
  opacity: .8
}

.table thead th.active.desc::after {
  content: ' ↓';
  opacity: .8
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace
}

.text-end {
  text-align: right
}

.empty {
  padding: 1rem;
  text-align: center;
  color: #6b7280
}

.pill {
  display: inline-block;
  padding: .15rem .5rem;
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
  font-size: .75rem
}

.pill-sug {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #3730a3
}

.pagination {
  display: flex;
  align-items: center;
  gap: .5rem;
  justify-content: flex-end;
  padding: .75rem
}

.app-toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483647;
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  max-width: min(92vw, 420px);
  padding: .55rem .75rem;
  border-radius: .75rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #111827;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .12)
}

.app-toast__close {
  margin-left: .25rem;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  color: inherit;
  opacity: .7
}

.app-toast__close:hover {
  opacity: 1
}

.app-toast--success {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534
}

.app-toast--error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px)
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all .2s ease
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

/* ===== Modal PDF ===== */
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

.right {
  background: rgba(17, 24, 39, .92);

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


.actions {
  display: flex;
  gap: .35rem;
  align-items: center;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
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
/* Contenedor para alinear y espaciar los botones */
.actions { display: flex; gap: .35rem; align-items: center; }
.actions--end { justify-content: flex-end; }

/* Igualar tamaños de los dos botones */
.icon-btn, .btn-ghost { height: 36px; }

.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 .75rem;
  line-height: 1;
  cursor: pointer;
}

.btn-ghost-custom{
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  
}
.btn-ghost-custom2{
  border-radius: .5rem;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #111827;
}
.btn-ghost-custom2:hover{
  border-radius: .5rem;
  background: #111827;
  color: #fff;
}

.btn-ghost:hover:not(:disabled) { background: #f8fafc; }
.btn-ghost:disabled { opacity: .6; cursor: not-allowed; }
.btn-ghost-p:hover{
  border: 1px solid #374151 !important;
  background: #111827 !important;

}
/* Opcional: centra verticalmente el contenido de todas las celdas */
.table td { vertical-align: middle; }
/* Colores por tipo de documento */
.table tbody tr.row-propuesta {
  background: #f0f9ff;            /* azul muy suave */
  border-left: 4px solid #38bdf8; /* cian */
}
.table tbody tr.row-propuesta td {
  /* color ligeramente más oscuro para mejor contraste */
  color: #1e3a8a;
}

.table tbody tr.row-contrato {
  background: #f0fdf4;            /* verde muy suave */
  border-left: 4px solid #34d399; /* verde */
}
.table tbody tr.row-contrato td {
  /* color ligeramente más oscuro para mejor contraste */
  color: #166534;
}

/* Si quieres que se note incluso al pasar el ratón */
.table tbody tr.row-propuesta:hover {
  background: #e0f2fe;
}
.table tbody tr.row-contrato:hover {
  background: #dcfce7;
}

</style>