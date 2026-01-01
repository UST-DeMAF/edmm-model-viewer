<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import type { ComponentAssignment, EdmmDeploymentModel } from '~/lib/io'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import { useHoveredNode } from '~/composables/useHoveredNode'
import {
  applyEdgeHighlights,
  applyNodeHighlights,
  computeHighlights,
} from '~/lib/graph-highlighting'
import { computeGraphLayout, getRelationType } from '~/lib/graph-layout'
import { isTypeVisible } from '~/lib/type-hierarchy'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import EdgeLegend from './EdgeLegend.vue'
import EdmmEdge from './graph/EdmmEdge.vue'
import EdmmNode from './graph/EdmmNode.vue'
import GraphSettings from './GraphSettings.vue'
import NodeInfoPanel from './NodeInfoPanel.vue'

const props = defineProps<{
  model: EdmmDeploymentModel
}>()

const emit = defineEmits<{
  close: []
}>()

// Mark components as raw to prevent Vue reactivity warnings
const nodeTypes = {
  default: markRaw(EdmmNode),
} as any

const edgeTypes = {
  edmm: markRaw(EdmmEdge),
} as any

// Hovered node for highlighting (triggered on hover)
const hoveredNode = useHoveredNode()

// Selected node for info panel (triggered on click)
const selectedNode = shallowRef<Node | null>(null)

const { onNodeClick, onPaneClick } = useVueFlow()

onNodeClick(({ node }) => {
  selectedNode.value = node.data?.isGroupNode ? null : node
})
onPaneClick(() => selectedNode.value = null)

// Get the component data for the selected node
const selectedComponent = computed<ComponentAssignment | null>(() => {
  if (!selectedNode.value)
    return null
  return props.model.components[selectedNode.value.id] ?? null
})

// Use the graph settings store
const settingsStore = useGraphSettingsStore()

// Reactive state for laid out nodes and edges
const layoutedNodes = ref<Node[]>([])
const rawEdges = ref<Array<{ id: string, source: string, target: string, label?: string }>>([])

// Run layout when model or config changes
watch(
  [() => props.model, () => settingsStore.config],
  () => {
    const result = computeGraphLayout(props.model, settingsStore.config)
    layoutedNodes.value = result.nodes
    rawEdges.value = result.edges
  },
  { immediate: true, deep: true },
)

// Compute highlighted nodes and edges based on hovered node and interaction mode
const highlights = computed(() => {
  return computeHighlights(
    props.model,
    hoveredNode.value?.id ?? null,
    settingsStore.interactionMode,
    settingsStore.config.visibleRelations,
  )
})

// Apply highlighting to nodes (skip hover highlighting in NORMAL mode)
const displayNodes = computed<Node[]>(() => {
  const isNormalMode = settingsStore.interactionMode === 'NORMAL'
  let nodes = applyNodeHighlights(
    layoutedNodes.value,
    highlights.value.highlightedNodeIds,
    !isNormalMode && !!hoveredNode.value,
  )

  // Check if search is active (search panel is open)
  const isSearchActive = settingsStore.isSearchOpen
  const query = settingsStore.searchQuery.trim().toLowerCase()

  // Check if hover interaction is active (non-NORMAL mode with a hovered node)
  const isHoverInteractionActive = !isNormalMode && !!hoveredNode.value

  // Apply node type filtering ONLY if neither search NOR hover interaction is active
  // Both search and hover interaction override node type filter while active
  if (!isSearchActive && !isHoverInteractionActive) {
    const visibleTypes = settingsStore.visibleNodeTypes ?? []
    const componentTypes = props.model.component_types ?? {}
    if (visibleTypes.length > 0) {
      nodes = nodes.map((node) => {
        const nodeType = node.data?.type ?? ''
        const typeVisible = isTypeVisible(nodeType, visibleTypes, componentTypes)
        return {
          ...node,
          data: {
            ...node.data,
            dimmed: node.data.dimmed || !typeVisible,
          },
        }
      })
    }
  }

  // Apply search-based filtering when search is active and has a query
  if (query) {
    nodes = nodes.map((node) => {
      const nodeId = node.id.toLowerCase()
      const matches = nodeId.includes(query)
      return {
        ...node,
        data: {
          ...node.data,
          searchQuery: query,
          // Dim nodes that don't match the search query
          dimmed: node.data.dimmed || !matches,
        },
      }
    })
  }

  // Build class string for each node based on state
  return nodes.map((node) => {
    const classes = ['edmm-node']
    if (node.data?.isGroupNode)
      classes.push('edmm-node--group')
    if (node.data?.dimmed)
      classes.push('edmm-node--dimmed')
    if (node.data?.highlighted)
      classes.push('edmm-node--highlighted')

    return {
      ...node,
      class: classes.join(' '),
    }
  })
})

