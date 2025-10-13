import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'
import config from '@/config/env'

const api = axios.create({
  baseURL: config.API_BASE_URL
})

// Adjunta token
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

// Manejo de 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      router.push({ name: 'login', query: { session: 'expired' } })
    }
    return Promise.reject(err)
  }
)

export default api
