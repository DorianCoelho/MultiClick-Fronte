<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

function onLogout () {
  auth.logout()
  router.replace({ name: 'login' })
}

const props = defineProps({
  show: { type: Boolean, default: false },
  product: {
    type: Object,
    default: () => ({ no:'', name:'', status:'', description:'', noSeries:'' })
  }
})
const emit = defineEmits(['accepted'])

const contentRef = ref(null)
const bottomGuardRef = ref(null)
const canAccept = ref(false)
let observer

function setupObserver() {
  teardownObserver()
  const root = contentRef.value
  const target = bottomGuardRef.value
  if (!root || !target) return
  observer = new IntersectionObserver(
    entries => { canAccept.value = entries.some(e => e.isIntersecting) },
    { root, threshold: 1.0 }
  )
  observer.observe(target)
}

function teardownObserver() {
  if (observer) { observer.disconnect(); observer = undefined }
}

const onKeydown = (e) => {
  if (props.show && e.key === 'Escape') e.preventDefault()
}

watch(() => props.show, async (opened) => {
  if (opened) {
    canAccept.value = false
    await nextTick()
    setupObserver()
    const root = contentRef.value
    if (root && root.scrollHeight <= root.clientHeight) canAccept.value = true
    window.addEventListener('keydown', onKeydown)
  } else {
    teardownObserver()
    window.removeEventListener('keydown', onKeydown)
  }
})

onMounted(() => {
  if (props.show) setupObserver()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  teardownObserver()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="show" class="modal-backdrop-custom" aria-modal="true" role="dialog">
    <div class="modal-card" @click.stop>
      <div class="modal-header border-bottom">
        <h5 class="m-0">{{ product?.name || 'Producto' }}</h5>
        <button type="button" class="btn-close" aria-label="Close" @click="onLogout"></button>
      </div>

      <div class="modal-body">
        <div><strong>Descripción:</strong></div>
        <div ref="contentRef" class="scrollbox">
          <pre class="mb-0">{{ product.description }}</pre>
          <div ref="bottomGuardRef" style="height:1px;width:100%"></div>
        </div>
        <div class="form-text mt-2">
          Desplázate hasta el final para habilitar <strong>Aceptar</strong>.
        </div>
      </div>

      <div class="modal-footer border-top">
        <button class="btn btn-primary text-light" :disabled="!canAccept" @click="$emit('accepted')">
          Aceptar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop-custom{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1050}
.modal-card{background:#fff;width:min(900px,92vw);max-height:85vh;border-radius:.75rem;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden}
.modal-header,.modal-footer{padding:.75rem 1rem;background:#fff}
.modal-body{padding:1rem}
.scrollbox{border:1px solid #e5e7eb;border-radius:.5rem;padding:.75rem;max-height:45vh;overflow:auto;background:#fafafa;white-space:pre-wrap;-webkit-overflow-scrolling:touch}
pre{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace}
</style>
