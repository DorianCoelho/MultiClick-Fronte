<template>
  <DashboardLayout>
    <div class="dash">
      <!-- Encabezado -->
      <header class="dash-head">
        <div>
          <h1 class="title">Mi panel</h1>
          <p class="muted">Resumen de tu cuenta, métodos bancarios y propuestas pendientes.</p>
        </div>
      </header>

      <!-- Grid principal -->
      <section class="grid grid-main">
        <!-- Tarjeta Cliente -->
        <div class="card">
          <div class="card-head">
            <h2 class="card-title">Tu perfil</h2>
          </div>
          <div v-if="custLoading" class="card-body center muted">Cargando datos del cliente…</div>
          <div v-else-if="custError" class="card-body text-danger">{{ custError }}</div>
          <div v-else class="card-body">
            <div class="profile">
              <div class="avatar">{{ initials(customer?.name || customer?.companyName) }}</div>
              <div class="info">
                <h3 class="name">
                  {{ customer?.fullName || customer?.name || customer?.companyName || '—' }}
                </h3>
                <div class="tags">
                  <span class="pill">Cliente: <strong class="mono">{{ customer?.no }}</strong></span>
                  <span class="pill">NIF: <strong class="mono">{{ customer?.vatRegistrationNo || '—' }}</strong></span>
                  <span class="pill" v-if="customer?.preferredBankAccountCode">
                    Banco preferido: <strong class="mono">{{ customer?.preferredBankAccountCode }}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div class="kv-grid">
              <div class="kv"><span>Email</span><strong>{{ customer?.email || '—' }}</strong></div>
              <div class="kv"><span>Móvil</span><strong>{{ customer?.mobilePhone || '—' }}</strong></div>
              <div class="kv"><span>Teléfono</span><strong>{{ customer?.phone || '—' }}</strong></div>
              <div class="kv"><span>Dirección</span><strong>{{ addressLine }}</strong></div>
              <div class="kv"><span>Ciudad</span><strong>{{ cityLine }}</strong></div>
              <div class="kv"><span>País</span><strong>{{ customer?.countryRegionCode || '—' }}</strong></div>
              <div class="kv"><span>Manager</span><strong>{{ customer?.manager || '—' }}</strong></div>
            </div>
          </div>
        </div>

        <!-- Tarjeta IBANs -->
        <div class="card mt-3">
          <div class="card-head">
            <h2 class="card-title">Cuentas bancarias (IBAN)</h2>
          </div>
          <div v-if="ibansLoading" class="card-body center muted">Cargando IBANs…</div>
          <div v-else-if="ibansError" class="card-body text-danger">{{ ibansError }}</div>
          <div v-else class="card-body">
            <div v-if="!ibans.length" class="empty">No hay IBANs asociados.</div>
            <ul v-else class="iban-list">
              <li v-for="i in ibans" :key="i.code" class="iban-item">
                <div class="iban-left">
                  <div class="bank">{{ i.name || 'Banco' }}</div>
                  <div class="iban mono">{{ maskIban(i.iban) }}</div>
                </div>
                <div class="iban-right">
                  <span
                    class="pill"
                    :class="{'pill-primary': isPreferred(i)}"
                    :title="isPreferred(i) ? 'Preferido' : 'Secundario'"
                  >
                    {{ isPreferred(i) ? 'Preferido' : 'Secundario' }}
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Propuestas pendientes -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Propuestas pendientes de aceptación</h2>
        </div>
        <div v-if="propsLoading" class="card-body center muted">Cargando propuestas…</div>
        <div v-else-if="propsError" class="card-body text-danger">{{ propsError }}</div>

        <div v-else class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Propuesta</th>
                <th>Comercializadora</th>
                <th>Producto</th>
                <th>Creada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in proposals" :key="row.proposalNo">
                <td>
                  <span class="mono">{{ row.proposalNo }}</span>
                  <div class="muted small">Agente: {{ row.agentName }}</div>
                </td>
                <td>{{ row.marketerName }}</td>
                <td>
                  <span class="tag">{{ row.productType || '—' }}</span>
                  <span class="muted small ms">{{ row.rate || '—' }} {{ row.times || '' }}</span>
                </td>
                <td>{{ fmtDate(row.createdAt || row.dateProposal) }}</td>
                <td><span class="pill pill-status">{{ row.status }}</span></td>
                <td class="actions">
                  <!-- Ver PDF en modal -->
                  <button class="icon-btn" @click="openPdfModal(row)" :disabled="pdfLoading" title="Ver PDF">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="2"/>
                      <path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                  </button>

                  <!--Enviar con restricciones -->
                  <button
                    class="icon-btn"
                    @click="sendToBtp(row)"
                    :disabled="sending.has(row.proposalNo)"
                    :title="sending.has(row.proposalNo) ? 'Enviando…' : 'Enviar'"
                    :aria-busy="sending.has(row.proposalNo)"
                  >
                    <svg v-if="!sending.has(row.proposalNo)" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="spin">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="3"
                        stroke-linecap="round" stroke-dasharray="56" stroke-dashoffset="28"/>
                    </svg>
                  </button>
                </td>
              </tr>
              <tr v-if="!proposals.length">
                <td colspan="6" class="empty">No hay propuestas pendientes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <EnergyProductsModal
      :show="showProductModal"
      :product="energyProduct"
      @accepted="acceptEnergyProduct"
      @close="showProductModal = false"
    />

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
            <button class="btn" @click="closePdf">Cerrar ✕</button>
          </div>
        </div>
        <div class="pdf-body">
          <div v-if="pdfLoading" class="pdf-center muted">Cargando PDF…</div>
          <div v-else-if="pdfError" class="pdf-center text-danger">{{ pdfError }}</div>
          <iframe v-else class="pdf-frame" :src="pdfUrl" title="Documento PDF"></iframe>
        </div>
      </div>
    </Teleport>

    <!-- TOAST -->
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
import { ref, reactive, computed, onMounted } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import EnergyProductsModal from '@/components/EnergyProductsModal.vue'
import config from '@/config/env'

