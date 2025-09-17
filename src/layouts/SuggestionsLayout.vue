<script setup>
import SideMenu from '@/components/SideMenu.vue'
</script>

<template>
  <div class="d-flex">
    <!-- Menú lateral -->
    <SideMenu />

    <!-- Contenido principal -->
    <main class="flex-grow-1 p-4 bg-light" style="min-height: 100vh;">
      <slot />
    </main>
  </div>
</template>

<style scoped>
/* Puedes personalizar el tamaño del sidebar */
</style>
