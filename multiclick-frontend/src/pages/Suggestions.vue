<template>
    <DashboardLayout>
  <div class="suggestions-page">
    <header class="header">
      <h1>OMIP · Suggestions</h1>
      <p class="muted">Listado con datos fijos (dummy). Más tarde lo conectamos a la API.</p>
    </header>

    <!-- Controles -->
    <section class="controls">
      <input
        v-model="search"
        type="search"
        class="input"
        placeholder="Buscar por producto (ej. OMIP Q4 Baseload)"
        aria-label="Buscar por producto"
      />

      <select v-model="filters.productType" class="select" aria-label="Filtrar por tipo de producto">
        <option value="">Todos los productos</option>
        <option value="Baseload">Baseload</option>
        <option value="Peakload">Peakload</option>
      </select>

      <select v-model="filters.periodType" class="select" aria-label="Filtrar por período">
        <option value="">Todos los períodos</option>
        <option value="Month">Mensual</option>
        <option value="Quarter">Trimestral</option>
        <option value="Semester">Semestral</option>
        <option value="Year">Anual</option>
      </select>

      <select v-model="filters.side" class="select" aria-label="Filtrar por lado">
        <option value="">Buy & Sell</option>
        <option value="Buy">Buy</option>
        <option value="Sell">Sell</option>
      </select>

      <button class="btn" @click="resetFilters">Limpiar</button>
    </section>

    <!-- Tabla -->
    <section class="card">
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th @click="toggleSort('product')" :class="thClass('product')">Producto</th>
              <th @click="toggleSort('period')" :class="thClass('period')">Período</th>
              <th @click="toggleSort('year')" :class="thClass('year')">Año</th>
              <th @click="toggleSort('price')" :class="thClass('price')">Precio €/MWh</th>
              <th @click="toggleSort('side')" :class="thClass('side')">Side</th>
              <th @click="toggleSort('confidence')" :class="thClass('confidence')">Confianza</th>
              <th @click="toggleSort('updatedAt')" :class="thClass('updatedAt')">Actualizado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pagedRows" :key="row.id">
              <td>
                <div class="prod">
                  <span class="tag" :class="row.productType.toLowerCase()">{{ row.productType }}</span>
                  <span class="prod-name">{{ row.product }}</span>
                </div>
              </td>
              <td>{{ row.period }}</td>
              <td>{{ row.year }}</td>
              <td>{{ row.price.toFixed(2) }}</td>
              <td>
                <span class="pill" :class="row.side === 'Buy' ? 'pill-buy' : 'pill-sell'">{{ row.side }}</span>
              </td>
              <td>
                <div class="confidence">
                  <div class="bar"><div class="fill" :style="{ width: row.confidence + '%' }"></div></div>
                  <span class="conf-text">{{ row.confidence }}%</span>
                </div>
              </td>
              <td>{{ formatDate(row.updatedAt) }}</td>
              <td class="actions">
                <button class="btn-ghost" @click="toggleFav(row.id)">
                  <span v-if="favs.has(row.id)" title="Quitar de favoritos">★</span>
                  <span v-else title="Añadir a favoritos">☆</span>
                </button>
                <button class="btn-ghost" @click="viewDetails(row)">Ver</button>
              </td>
            </tr>
            <tr v-if="pagedRows.length === 0">
              <td colspan="8" class="empty">No hay resultados con los filtros actuales.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="pagination">
        <button class="btn" :disabled="page===1" @click="page--">Anterior</button>
        <span>Página {{ page }} / {{ totalPages }}</span>
        <button class="btn" :disabled="page===totalPages || totalPages===0" @click="page++">Siguiente</button>

        <select v-model.number="pageSize" class="select compact" aria-label="Elementos por página">
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="20">20</option>
        </select>
      </div>
    </section>
  </div>
  </DashboardLayout>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'