/* ===================== Auth ===================== */
const auth = useAuthStore()
const customerNo = computed(() =>
  auth.user?.id || auth.user?.id || auth.user?.customerId || ''
)

/* ====== Estado para el modal de producto ====== */
const showProductModal = ref(false)
const energyProduct = ref(null)

/* Helper para sacar el “userName” desde tu store */
function getUserName () {
  return (
    auth.user?.userName ??
    auth.user?.UserName ??
    auth.user?.email ??
    auth.user?.name ??
    ''
  )
}
/* ===================== Estado cliente ===================== */
const customer = ref(null)
const custLoading = ref(false)
const custError = ref('')

/* ===================== IBANs ===================== */
const ibans = ref([])
const ibansLoading = ref(false)
const ibansError = ref('')

/* ===================== Propuestas pendientes ===================== */
const proposals = ref([])
const propsLoading = ref(false)
const propsError = ref('')

/* ===================== PDF Modal ===================== */
const showPdf = ref(false)
const pdfUrl = ref(null)
const pdfLoading = ref(false)
const pdfError = ref('')
const currentPdfId = ref(null)

/* ===================== Envío a BTP + Toast ===================== */
const sending = ref(new Set())
const toast = reactive({ show: false, text: '', type: 'success' })
let toastTimer

function showToast (text, type = 'success', ms = 2400) {
  clearTimeout(toastTimer)
  toast.text = text
  toast.type = type
  toast.show = true
  toastTimer = setTimeout(() => { toast.show = false }, ms)
}

/* ===================== Loaders ===================== */
/**
 * 1) GET /UserAcceptedProducts?userName=...
 *    - Si ya hay aceptaciones => NO mostramos modal.
 * 2) Si vacío o error => GET /GetEnergyProducts y mostramos modal.
 */
async function getPublicIP() {
  const { ip } = await fetch('https://api.ipify.org?format=json').then(r => r.json());
  return ip;
}

async function maybeShowFirstLoginModal () {


  try {
    const { data: accepted } = await api.get('/UserAcceptedProducts', {
      params: { userName: getUserName() }
    })
    if (Array.isArray(accepted) && accepted.length > 0) {
      // Ya estaba aceptado: marcamos que no es primer login y salimos
      auth.user.isFirstLogin = false
      localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))
      return
    }
  } catch (e) {
    // Si falla, seguimos para no bloquear al usuario
    console.warn('No se pudo comprobar aceptaciones previas:', e)
  }

  // Cargamos el producto a aceptar
  try {
    const { data } = await api.get('/GetEnergyProducts')
    energyProduct.value = data
    showProductModal.value = true
  } catch (e) {
    console.error('No se pudo cargar GetEnergyProducts:', e?.response?.data || e)
  }
}