// Apply highlighting to edges and add custom type
// Filter by visibleRelations (display-only filtering, doesn't affect layout)
const displayEdges = computed<Edge[]>(() => {
  // First, filter edges by visible relation types
  const filteredEdges = rawEdges.value.filter((edge) => {
    const relationType = edge.label ? getRelationType(edge.label) : null
    // Show edge if relation type is unknown or is in the visible list
    return !relationType || settingsStore.config.visibleRelations.includes(relationType)
  })

  const edgesWithData = filteredEdges.map(edge => ({
    ...edge,
    type: 'edmm',
    data: {
      label: settingsStore.showEdgeLabels ? edge.label : undefined,
      relationType: edge.label ? getRelationType(edge.label) : null,
    },
  }))
  const isNormalMode = settingsStore.interactionMode === 'NORMAL'
  return applyEdgeHighlights(
    edgesWithData,
    highlights.value.highlightedEdgeIds,
    !isNormalMode && !!hoveredNode.value,
  )
})

function closeInfoPanel() {
  selectedNode.value = null
}
</script>

<template>
  <div class="flex h-full w-full relative overflow-hidden">
    <!-- Settings Dropdown -->
    <GraphSettings :component-types="model.component_types" @close="emit('close')" />

    <div class="grow h-full relative">
      <EdgeLegend class="bottom-3 left-3 absolute z-[999999]" />
      <VueFlow
        :key="`${settingsStore.hostedOnRelationDisplay}-${settingsStore.config.layoutDirection}`"
        :nodes="displayNodes"
        :edges="displayEdges"
        :nodes-draggable="false"
        :nodes-connectable="false"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :min-zoom="0.3"
        :max-zoom="2.5"
        :zoom-on-double-click="false"
      >
        <Background />
      </VueFlow>
    </div>

    <!-- Node Info Panel -->
    <NodeInfoPanel
      :node="selectedNode"
      :component="selectedComponent"
      :component-types="model.component_types"
      @close="closeInfoPanel"
    />
  </div>
</template>

<style>
/* Smooth transition for node positions when layout changes */
.vue-flow__node {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Also animate edges for smoother experience */
.vue-flow__edge path {
  transition: d 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/*
 * Node styling applied to Vue Flow's native wrapper
 * Theme is INVERTED for better contrast:
 * - In LIGHT mode (no .dark class): use DARK node colors
 * - In DARK mode (.dark class): use LIGHT node colors
 */

/* Default: Dark node colors (used when app is in light mode) */
.vue-flow__node.edmm-node {
  --node-background: oklch(0.269 0 0);
  --node-foreground: oklch(0.985 0 0);
  --node-border: oklch(0.35 0 0);
  --node-ring: oklch(0.5 0 0);
  --node-highlight-bg: oklch(0.627 0.265 303.9);
}

/* When app is in dark mode: Light node colors */
.dark .vue-flow__node.edmm-node {
  --node-background: oklch(0.97 0 0);
  --node-foreground: oklch(0.205 0 0);
  --node-border: oklch(0.85 0 0);
  --node-ring: oklch(0.708 0 0);
  --node-highlight-bg: oklch(0.828 0.189 84.429);
}

/* Base node styles - use !important to override Vue Flow defaults */
.vue-flow__node.edmm-node {
  background: var(--node-background) !important;
  border: 2px solid var(--node-border) !important;
  border-radius: 12px !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05) !important;
  transition:
    all 0.2s ease-out,
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  overflow: visible !important;
  padding: 0 10px !important;
}

.vue-flow__node.edmm-node:hover {
  border-color: var(--node-ring);
}

/* Dimmed state for non-highlighted nodes */
.vue-flow__node.edmm-node.edmm-node--dimmed {
  opacity: 0.35;
  filter: grayscale(0.5);
}

.vue-flow__node.edmm-node.edmm-node--dimmed:hover {
  opacity: 0.6;
}

/* Selected node state */
.vue-flow__node.edmm-node.selected {
  border-color: oklch(0.597 0.2069 255.56 / 0.7);
  box-shadow: 0 0 20px 0 oklch(0.597 0.2069 255.56 / 0.7);
}

/* Group node styles */
.vue-flow__node.edmm-node.edmm-node--group {
  background: color-mix(in oklch, var(--node-background) 50%, transparent);
  border: 2px dashed var(--node-border);
  padding: 0;
}

/* Highlighted node state */
.vue-flow__node.edmm-node.edmm-node--highlighted {
  border-color: var(--node-ring);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.25),
    0 0 0 2px var(--node-ring);
}
</style>
