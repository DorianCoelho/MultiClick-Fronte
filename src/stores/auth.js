import { defineStore } from 'pinia'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isFirstLogin: localStorage.getItem('isFirstLogin') === 'true'
  }),
  getters: {
    isAuthenticated: (s) => !!s.token
  },
  actions: {
    async login(credentials) {
      // Ajusta a tu API .NET 8 (ej. POST /auth/login)
      const { data } = await api.post('/auth/login', credentials)
      this.token = data.token
      this.user = data.user ?? null
      console.log("data.user", data.user)
      this.isFirstLogin = !!(data.user?.isFirstLogin ?? data.user?.IsFirstLogin)
      localStorage.setItem('token', this.token)
      localStorage.setItem('user', JSON.stringify(this.user))
      localStorage.setItem('isFirstLogin', this.isFirstLogin.toString())
      return data
    },
    async register(payload) {
      // Ajusta a tu API (ej. POST /auth/register)
      await api.post('/auth/register', payload)
    },
    async recover(email) {
      const { data } = await api.post('/Auth/recover', { email, marketerNo: config.MARKETER })
      return data
    },
    logout() {
      this.token = null
      this.user = null
      this.isFirstLogin = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('isFirstLogin')
    }
  }
})
