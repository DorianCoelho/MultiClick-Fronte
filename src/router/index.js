import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import Login from '@/pages/Login.vue'
import Register from '@/pages/Register.vue'
import Recover from '@/pages/Recover.vue'
import Dashboard from '@/pages/Dashboard.vue'
import Suggestions from '@/pages/Suggestions.vue'
import Grafico from '@/pages/Grafico.vue'
import ResetPassword from '@/pages/ResetPassword.vue'
import ChangePasswordValidator from '@/pages/ChangePasswordValidator.vue'
import ChangePasswordForm from '@/pages/ChangePasswordForm.vue'
import Cups from '@/pages/Cups.vue'
import ProposalDetails from '@/pages/ProposalDetails.vue'
import ProposalDetailsMulti from '@/pages/ProposalDetailsMulti.vue'
import Contracts from '@/pages/Contracts.vue'
import Proposals from '@/pages/Proposals.vue'
import MultiClickDetails from '@/pages/MultiClickDetails.vue'
import MultiClickContracts from '@/pages/MultiClickContracts.vue'

// Define rutas y marca cuáles requieren auth
const routes = [
  { path: '/', redirect: '/dashboard' },

  // Públicas (solo invitado)
  { path: '/login', name: 'login', component: Login, meta: { guest: true } },
  { path: '/register', name: 'register', component: Register, meta: { guest: true } },
  { path: '/recover', name: 'recover', component: Recover, meta: { guest: true } },

  // Protegidas
  { path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/suggestions', name: 'suggestions', component: Suggestions, meta: { requiresAuth: true } },
  { path: '/proposals', name: 'proposals', component: Proposals, meta: { requiresAuth: true } },
  { path: '/grafico', name: 'grafico', component: Grafico, meta: { requiresAuth: true } },
  { path: '/restablecer-password', name: 'ResetPassword', component: ResetPassword, meta: { requiresAuth: true } },
  { path: '/cups', name: 'Cups', component: Cups, meta: { requiresAuth: true } },
  { path: '/proposals/:proposalId',  name: 'ProposalDetails',  component: ProposalDetails,  meta: { requiresAuth: true } },
  { path: '/proposals-multi/:proposalId',  name: 'ProposalDetailsMulti',  component: ProposalDetailsMulti,  meta: { requiresAuth: true } },
  { path: '/contracts', name: 'Contracts', component: Contracts, meta: { requiresAuth: true } },
  { path: '/multiclick-contracts', name: 'MultiClickContracts', component: MultiClickContracts, meta: { requiresAuth: true } },
  { path: '/multiclick-details', name: 'MultiClickDetails', component: MultiClickDetails, meta: { requiresAuth: true } },
  { path: '/change-password-validator/:token(.*)', name: 'change-password-validator', component: ChangePasswordValidator },
  { path: '/change-password', name: 'change-password-form', component: ChangePasswordForm },


  // 404 → a login (o crea una página 404 si prefieres)
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guard global
router.beforeEach((to) => {
  const auth = useAuthStore()

  // Rehidrata estado desde localStorage si recargaste la página (por si acaso)
  if (!auth.token) {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken) {
      auth.token = savedToken
      auth.user = savedUser ? JSON.parse(savedUser) : null
    }
  }

  // Si la ruta requiere auth y no hay token → a login con redirect
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Si la ruta es solo para invitados y ya está logueado → al dashboard
  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Si no, continuar
  return true
})
router.afterEach((to) => {
  if (to.meta?.title) document.title = String(to.meta.title)
})

export default router