/* Detectar tipo de dispositivo */
function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  
  // Detectar iOS
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
    return /iPad/.test(ua) ? 'Tablet iOS' : 'Mobile iOS'
  }
  
  // Detectar Android
  if (/android/i.test(ua)) {
    return /mobile/i.test(ua) ? 'Mobile Android' : 'Tablet Android'
  }
  
  // Detectar tablet genérica
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet'
  }
  
  // Detectar móvil genérico
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'Mobile'
  }
  
  // Por defecto, PC
  return 'PC'
}

/* POST de aceptación */
async function acceptEnergyProduct () {
  const ip = await getPublicIP();
  try {
    const payload = {
      userName: getUserName(),
      productNo: energyProduct.value?.no || energyProduct.value?.No || '',
      acceptanceDate: new Date().toISOString(),
      acceptanceIPAddress: ip,
      device: getDeviceType()
    }
    await api.post('/UserAcceptedProducts', payload)

    // Marcar que ya no es primer login y persistir
    auth.user.isFirstLogin = false
    localStorage.setItem('auth', JSON.stringify({ token: auth.token, user: auth.user }))

    showProductModal.value = false
    showToast('Producto aceptado correctamente. ¡Gracias!', 'success')
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo registrar la aceptación', 'error')
  }
}
async function loadCustomer () {
  custLoading.value = true; custError.value = ''; customer.value = null
  try {
    const { data } = await api.get('/Customer/GetCustomer', {
      params: { customerNo: customerNo.value }
    })
    // normaliza minimal
    customer.value = {
      no: data.no ?? data.No,
      name: data.name ?? data.Name,
      fullName: data.fullName ?? data.FullName,
      companyName: data.companyName ?? data.CompanyName,
      email: data.email ?? data.Email,
      mobilePhone: data.mobilePhone ?? data.MobilePhone,
      phone: data.phone ?? data.Phone,
      address: data.address ?? data.Address,
      address2: data.address2 ?? data.Address2,
      county: data.county ?? data.County,
      postCode: data.postCode ?? data.PostCode,
      city: data.city ?? data.City,
      countryRegionCode: data.countryRegionCode ?? data.CountryRegionCode,
      vatRegistrationNo: data.vatRegistrationNo ?? data.VatRegistrationNo,
      preferredBankAccountCode: data.preferredBankAccountCode ?? data.PreferredBankAccountCode,
      manager: data.manager ?? data.Manager
    }
  } catch (e) {
    custError.value = e?.response?.data || e?.message || 'No se pudo cargar el cliente'
  } finally {
    custLoading.value = false
  }
}

async function loadIbans () {
  ibansLoading.value = true; ibansError.value = ''; ibans.value = []
  try {
    const { data } = await api.get('/Customer/GetCustomerIbans', {
      params: { customerNo: customerNo.value }
    })
    ibans.value = (Array.isArray(data) ? data : []).map(x => ({
      customerNo: x.customerNo ?? x.CustomerNo,
      iban: x.iban ?? x.Iban,
      code: x.code ?? x.Code,
      name: x.name ?? x.Name
    }))
  } catch (e) {
    ibansError.value = e?.response?.data || e?.message || 'No se pudieron cargar los IBANs'
  } finally {
    ibansLoading.value = false
  }
}

async function loadProposals () {
  propsLoading.value = true; propsError.value = ''; proposals.value = []
  try {
    const { data } = await api.get('/v1/ProposalCliente/ProposalLastsList', {
      params: { customerNo: customerNo.value, marketer: config.MARKETER }
    })
    const arr = (data?.result ?? data?.Result ?? [])
    proposals.value = arr.map(p => ({
      proposalNo: p.proposalNo ?? p.ProposalNo,
      marketerName: p.marketerName ?? p.MarketerName,
      customerCups: p.customerCups ?? p.CustomerCups,
      agentName: p.agentName ?? p.AgentName,
      productType: p.productType ?? p.ProductType,
      rate: p.rate ?? p.Rate,
      times: p.times ?? p.Times,
      status: p.status ?? p.Status,
      dateProposal: p.dateProposal ?? p.DateProposal,
      createdAt: p.createdAt ?? p.CreatedAt
    }))
  } catch (e) {
    propsError.value = e?.response?.data || e?.message || 'No se pudieron cargar las propuestas'
  } finally {
    propsLoading.value = false
  }
}

