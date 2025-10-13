import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno
  const env = loadEnv(mode, process.cwd(), '')
  
  // Determinar qué archivo de variables SCSS usar según el marketer
  const marketer = env.VITE_MARKETER || 'NAB'
  const variablesFile = marketer.toUpperCase() === 'ACIS' 
    ? '_variables-acis.scss' 
    : '_variables-nab.scss'
  
  return {
    plugins: [
      vue(),
      // Plugin para reemplazar variables en index.html
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html
            .replace(/%VITE_FAVICON_16%/g, env.VITE_FAVICON_16 || '/faviconV216.png')
            .replace(/%VITE_FAVICON_32%/g, env.VITE_FAVICON_32 || '/faviconV232.png')
            .replace(/%VITE_FAVICON_192%/g, env.VITE_FAVICON_192 || '/faviconV2192.png')
            .replace(/%VITE_FAVICON_512%/g, env.VITE_FAVICON_512 || '/faviconV2512.png')
            .replace(/%VITE_FAVICON_APPLE%/g, env.VITE_FAVICON_APPLE || '/faviconV2192.png')
        }
      }
    ],
    resolve: {
      alias: { 
        '@': path.resolve(__dirname, './src'),
        // Alias dinámico para el archivo de variables según marketer
        '@variables': path.resolve(__dirname, `./src/assets/styles/${variablesFile}`)
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Importar automáticamente las variables según el marketer
          additionalData: `@import "${path.resolve(__dirname, `./src/assets/styles/${variablesFile}`)}";`
        }
      }
    }
  }
})
