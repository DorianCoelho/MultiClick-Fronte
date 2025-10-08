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

## 🌐 Despliegue

El proyecto está configurado para desplegarse en Vercel (ver `vercel.json`).

## 📄 Licencia

[Especificar licencia]
