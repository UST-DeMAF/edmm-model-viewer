<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useGraphSettingsStore } from '~/stores/graph-settings'

const store = useGraphSettingsStore()
const { visibleRelations } = storeToRefs(store)

const edgeTypes = [
  { type: 'HostedOn', label: 'Hosted On', color: 'var(--chart-1)' },
  { type: 'ConnectsTo', label: 'Connects To', color: 'var(--chart-2)' },
  { type: 'AttachesTo', label: 'Attaches To', color: 'var(--chart-3)' },
  { type: 'DependsOn', label: 'Depends On', color: 'var(--chart-4)' },
] as const

function isEdgeTypeVisible(edgeType: string): boolean {
  return visibleRelations.value.includes(edgeType as typeof visibleRelations.value[number])
}

function toggleEdgeType(edgeType: string): void {
  const typedEdge = edgeType as typeof visibleRelations.value[number]
  if (isEdgeTypeVisible(edgeType)) {
    visibleRelations.value = visibleRelations.value.filter(r => r !== typedEdge)
  }
  else {
    visibleRelations.value = [...visibleRelations.value, typedEdge]
  }
}
</script>

<template>
  <div class="text-sm rounded-lg bg-background/90 flex flex-col backdrop-blur">
    <div
      v-for="edge in edgeTypes"
      :key="edge.type"
      class="px-3 rounded-lg flex gap-2 h-8 cursor-pointer select-none items-center hover:bg-foreground/5"
      :class="{ 'opacity-40': !isEdgeTypeVisible(edge.type) }"
      @click="toggleEdgeType(edge.type)"
    >
      <div
        class="rounded-full size-2 transition-opacity"
        :style="{ backgroundColor: edge.color }"
      />
      <span class="transition-opacity">{{ edge.label }}</span>
      <i
        class="i-lucide-eye-off text-muted-foreground ml-auto size-3.5"
        :class="{ 'opacity-0': isEdgeTypeVisible(edge.type) }"
      />
    </div>
  </div>
</template>
