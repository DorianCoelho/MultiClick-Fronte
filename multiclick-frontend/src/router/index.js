import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

import Login from '@/pages/Login.vue'
import Register from '@/pages/Register.vue'
import Recover from '@/pages/Recover.vue'
import Dashboard from '@/pages/Dashboard.vue'
import Suggestions from '@/pages/Suggestions.vue'
import Grafico from '@/pages/Grafico.vue'
import ResetPassword from '@/pages/ResetPassword.vue'
import Cups from '@/pages/Cups.vue'

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
  { path: '/grafico', name: 'grafico', component: Grafico, meta: { requiresAuth: true } },
  { path: '/restablecer-password', name: 'ResetPassword', component: ResetPassword, meta: { requiresAuth: true } },
  { path: '/cups', name: 'Cups', component: Cups, meta: { requiresAuth: true } },


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
