import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'
import config from '@/config/env'

const api = axios.create({
  baseURL: config.API_BASE_URL,
  // Limitar redirecciones a un número razonable (por defecto Axios permite 5)
  maxRedirects: 5,
  // Timeout para evitar esperas infinitas
  timeout: 30000,
  // Validar estado de respuesta
  validateStatus: function (status) {
    return status >= 200 && status < 300
  },
  // Headers por defecto para todas las peticiones
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Adjunta token
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
}, (error) => {
  console.error('Error en interceptor de request:', error)
  return Promise.reject(error)
})

// Manejo de errores
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Log detallado del error para diagnóstico
    if (err?.code === 'ERR_TOO_MANY_REDIRECTS' || err?.message?.includes('TOO_MANY_REDIRECTS')) {
      console.error('❌ Error de redirecciones infinitas:', {
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
        fullURL: err?.config?.baseURL + err?.config?.url,
        method: err?.config?.method,
        hasToken: !!err?.config?.headers?.Authorization,
        message: err?.message
      })
      // Este es un problema del backend, pero podemos mostrar un mensaje más claro
      err.message = 'El servidor está redirigiendo infinitamente. Por favor, contacta al administrador o verifica la configuración del servidor.'
    }
    
    // Manejo específico de errores de CORS
    if (err?.code === 'ERR_NETWORK' || err?.message?.includes('CORS') || err?.message?.includes('blocked by CORS')) {
      console.error('❌ Error de CORS:', {
        url: err?.config?.url,
        baseURL: err?.config?.baseURL,
        fullURL: err?.config?.baseURL + err?.config?.url,
        method: err?.config?.method,
        headers: err?.config?.headers,
        message: err?.message
      })
      err.message = 'Error de CORS: El servidor no está respondiendo correctamente a las peticiones preflight. Verifica que el backend esté configurado para permitir el origen http://localhost:5173 y que responda correctamente a las peticiones OPTIONS.'
    }
    
    if (err?.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      router.push({ name: 'login', query: { session: 'expired' } })
    }
    
    return Promise.reject(err)
  }
)

export default api
