<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { isDark } from '~/composables/dark'
import { useGraphSettingsStore } from '~/stores/graph-settings'

const props = defineProps<{
  id: string
  data: {
    label: string
    type: string
    isGroupNode?: boolean
    highlighted?: boolean
    dimmed?: boolean
    width?: number
    height?: number
    searchQuery?: string
  }
}>()
const store = useGraphSettingsStore()
const { layoutDirection } = storeToRefs(store)

// Handle positions based on layout direction
const targetPosition = computed(() =>
  layoutDirection.value === 'vertical' ? Position.Top : Position.Left,
)
const sourcePosition = computed(() =>
  layoutDirection.value === 'vertical' ? Position.Bottom : Position.Right,
)

// Add 'dark' class when user is in light mode for better contrast
const nodeClasses = computed(() => ({
  'edmm-node': true,
  'edmm-node--group': props.data.isGroupNode,
  'edmm-node--highlighted': props.data.highlighted,
  'edmm-node--dimmed': props.data.dimmed,
  'dark': !isDark.value,
}))

// For group nodes, use the full dimensions passed from layout
const nodeStyle = computed(() => {
  if (props.data.isGroupNode && props.data.width && props.data.height) {
    return {
      width: `${props.data.width}px`,
      height: `${props.data.height}px`,
    }
  }
  return {}
})

// Generate highlighted label with search matches wrapped in <mark>
const highlightedLabel = computed(() => {
  const label = props.data.label
  const query = props.data.searchQuery?.trim().toLowerCase()

  if (!query)
    return label

  const lowerLabel = label.toLowerCase()
  const index = lowerLabel.indexOf(query)

  if (index === -1)
    return label

  const before = label.slice(0, index)
  const match = label.slice(index, index + query.length)
  const after = label.slice(index + query.length)

  return `${before}<mark class="edmm-node__highlight">${match}</mark>${after}`
})
</script>

<template>
  <div :class="nodeClasses" :style="nodeStyle">
    <!-- For group nodes, show label as a header at the top -->
    <div v-if="data.isGroupNode" class="edmm-node__group-header" v-html="highlightedLabel" />
    <!-- For regular nodes, show label centered -->
    <div v-else class="edmm-node__label" v-html="highlightedLabel" />

    <!-- Handles for edges -->
    <Handle
      v-if="!data.isGroupNode"
      id="target"
      type="target"
      :position="targetPosition"
      class="edmm-node__handle"
    />
    <Handle
      v-if="!data.isGroupNode"
      id="source"
      type="source"
      :position="sourcePosition"
      class="edmm-node__handle"
    />
  </div>
</template>

<style scoped>
.edmm-node {
  background: var(--accent);
  border: 2px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  min-width: 160px;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  transition: all 0.1s ease-out;
  position: relative;
  overflow: visible;
}

.edmm-node:hover {
  border-color: var(--ring);
}

.edmm-node--group {
  background: color-mix(in oklch, var(--accent) 50%, transparent);
  border: 2px dashed var(--border);
  min-width: auto;
  padding: 0;
  box-sizing: border-box;
}

.edmm-node__group-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: color-mix(in oklch, var(--accent) 80%, transparent);
  border-bottom: 1px dashed var(--border);
  border-radius: 10px 10px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-foreground);
  letter-spacing: 0.02em;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.5;
  }
}

.edmm-node--dimmed {
  opacity: 0.35;
  filter: grayscale(0.5);
}

.edmm-node--dimmed:hover {
  opacity: 0.6;
}

.edmm-node__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edmm-node--highlighted .edmm-node__label {
  color: var(--foreground);
}

.edmm-node__handle {
  width: 12px;
  height: 12px;
  background: var(--border);
  border: 2px solid var(--ring);
  transition: all 0.2s ease;
}

.edmm-node__handle:hover {
  background: var(--ring);
  transform: scale(1.2);
}

/* Search highlight styling */
.edmm-node__highlight {
  background: var(--chart-4);
  color: var(--primary-foreground);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