/**
 * 🔌 FUTURA CONEXIÓN API
 * Cuando quieras conectarlo a tu API, reemplaza `mockData` por una llamada asíncrona:
 * - Crea un servicio `omipService.getSuggestions()` que devuelva un array con esta misma estructura.
 * - Llama al servicio en onMounted y guarda el resultado en `rows`.
 */

const mockData = [
  // id, productType, product, periodType, period, year, price, side, confidence, updatedAt
  { id: 1,  productType: 'Baseload', product: 'OMIP Q4 Baseload', periodType:'Quarter',  period:'Q4', year: 2025, price: 94.30, side:'Buy',  confidence: 82, updatedAt: '2025-09-09T10:15:00Z' },
  { id: 2,  productType: 'Peakload', product: 'OMIP Q1 Peakload',  periodType:'Quarter',  period:'Q1', year: 2026, price: 118.70, side:'Sell', confidence: 65, updatedAt: '2025-09-10T08:02:00Z' },
  { id: 3,  productType: 'Baseload', product: 'OMIP Cal-26 Base',   periodType:'Year',     period:'Cal', year: 2026, price: 89.50, side:'Buy',  confidence: 74, updatedAt: '2025-09-08T16:40:00Z' },
  { id: 4,  productType: 'Baseload', product: 'OMIP S2 Base',       periodType:'Semester', period:'S2', year: 2025, price: 92.10, side:'Sell', confidence: 58, updatedAt: '2025-09-07T12:10:00Z' },
  { id: 5,  productType: 'Peakload', product: 'OMIP Oct Peak',      periodType:'Month',    period:'Oct', year: 2025, price: 101.25, side:'Buy', confidence: 69, updatedAt: '2025-09-06T09:25:00Z' },
  { id: 6,  productType: 'Baseload', product: 'OMIP Nov Base',      periodType:'Month',    period:'Nov', year: 2025, price: 96.40, side:'Sell', confidence: 60, updatedAt: '2025-09-05T15:55:00Z' },
  { id: 7,  productType: 'Baseload', product: 'OMIP Q2 Baseload',   periodType:'Quarter',  period:'Q2', year: 2025, price: 87.90, side:'Buy',  confidence: 77, updatedAt: '2025-09-04T11:05:00Z' },
  { id: 8,  productType: 'Peakload', product: 'OMIP Q3 Peakload',   periodType:'Quarter',  period:'Q3', year: 2025, price: 112.30, side:'Sell', confidence: 63, updatedAt: '2025-09-03T17:20:00Z' },
  { id: 9,  productType: 'Baseload', product: 'OMIP Cal-27 Base',   periodType:'Year',     period:'Cal', year: 2027, price: 84.10, side:'Buy',  confidence: 80, updatedAt: '2025-09-02T13:33:00Z' },
  { id: 10, productType: 'Peakload', product: 'OMIP S1 Peak',       periodType:'Semester', period:'S1', year: 2026, price: 109.80, side:'Sell', confidence: 55, updatedAt: '2025-09-01T08:12:00Z' },
]

const rows = ref([...mockData])

const search = ref('')
const filters = reactive({
  productType: '',
  periodType: '',
  side: '',
})

const sortState = reactive({
  by: 'updatedAt',
  dir: 'desc', // 'asc' | 'desc'
})

const favs = ref(new Set())

const page = ref(1)
const pageSize = ref(10)

function resetFilters () {
  search.value = ''
  filters.productType = ''
  filters.periodType = ''
  filters.side = ''
  page.value = 1
}

function toggleFav (id) {
  if (favs.value.has(id)) favs.value.delete(id)
  else favs.value.add(id)
}

function viewDetails (row) {
  // Aquí puedes abrir un modal, navegar a detalle, etc.
  alert(`Detalle de ${row.product} (${row.year} ${row.period}) · Precio: ${row.price.toFixed(2)} €/MWh`)
}