/* ===================== Helpers UI ===================== */
const addressLine = computed(() => {
  if (!customer.value) return '—'
  const a = [customer.value.address, customer.value.address2].filter(Boolean).join(', ')
  return a || '—'
})
const cityLine = computed(() => {
  if (!customer.value) return '—'
  const a = [customer.value.postCode, customer.value.city, customer.value.county].filter(Boolean).join(' ')
  return a || '—'
})
function initials (name) {
  if (!name) return 'C'
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase()).join('')
}
function maskIban (iban) {
  if (!iban) return '—'
  const s = String(iban).replace(/\s+/g, '')
  if (s.length <= 8) return s
  return `${s.slice(0, 4)} •••• •••• •••• ${s.slice(-4)}`
}
function isPreferred (ibanItem) {
  const code = customer.value?.preferredBankAccountCode
  return !!code && code === (ibanItem.code || ibanItem.Code)
}
function fmtDate(input) {
  if (!input) return '—'
  const d = (input instanceof Date) ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  // dd/mm/yyyy hh:mm (24h)
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/* ===================== PDF modal ===================== */
function revokePdfUrl () {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
}
function base64ToBlobUrl (base64, mime = 'application/pdf') {
  const binStr = atob(base64)
  const len = binStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  return URL.createObjectURL(blob)
}
async function openPdfModal (row) {
  const id = row?.proposalNo || row?.ProposalNo
  if (!id || pdfLoading.value) return
  pdfLoading.value = true
  pdfError.value = ''
  currentPdfId.value = id
  revokePdfUrl()
  try {
    const url = `/v1/ProposalCliente/ProposalPdf/${encodeURIComponent(id)}/false`
    const { data } = await api.get(url, { responseType: 'text' })
    let base64 = typeof data === 'string' ? data : (data && data.base64) || ''
    if (!base64) throw new Error('PDF vacío')
    if (base64.startsWith('"')) {
      try { base64 = JSON.parse(base64) } catch {}
    }
    pdfUrl.value = base64ToBlobUrl(base64)
    showPdf.value = true
    requestAnimationFrame(() => {
      const el = document.querySelector('.pdf-modal')
      el && el.focus && el.focus()
    })
  } catch (e) {
    pdfError.value = e?.response?.data?.message || e?.message || 'No se pudo cargar el PDF'
    showPdf.value = true
  } finally {
    pdfLoading.value = false
  }
}
function closePdf () {
  showPdf.value = false
  currentPdfId.value = null
  pdfError.value = ''
  revokePdfUrl()
}
function downloadFromModal () {
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `${currentPdfId.value || 'documento'}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
}

/* ===================== BTP restricciones ===================== */
function hoursSince (d) {
  const t = new Date(d).getTime()
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return (Date.now() - t) / 36e5
}
function canSendToBTP (row) {
  const status = (row?.status || '').toLowerCase()
  const isPending = status.includes('pendiente')
  const created = row?.createdAt || row?.dateProposal
  const tooOld = hoursSince(created) > 60
  return { isPending, tooOld }
}

async function sendToBtp (row) {
  const id = row?.proposalNo || row?.ProposalNo
  if (!id || sending.value.has(id)) return
  const { isPending, tooOld } = canSendToBTP(row)
  if (!isPending) {
    showToast('La propuesta ya no está en “Pendiente de aceptación”.', 'error')
    return
  }
  if (tooOld) {
    showToast('La propuesta ya está caducada (más de 60 horas).', 'error')
    return
  }
  try {
    sending.value.add(id)
    await api.get(`/v1/ProposalCliente/ProposalSendToBtp/${encodeURIComponent(id)}`)
    showToast('Propuesta enviada correctamente.', 'success')
  } catch (e) {
    showToast(e?.response?.data || e?.message || 'No se pudo enviar la propuesta!', 'error', 3500)
  } finally {
    sending.value.delete(id)
  }
}

/* ===================== Init ===================== */
onMounted(async () => {
  if (!customerNo.value) {
    custError.value = 'No hay cliente en sesión.'
    return
  }
  await maybeShowFirstLoginModal()
  await Promise.all([loadCustomer(), loadIbans(), loadProposals()])
})
</script>

<style scoped>
.dash{display:grid;gap:1rem;padding:1rem}
.dash-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.title{margin:0;font-size:1.3rem}
.muted{color:#6b7280}
.grid-main{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;overflow:hidden}
.card-head{padding:.75rem 1rem;border-bottom:1px solid #eef2f7}
.card-title{margin:0;font-size:1.05rem}
.card-body{padding:1rem}
.center{display:flex;align-items:center;justify-content:center;min-height:88px}
.profile{display:flex;gap:.85rem;align-items:center;margin-bottom:.5rem}
.avatar{width:52px;height:52px;border-radius:999px;background:#eef2ff;color:#3730a3;display:flex;align-items:center;justify-content:center;font-weight:700}
.info .name{margin:.1rem 0}
.tags{display:flex;gap:.4rem;flex-wrap:wrap}
.pill{display:inline-block;padding:.15rem .45rem;border-radius:.5rem;border:1px solid #e5e7eb;font-size:.75rem;background:#f8fafc}
.pill-primary{background:#eef2ff;border-color:#c7d2fe;color:#3730a3;font-weight:600}
.pill-status{background:#eef2ff;border-color:#c7d2fe}
.kv-grid{display:grid;gap:.5rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:.5rem}
.kv{display:flex;justify-content:space-between;gap:1rem;padding:.35rem .15rem;border-bottom:1px dashed #eef2f7}
.kv span{color:#6b7280}
.iban-list{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}
.iban-item{display:flex;align-items:center;justify-content:space-between;padding:.65rem .75rem;border:1px solid #eef2f7;border-radius:.6rem}
.bank{font-weight:600}
.iban{font-size:.95rem}
.tag{font-size:.75rem;padding:.15rem .35rem;border:1px solid #e5e7eb;border-radius:.4rem;background:#f8fafc}
.ms{margin-left:.35rem}
.table{width:100%;border-collapse:collapse;font-size:.95rem}
.table th,.table td{padding:.6rem .7rem;border-bottom:1px solid #f1f5f9;white-space:nowrap}
.table thead th{background:#f8fafc;position:sticky;top:0}
.table-scroll{overflow:auto}
.mono{font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace}
.empty{padding:1rem;text-align:center;color:#6b7280}
.actions{display:flex;gap:.35rem;align-items:center}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #e5e7eb;border-radius:.5rem;background:#fff;cursor:pointer}
.icon-btn:disabled{opacity:.6;cursor:not-allowed}
.icon-btn:hover:not(:disabled){background:#f8fafc}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* PDF modal */
.pdf-modal{position:fixed;inset:0;z-index:20000;display:grid;grid-template-rows:auto 1fr;background:rgba(17,24,39,.92);backdrop-filter:blur(2px);outline:none}
.pdf-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.5rem .75rem;color:#fff;background:#111827;border-bottom:1px solid #1f2937}
.pdf-body{position:relative}
.pdf-frame{width:100%;height:100%;border:0;background:#111827}
.pdf-center{height:100%;display:flex;align-items:center;justify-content:center;font-size:.95rem}
.btn{padding:.45rem .75rem;border:1px solid #d1d5db;border-radius:.5rem;background:#f9fafb;cursor:pointer}
.btn-ghost{background:transparent;border:1px solid transparent;color:#e5e7eb;cursor:pointer}
.btn-ghost:hover{border-color:#374151}
.text-danger{color:#ef4444}

/* Toast */
.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(8px)}
.toast-enter-active,.toast-leave-active{transition:all .15s ease}
.toast{position:fixed;right:16px;bottom:16px;z-index:24000;display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;border-radius:.6rem;box-shadow:0 8px 24px rgba(0,0,0,.2);color:#0f172a}
.toast-success{background:#ecfdf5;border:1px solid #bbf7d0}
.toast-error{background:#fef2f2;border:1px solid #fecaca}
.toast svg{flex:0 0 auto}
.toast-close{appearance:none;background:transparent;border:none;font-size:1rem;cursor:pointer;margin-left:.25rem}

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