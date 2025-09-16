import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'bootstrap-icons/font/bootstrap-icons.css'


// Bootstrap JS
import 'bootstrap'
import '@popperjs/core'

// Estilos SASS (incluye Bootstrap SCSS dentro)
import './assets/styles/main.scss'

// Charts
import VueApexCharts from 'vue3-apexcharts'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueApexCharts)
app.mount('#app')
