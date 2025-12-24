<script setup lang="ts">
defineProps<{
  id: string
  color?: string
}>()
</script>

<template>
  <svg class="vue-flow__marker vue-flow__container">
    <defs>
      <marker
        :id="id"
        class="vue-flow__arrowhead"
        viewBox="-10 -10 20 20"
        refX="0"
        refY="0"
        markerWidth="36"
        markerHeight="36"
        markerUnits="userSpaceOnUse"
        orient="auto-start-reverse"
      >
        <!-- Open arrow (two lines, not filled) -->
        <path
          :stroke="color ?? 'var(--ring)'"
          stroke-width="1.1"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
          d="M -6,-4 L 0,0 L -6,4"
        />
      </marker>
    </defs>
  </svg>
</template>
