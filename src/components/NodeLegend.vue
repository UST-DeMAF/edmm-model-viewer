<script setup lang="ts">
import type { NodeShape } from '~/stores/graph'
import { storeToRefs } from 'pinia'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

const settingsStore = useGraphSettingsStore()
const graphStore = useGraphStore()

const { typeDifferentiationMode } = storeToRefs(settingsStore)
const { uniqueParentTypes, parentTypeColorMap, parentTypeShapeMap, isShapeModeAvailable } = storeToRefs(graphStore)

// Legend items based on the current differentiation mode
const legendItems = computed(() => {
  if (typeDifferentiationMode.value === 'DISABLED') {
    return []
  }

  const parentTypes = uniqueParentTypes.value
  if (parentTypes.length === 0) {
    return []
  }

  if (typeDifferentiationMode.value === 'COLOR') {
    return parentTypes.map(typeName => ({
      type: typeName,
      label: toHumanReadable(typeName),
      color: parentTypeColorMap.value[typeName] ?? 'hsl(0, 0%, 50%)',
      shape: null as NodeShape | null,
    }))
  }

  if (typeDifferentiationMode.value === 'SHAPE' && isShapeModeAvailable.value) {
    return parentTypes.map(typeName => ({
      type: typeName,
      label: toHumanReadable(typeName),
      color: null as string | null,
      shape: parentTypeShapeMap.value[typeName] ?? 'rectangle',
    }))
  }

  return []
})

// Check if legend should be shown
const showLegend = computed(() => {
  return legendItems.value.length > 0
})

// Convert a camelCase or PascalCase string to a human-readable label
function toHumanReadable(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase())
}

// Get the icon class for a shape
function getShapeIcon(shape: NodeShape | null): string {
  switch (shape) {
    case 'rectangle':
      return 'i-lucide-square'
    case 'circle':
      return 'i-lucide-circle'
    case 'hexagon':
      return 'i-lucide-hexagon'
    case 'parallelogram':
      return 'i-hugeicons-parallelogram'
    default:
      return 'i-lucide-square'
  }
}
</script>

<template>
  <div
    v-if="showLegend"
    class="select-none rounded-lg bg-background/90 p-2 text-sm backdrop-blur"
  >
    <p class="font-medium tracking-wide my-1 ms-1 opacity-60">
      {{ typeDifferentiationMode === 'COLOR' ? 'Node Colors' : 'Node Shapes' }}
    </p>

    <div class="flex flex-col gap-1">
      <div
        v-for="item in legendItems"
        :key="item.type"
        class="px-2 py-1.5 rounded-lg flex gap-2 items-center"
      >
        <!-- Color indicator (for COLOR mode) -->
        <div
          v-if="item.color"
          class="h-3 w-3 shrink-0 rounded-sm border border-black/20"
          :style="{ backgroundColor: item.color }"
        />

        <!-- Shape indicator (for SHAPE mode) -->
        <i
          v-if="item.shape"
          class="shrink-0 size-4 opacity-80"
          :class="getShapeIcon(item.shape)"
        />

        <!-- Label -->
        <span class="text-foreground/90">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
