<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import type { ComponentAssignment, EdmmDeploymentModel } from '~/lib/io'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import {
  applyEdgeHighlights,
  applyNodeHighlights,
  computeHighlights,
} from '~/lib/graph-highlighting'
import { computeGraphLayout, getRelationType } from '~/lib/graph-layout'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import EdmmEdge from './graph/EdmmEdge.vue'
import EdmmNode from './graph/EdmmNode.vue'
import GraphSettings from './GraphSettings.vue'
import NodeInfoPanel from './NodeInfoPanel.vue'

const props = defineProps<{
  model: EdmmDeploymentModel
}>()

// Mark components as raw to prevent Vue reactivity warnings
const nodeTypes = {
  default: markRaw(EdmmNode),
} as any

const edgeTypes = {
  edmm: markRaw(EdmmEdge),
} as any

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

// Compute highlighted nodes and edges based on selection and interaction mode
const highlights = computed(() => {
  return computeHighlights(
    props.model,
    selectedNode.value?.id ?? null,
    settingsStore.interactionMode,
    settingsStore.config.visibleRelations,
  )
})

// Apply highlighting to nodes
const displayNodes = computed<Node[]>(() => {
  const nodes = applyNodeHighlights(
    layoutedNodes.value,
    highlights.value.highlightedNodeIds,
    !!selectedNode.value,
  )

  // Apply search-based filtering
  const query = settingsStore.searchQuery.trim().toLowerCase()
  if (!query)
    return nodes

  return nodes.map((node) => {
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
  return applyEdgeHighlights(
    edgesWithData,
    highlights.value.highlightedEdgeIds,
    !!selectedNode.value,
  )
})

function closeInfoPanel() {
  selectedNode.value = null
}
</script>

<template>
  <div class="h-full w-full relative">
    <VueFlow
      :key="`${settingsStore.hostedOnRelationDisplay}`"
      :nodes="displayNodes"
      :edges="displayEdges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :min-zoom="0.3"
      :max-zoom="2.5"
    >
      <Background />
    </VueFlow>

    <!-- Settings Dropdown -->
    <GraphSettings />

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
</style>
