# MultiClick Frontend

Aplicación frontend para la gestión de contratos y propuestas de energía MultiClick.

## 🚀 Tecnologías

- **Vue 3** - Framework progresivo de JavaScript
- **Vite** - Herramienta de construcción rápida
- **Vue Router** - Enrutamiento oficial para Vue.js
- **Pinia** - Store de gestión de estado
- **Axios** - Cliente HTTP para llamadas a API
- **Bootstrap 5** - Framework CSS
- **ApexCharts** - Librería de gráficos
- **Sass** - Preprocesador CSS

## 📋 Requisitos previos

- Node.js (versión 16 o superior)
- npm (viene incluido con Node.js)

## 🔧 Instalación

1. Clona el repositorio
```bash
git clone <url-del-repositorio>
cd MultiClick-Fronte
```

2. Instala las dependencias
```bash
npm install
```

3. Configura las variables de entorno
```bash
# Crea un archivo .env.local con las siguientes variables:
VITE_API_BASE_URL=http://localhost:5000/api/
VITE_MARKETER=NAB

# Para NAB:
VITE_LOGO_PATH=/src/assets/images/Logo_nabalia.svg
VITE_FAVICON_16=/faviconV216.png
VITE_FAVICON_32=/faviconV232.png
VITE_FAVICON_192=/faviconV2192.png
VITE_FAVICON_512=/faviconV2512.png
VITE_FAVICON_APPLE=/faviconV2192.png

# Para ACIS, cambiar a:
# VITE_MARKETER=ACIS
# VITE_LOGO_PATH=/src/assets/images/Logo_acis.svg
# VITE_FAVICON_16=/favicon_acis.png
# VITE_FAVICON_32=/favicon_acis.png
# VITE_FAVICON_192=/favicon_acis.png
# VITE_FAVICON_512=/favicon_acis.png
# VITE_FAVICON_APPLE=/favicon_acis.png
```

## 🏃‍♂️ Scripts disponibles

### Modo desarrollo
```bash
npm run dev
```
Inicia el servidor de desarrollo en `http://localhost:5173`

### Compilar para producción
```bash
npm run build
```
Genera los archivos optimizados para producción en la carpeta `dist/`

### Previsualizar build de producción
```bash
npm run preview
```
Previsualiza la versión de producción localmente

## 📁 Estructura del proyecto

```
MultiClick-Fronte/
├── public/              # Archivos estáticos
├── src/
│   ├── assets/         # Recursos (imágenes, estilos)
│   ├── components/     # Componentes reutilizables
│   ├── layouts/        # Layouts de página
│   ├── pages/          # Vistas/páginas
│   ├── router/         # Configuración de rutas
│   ├── services/       # Servicios (API)
│   ├── stores/         # Stores de Pinia
│   ├── App.vue         # Componente raíz
│   └── main.js         # Punto de entrada
├── index.html          # HTML principal
└── vite.config.js      # Configuración de Vite
```

## 🔑 Funcionalidades principales

- **Autenticación**: Login, registro y recuperación de contraseña
- **Dashboard**: Panel principal con métricas y gráficos
- **Propuestas**: Gestión de propuestas de energía
- **Contratos**: Administración de contratos
- **MultiClick**: Listado y aprobación de contratos MultiClick
- **CUPS**: Gestión de puntos de suministro
- **Sugerencias**: Sistema de sugerencias de contratos

## 🛠️ Solución de problemas

### Error: "vite: command not found"
Si obtienes este error, asegúrate de ejecutar primero:
```bash
npm install
```

### Error: "Missing script: serve"
Este proyecto usa Vite, no Vue CLI. Usa `npm run dev` en lugar de `npm run serve`

## 📝 Notas de desarrollo

- El proyecto usa `<script setup>` para los componentes de Vue 3
- Los estilos usan Sass/SCSS para mejor modularización
- La gestión de estado se realiza con Pinia (sucesor de Vuex)
- Las llamadas a API se centralizan en `/src/services/api.js`

### 🎨 Sistema de Colores por Marketer

El proyecto soporta diferentes esquemas de colores según el marketer configurado:

**NAB (por defecto):**
- Primary: `#f0047f` (Rosa)
- Secondary: `#0f298f` (Azul)
- Archivo: `_variables-nab.scss`

**ACIS:**
- Primary: `#08cec7` (Turquesa)
- Secondary: `#073c42` (Verde oscuro)
- Archivo: `_variables-acis.scss`

Los colores se seleccionan automáticamente según la variable `VITE_MARKETER` en tiempo de compilación.

## 🌐 Despliegue

El proyecto está configurado para desplegarse en Vercel (ver `vercel.json`).

### Variables de Entorno en Vercel

Para configurar las variables de entorno en Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega las siguientes variables:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `VITE_API_BASE_URL` | `https://beta-omip-httpapi.sucapp.com/api` | URL base de la API |
| `VITE_MARKETER` | `NAB` | Código del marketer |
| `VITE_LOGO_PATH` | `/src/assets/images/Logo_nabalia.svg` | Ruta del logo |
| `VITE_FAVICON_16` | `/faviconV216.png` | Favicon 16x16 |
| `VITE_FAVICON_32` | `/faviconV232.png` | Favicon 32x32 |
| `VITE_FAVICON_192` | `/faviconV2192.png` | Favicon 192x192 |
| `VITE_FAVICON_512` | `/faviconV2512.png` | Favicon 512x512 |
| `VITE_FAVICON_APPLE` | `/faviconV2192.png` | Apple Touch Icon |

4. Redeploy el proyecto para aplicar los cambios

## 📄 Licencia

[Especificar licencia]
