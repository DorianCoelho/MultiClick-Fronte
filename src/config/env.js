// Configuración de variables de entorno
export const config = {
  // Marketer por defecto
  MARKETER: import.meta.env.VITE_MARKETER || 'NAB',
  
  // API Base URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://beta-omip-httpapi.sucapp.com/api',
  
  // API key utilizada en validaciones de cambio de contraseña
  API_KEY: import.meta.env.VITE_API_KEY || 'a4b473fb5f7442cbb20d7aaeddd5c39a',
  
  // Logo y Branding
  LOGO_PATH: import.meta.env.VITE_LOGO_PATH || '/src/assets/images/Logo_nabalia.svg',
  
  // Favicons
  FAVICON_16: import.meta.env.VITE_FAVICON_16 || '/faviconV216.png',
  FAVICON_32: import.meta.env.VITE_FAVICON_32 || '/faviconV232.png',
  FAVICON_192: import.meta.env.VITE_FAVICON_192 || '/faviconV2192.png',
  FAVICON_512: import.meta.env.VITE_FAVICON_512 || '/faviconV2512.png',
  FAVICON_APPLE: import.meta.env.VITE_FAVICON_APPLE || '/faviconV2192.png'
}

export default config

