<script setup lang="ts">
import TooltipProvider from './components/ui/tooltip/TooltipProvider.vue';

// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
useHead({
  title: 'EDMM Model Viewer',
  meta: [
    {
      name: 'description',
      content: 'Viewer for EDMM deployment models',
    },
    {
      name: 'theme-color',
      content: () => isDark.value ? '#00aba9' : '#ffffff',
    },
  ],
  link: [
    {
      rel: 'icon',
      type: 'image/png',
      href: '/favicon.png',
    },
  ],
})
</script>

<template>
  <TooltipProvider>
    <RouterView />
  </TooltipProvider>
</template>
