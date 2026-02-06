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
    return parentTypes.map((typeName) => {
      const colorInfo = parentTypeColorMap.value[typeName]
      return {
        type: typeName,
        label: toHumanReadable(typeName),
        color: colorInfo?.bg ?? '#808080',
        colorType: colorInfo?.type ?? 'light',
        textured: colorInfo?.textured ?? false,
        shape: null as NodeShape | null,
      }
    })
  }

  if (typeDifferentiationMode.value === 'SHAPE' && isShapeModeAvailable.value) {
    return parentTypes.map(typeName => ({
      type: typeName,
      label: toHumanReadable(typeName),
      color: null as string | null,
      colorType: 'light' as const,
      textured: false,
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

// Get the style object for a color legend item (with optional dot pattern for textured items)
function getColorStyle(item: { color: string | null, colorType: 'dark' | 'light', textured: boolean }): Record<string, string> {
  if (!item.color) {
    return {}
  }

  if (item.textured) {
    // Use white dots for light types, dark dots for dark types
    const dotColor = item.colorType === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)'
    return {
      background: `radial-gradient(circle, ${dotColor} 1.5px, transparent 1.5px), ${item.color}`,
      backgroundSize: '6px 6px, 100% 100%',
    }
  }

  return { backgroundColor: item.color }
}
</script>

<template>
  <div
    v-if="showLegend"
    class="text-sm p-2 rounded-lg bg-background/90 select-none backdrop-blur"
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
          class="border border-black/20 rounded-sm shrink-0 h-5 w-7"
          :style="getColorStyle(item)"
        />

        <!-- Shape indicator (for SHAPE mode) -->
        <i
          v-if="item.shape"
          class="opacity-80 shrink-0 size-4"
          :class="getShapeIcon(item.shape)"
        />

        <!-- Label -->
        <span class="text-foreground/90">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>