function formatDate (iso) {
  const d = new Date(iso)
  return d.toLocaleString()
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return rows.value.filter(r => {
    const okSearch = term === '' || r.product.toLowerCase().includes(term)
    const okType = !filters.productType || r.productType === filters.productType
    const okPeriodType = !filters.periodType || r.periodType === filters.periodType
    const okSide = !filters.side || r.side === filters.side
    return okSearch && okType && okPeriodType && okSide
  })
})

const sorted = computed(() => {
  const arr = [...filtered.value]
  const { by, dir } = sortState
  const factor = dir === 'asc' ? 1 : -1
  arr.sort((a, b) => {
    let va = a[by]
    let vb = b[by]
    if (by === 'updatedAt') {
      va = new Date(va).getTime()
      vb = new Date(vb).getTime()
    }
    if (va < vb) return -1 * factor
    if (va > vb) return  1 * factor
    return 0
  })
  return arr
})

const totalPages = computed(() => Math.ceil(sorted.value.length / pageSize.value))
const pagedRows = computed(() => {
  // Si la página actual excede el total (p.ej. tras filtrar), reubicar a 1
  if (page.value > totalPages.value) page.value = totalPages.value || 1
  const start = (page.value - 1) * pageSize.value
  return sorted.value.slice(start, start + pageSize.value)
})

function toggleSort (key) {
  if (sortState.by === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.by = key
    sortState.dir = 'asc'
  }
}

function thClass (key) {
  return {
    sortable: true,
    active: sortState.by === key,
    asc: sortState.by === key && sortState.dir === 'asc',
    desc: sortState.by === key && sortState.dir === 'desc',
  }
}
</script>

<style scoped>
.suggestions-page { display: grid; gap: 1rem; padding: 1rem; }
.header h1 { margin: 0; font-size: 1.4rem; }
.muted { color: #6b7280; margin: .25rem 0 0; }

.controls { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.input, .select { padding: .5rem .6rem; border: 1px solid #d1d5db; border-radius: .5rem; min-width: 220px; }
.select.compact { min-width: 80px; }

.btn { padding: .5rem .75rem; border: 1px solid #d1d5db; border-radius: .5rem; background: #f9fafb; cursor: pointer; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn-ghost { background: transparent; border: none; cursor: pointer; padding: .25rem .5rem; }
.btn-ghost:hover { text-decoration: underline; }

.card { background: #fff; border: 1px solid #e5e7eb; border-radius: .75rem; overflow: hidden; }
.table-scroll { overflow: auto; }

.table { width: 100%; border-collapse: collapse; font-size: .95rem; }
.table th, .table td { padding: .65rem .75rem; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.table thead th { position: sticky; top: 0; background: #f8fafc; cursor: pointer; }
.table thead th.sortable::after { content: ' ⇅'; opacity: .35; }
.table thead th.active.asc::after { content: ' ↑'; opacity: .8; }
.table thead th.active.desc::after { content: ' ↓'; opacity: .8; }

.prod { display: flex; align-items: center; gap: .5rem; }
.tag { font-size: .75rem; padding: .2rem .45rem; border-radius: .5rem; border: 1px solid #e5e7eb; }
.tag.baseload { background: #ecfeff; border-color: #a5f3fc; }
.tag.peakload { background: #fef3c7; border-color: #fcd34d; }
.prod-name { font-weight: 600; }

.pill { padding: .2rem .5rem; border-radius: 999px; font-size: .75rem; border: 1px solid #e5e7eb; }
.pill-buy { background: #ecfdf5; border-color: #a7f3d0; }
.pill-sell { background: #fef2f2; border-color: #fecaca; }

.confidence { display: flex; align-items: center; gap: .5rem; }
.bar { width: 120px; height: 8px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: #60a5fa; }

.empty { text-align: center; padding: 1rem; color: #6b7280; }

.pagination { display: flex; align-items: center; gap: .5rem; padding: .75rem; justify-content: flex-end; }

.actions { display: flex; gap: .25rem; }
</style>
