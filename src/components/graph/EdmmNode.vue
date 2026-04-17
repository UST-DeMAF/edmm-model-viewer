<script setup lang="ts">
import type { NodeShape } from '~/stores/graph'
import { Handle, Position } from '@vue-flow/core'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
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
    scale?: number
    dependentCount?: number
    shape?: NodeShape
    distance?: number
  }
}>()
defineEmits(['updateNodeInternals'])
defineOptions({ inheritAttrs: false })

const store = useGraphSettingsStore()
const { layoutDirection } = storeToRefs(store)

// Handle positions based on layout direction
const targetPosition = computed(() =>
  layoutDirection.value === 'vertical' ? Position.Top : Position.Left,
)
const sourcePosition = computed(() =>
  layoutDirection.value === 'vertical' ? Position.Bottom : Position.Right,
)

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
  <!-- Distance badge (shown above the node, centered) -->
  <div
    v-if="!data.isGroupNode && data.distance != null && data.distance > 0"
    class="edmm-node__distance"
  >
    {{ data.distance }}
  </div>
  <!-- For group nodes, show label as a header at the top -->
  <div v-if="data.isGroupNode" class="edmm-node__group-header" v-html="highlightedLabel" />
  <!-- For regular nodes, show label centered -->
  <template v-else>
    <div class="edmm-node__content">
      <div class="edmm-node__label" v-html="highlightedLabel" />
      <!-- Show dependent count badge when scaling is active -->
      <div v-if="data.dependentCount" class="edmm-node__badge" :title="`${data.dependentCount} node(s) depend on this`">
        {{ data.dependentCount }}
      </div>
    </div>
  </template>

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
</template>

<style scoped>
.edmm-node__group-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  background: color-mix(in oklch, var(--node-background) 80%, transparent);
  border-bottom: 1px dashed var(--node-border);
  border-radius: 10px 10px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--node-foreground);
  letter-spacing: 0.02em;
}

.edmm-node__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-grow: 1;
  width: 100%;
}

.edmm-node__label {
  font-weight: 500;
  color: var(--node-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edmm-node__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--node-background);
  background: var(--node-foreground);
  border-radius: 10px;
  opacity: 0.7;
}

.edmm-node__handle {
  width: 12px;
  height: 12px;
  background: var(--node-border);
  border: 2px solid var(--node-ring);
  transition: all 0.2s ease;
}

.edmm-node__handle:hover {
  background: var(--node-ring);
  transform: scale(1.2);
}

/* Search highlight styling */
.edmm-node__highlight {
  background: var(--node-highlight-bg);
  color: var(--node-foreground);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}

/* Distance badge - floats above the node, centered */
.edmm-node__distance {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  min-width: 30px;
  font-size: 20px;
  border-radius: 1000px;
  font-weight: 700;
  color: var(--background);
  background: var(--foreground);
  pointer-events: none;
  z-index: 10;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
</style>
