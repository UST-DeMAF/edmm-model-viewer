<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'
import { computed } from 'vue'
import { RelationType } from '~/lib/graph-layout'
import EdmmMarker from './EdmmMarker.vue'

const props = defineProps<{
  id: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: string
  targetPosition: string
  data?: {
    label?: string
    relationType?: RelationType | null
    highlighted?: boolean
    dimmed?: boolean
  }
  markerEnd?: string
  style?: Record<string, any>
}>()

const path = computed(() => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition as any,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition as any,
    curvature: 0.25,
  })
  return { edgePath, labelX, labelY }
})

const edgeClasses = computed(() => ({
  'edmm-edge': true,
  'edmm-edge--highlighted': props.data?.highlighted,
  'edmm-edge--dimmed': props.data?.dimmed,
}))

// Map relation types to CSS variable names
const relationTypeColors: Record<RelationType, string> = {
  [RelationType.HostedOn]: 'var(--chart-1)',
  [RelationType.ConnectsTo]: 'var(--chart-2)',
  [RelationType.AttachesTo]: 'var(--chart-3)',
  [RelationType.DependsOn]: 'var(--chart-4)',
}

// Edge color based on relation type and state
const edgeColor = computed(() => {
  if (props.data?.dimmed)
    return 'var(--muted-foreground)'
  if (props.data?.relationType) {
    return relationTypeColors[props.data.relationType]
  }
  return 'var(--ring)'
})

// Unique marker ID for this edge (so each edge can have its own colored marker)
const markerId = computed(() => `marker-${props.id}`)

const edgeStyle = computed(() => {
  const baseStyle = {
    strokeWidth: props.data?.highlighted ? 3 : 2,
    stroke: edgeColor.value,
    transition: 'all 0.3s ease',
    opacity: props.data?.dimmed ? 0.3 : 1,
    pointerEvents: 'none', // Allow clicks to pass through to nodes/pane
    ...props.style,
  }
  return baseStyle
})

const labelClasses = computed(() => ({
  'edmm-edge__label': true,
  'edmm-edge__label--highlighted': props.data?.highlighted,
  'edmm-edge__label--dimmed': props.data?.dimmed,
}))
</script>

<template>
  <!-- Custom marker for this edge -->
  <EdmmMarker :id="markerId" :color="edgeColor" />

  <!-- Base edge -->
  <BaseEdge
    :id="id"
    :path="path.edgePath"
    :marker-end="`url(#${markerId})`"
    :style="edgeStyle"
    :class="edgeClasses"
  />

  <!-- Animated flow overlay for highlighted edges -->
  <path
    v-if="data?.highlighted"
    :d="path.edgePath"
    class="edmm-edge__flow"
    fill="none"
  />

  <EdgeLabelRenderer v-if="data?.label">
    <div
      :class="labelClasses"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path.labelX}px, ${path.labelY}px)`,
        pointerEvents: 'none',
      }"
    >
      {{ data.label }}
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.edmm-edge__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--foreground);
  background: var(--card);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  backdrop-filter: blur(4px);
  transition: all 0.3s ease;
  white-space: nowrap;
}

.edmm-edge__label:hover {
  background: var(--accent);
  border-color: var(--ring);
}

.edmm-edge__label--highlighted {
  color: var(--chart-2);
  background: color-mix(in oklch, var(--chart-2) 15%, var(--card));
  border-color: color-mix(in oklch, var(--chart-2) 40%, transparent);
  box-shadow: 0 0 10px color-mix(in oklch, var(--chart-2) 20%, transparent);
}

.edmm-edge__label--dimmed {
  opacity: 0.3;
  color: var(--muted-foreground);
}

/* Flowing animation for highlighted edges */
.edmm-edge__flow {
  stroke: rgba(255, 255, 255, 0.6);
  stroke-width: 2;
  stroke-dasharray: 6 12;
  animation: edge-flow 0.5s linear infinite;
  pointer-events: none;
}

@keyframes edge-flow {
  from {
    stroke-dashoffset: 0;
  }
  to {
    stroke-dashoffset: -18;
  }
}
</style>
