// Configuración de variables de entorno
export const config = {
  // Marketer por defecto
  MARKETER: import.meta.env.VITE_MARKETER || 'NAB',
  
  // API Base URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://beta-omip-httpapi.sucapp.com/api',
  
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

