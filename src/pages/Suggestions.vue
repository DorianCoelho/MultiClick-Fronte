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
function resetFilters () {
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
    case 'Status':       return desc ? 'StatusDesc'       : 'Status'
    case 'ContractNo':   return desc ? 'ContractNoDesc'   : 'ContractNo'
    case 'StartDate':    return desc ? 'StartDateDesc'    : 'StartDate'
    case 'EndDate':      return desc ? 'EndDateDesc'      : 'EndDate'
    case 'Rate':         return desc ? 'RateDesc'         : 'Rate'
    default:             return desc ? 'ContractNoDesc'   : 'ContractNo'
  }
}

/* Helpers */
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
const toast = reactive({ show:false, text:'', type:'success' })
let tHandle
function showToast(text, type='success', ms=2200){
  clearTimeout(tHandle); toast.text = text; toast.type = type; toast.show = true
  tHandle = setTimeout(()=> toast.show=false, ms)
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
        <input
          v-model="search"
          type="search"
          class="input"
          placeholder="Buscar por Contrato o CUPS"
          aria-label="Buscar"
        
        />

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
              <tr v-for="r in rows" :key="r.contractNo + '|' + r.cups">
                <td class="mono">
                  {{ r.contractNo }}
                  <small class="muted d-block">{{ r.multiClickDocumentType }} · {{ r.multiClickDocumentNo }}</small>
                </td>
                <td class="mono">{{ r.cups }}</td>
                <td>{{ r.rateNo }}</td>
                <td class="mono">{{ fmtNum(r.selectedPrice) }}</td>
                <td class="mono">{{ fmtNum(r.feeEnergy) }}</td>
                <td>{{ r.duration }}</td>
                <td>{{ fmtDate(r.startDate) }}</td>
                <td>{{ fmtDate(r.endDate) }}</td>
                <td>
                  <span class="pill" :class="{'pill-sug': isSugerido(r.status)}">{{ r.status }}</span>
                </td>
                <td class="text-end">
                  <button
                    class="btn-ghost"
                    :disabled="!isSugerido(r.status) || approving.has(r.customerNo + '|' + r.contractNo + '|' + r.cups)"
                    @click="approve(r)"
                    :title="isSugerido(r.status) ? 'Aprobar' : 'Solo disponible si el estado es Sugerido'">
                    {{ approving.has(r.customerNo + '|' + r.contractNo + '|' + r.cups) ? 'Enviando…' : 'Aprobar' }}
                  </button>
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
          </table>
        </div>

        <!-- Paginación -->
        <div class="pagination">
          <button class="btn" :disabled="page<=1 || loading" @click="page--">Anterior</button>
          <span>Página {{ page }} / {{ totalPages }}</span>
          <button class="btn" :disabled="page>=totalPages || loading" @click="page++">Siguiente</button>

          <select v-model.number="pageSize" class="select compact" :disabled="loading" aria-label="Elementos por página">
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
        <div v-if="toast.show" class="app-toast" :class="{'app-toast--error': toast.type==='error', 'app-toast--success': toast.type==='success'}" role="status" aria-live="polite">
          <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.012 10.012 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/>
          </svg>
          <span>{{ toast.text }}</span>
          <button class="app-toast__close" @click="toast.show = false" aria-label="Cerrar">×</button>
        </div>
      </transition>
    </teleport>
  </DashboardLayout>
</template>

<style scoped>
.page{display:grid;gap:1rem;padding:1rem}
.header h1{margin:0;font-size:1.25rem}
.muted{color:#6b7280}

.controls{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.input,.select{padding:.5rem .6rem;border:1px solid #d1d5db;border-radius:.5rem;min-width:220px}
.select.compact{min-width:90px}
.btn{padding:.5rem .75rem;border:1px solid #d1d5db;border-radius:.5rem;background:#f9fafb;cursor:pointer}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-ghost{padding:.35rem .6rem;border:1px solid #e5e7eb;border-radius:.45rem;background:#fff}
.btn-ghost:disabled{opacity:.6;cursor:not-allowed}
.btn-ghost:hover:not(:disabled){background:#f8fafc}

.card{background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden}
.table-scroll{overflow:auto}
.table{width:100%;border-collapse:collapse;font-size:.95rem}
.table th,.table td{padding:.6rem .7rem;border-bottom:1px solid #f1f5f9;white-space:nowrap}
.table thead th{background:#f8faff;position:sticky;top:0;z-index:1;cursor:pointer}
.table thead th.sortable::after{content:' ⇅';opacity:.35}
.table thead th.active.asc::after{content:' ↑';opacity:.8}
.table thead th.active.desc::after{content:' ↓';opacity:.8}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
.text-end{text-align:right}
.empty{padding:1rem;text-align:center;color:#6b7280}

.pill{display:inline-block;padding:.15rem .5rem;border-radius:.5rem;border:1px solid #e5e7eb;background:#f8fafc;font-size:.75rem}
.pill-sug{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}

.pagination{display:flex;align-items:center;gap:.5rem;justify-content:flex-end;padding:.75rem}

.app-toast{position:fixed;top:16px;right:16px;z-index:2147483647;display:inline-flex;align-items:center;gap:.5rem;max-width:min(92vw,420px);padding:.55rem .75rem;border-radius:.75rem;border:1px solid #e5e7eb;background:#fff;color:#111827;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.app-toast__close{margin-left:.25rem;border:none;background:transparent;font-size:1.1rem;line-height:1;cursor:pointer;color:inherit;opacity:.7}
.app-toast__close:hover{opacity:1}
.app-toast--success{border-color:#bbf7d0;background:#f0fdf4;color:#166534}
.app-toast--error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
.toast-fade-enter-from,.toast-fade-leave-to{opacity:0;transform:translateY(-6px)}
.toast-fade-enter-active,.toast-fade-leave-active{transition:all .2s ease}
</style>