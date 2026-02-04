<script setup lang="ts">
import type { Edge, Node } from '@vue-flow/core'
import type { ComponentAssignment } from '~/lib/io'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Background } from '@vue-flow/background'
import { useVueFlow, VueFlow } from '@vue-flow/core'
import { EyeIcon, EyeOffIcon } from 'lucide-vue-next'
import { useHoveredNode } from '~/composables/useHoveredNode'
import {
  applyEdgeHighlights,
  applyNodeHighlights,
  computeHighlights,
  computeShortestPathHighlights,
  computeShortestPaths,
} from '~/lib/graph-highlighting'
import { computeGraphLayout, isRelationVisible } from '~/lib/graph-layout'
import { isTypeVisible } from '~/lib/type-hierarchy'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import EdgeLegend from './EdgeLegend.vue'
import ElementInfoPanel from './ElementInfoPanel.vue'
import EdmmEdge from './graph/EdmmEdge.vue'
import EdmmNode from './graph/EdmmNode.vue'
import GraphSettings from './GraphSettings.vue'
import InteractionModeHelper from './InteractionModeHelper.vue'
import NodeLegend from './NodeLegend.vue'

const emit = defineEmits<{
  close: []
}>()

const vueFlow = ref<typeof VueFlow | null>(null)

// Access the graph store for the model
const graphStore = useGraphStore()

// Computed property for safe model access
const model = computed(() => graphStore.model)

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

// Selected edge for info panel (triggered on click)
const selectedEdge = shallowRef<Edge | null>(null)

// Hovered edge for glow effect (tracked via edge mouse events)
const hoveredEdgeId = ref<string | null>(null)

// Use the graph settings store
const settingsStore = useGraphSettingsStore()

const { onNodeClick, onEdgeClick, onPaneClick } = useVueFlow()

onNodeClick(({ node }) => {
  // In SHORTEST_PATH mode, clicking sets the anchor node AND opens the info panel
  if (settingsStore.interactionMode === 'SHORTEST_PATH') {
    if (!node.data?.isGroupNode) {
      settingsStore.shortestPathAnchorNode = node.id
      selectedNode.value = node
      selectedEdge.value = null
    }
  }
  else {
    selectedNode.value = node.data?.isGroupNode ? null : node
    selectedEdge.value = null // Clear edge selection when node is selected
  }
})

onEdgeClick(({ edge }) => {
  // Check if edge has metadata worth displaying
  const data = edge.data
  const hasMetadata = (data?.description !== null && data?.description !== undefined && data?.description !== '')
    || (data?.properties && Object.keys(data.properties).length > 0)
    || (data?.operations && Object.keys(data.operations).length > 0)

  if (hasMetadata) {
    selectedEdge.value = edge
    selectedNode.value = null // Clear node selection when edge is selected
  }
})

onPaneClick(() => {
  selectedNode.value = null
  selectedEdge.value = null
  // Clear anchor node when clicking on pane in SHORTEST_PATH mode
  if (settingsStore.interactionMode === 'SHORTEST_PATH') {
    settingsStore.shortestPathAnchorNode = null
  }
})

// Context menu handler: Hide unselected nodes
function hideUnselectedNodes() {
  // Access the VueFlow instance methods via the ref
  const selectedNodes = vueFlow.value?.getSelectedNodes
  if (selectedNodes && selectedNodes.length > 0) {
    const selectedIds = selectedNodes.map((n: Node) => n.id)
    settingsStore.setVisibleNodeIds(selectedIds)
  }
}

// Check if we have any selected nodes (to enable/disable context menu item)
const hasSelectedNodes = computed(() => {
  const selectedNodes = vueFlow.value?.getSelectedNodes
  return selectedNodes && selectedNodes.length > 0
})

// Check if node filter is currently active
const isNodeFilterActive = computed(() => {
  return settingsStore.visibleNodeIds !== null && settingsStore.visibleNodeIds.length > 0
})

// Get the component data for the selected node
const selectedComponent = computed<ComponentAssignment | null>(() => {
  if (!selectedNode.value || !model.value)
    return null
  return model.value.components[selectedNode.value.id] ?? null
})

// Get the relation data for the selected edge
const selectedRelation = computed(() => {
  if (!selectedEdge.value || !model.value?.relations)
    return null
  // The edge ID is the relation name in the model
  return model.value.relations[selectedEdge.value.id] ?? null
})

// Reactive state for laid out nodes and edges
const layoutedNodes = ref<Node[]>([])
const rawEdges = ref<Array<{ id: string, source: string, target: string, label?: string, description?: string | null, properties?: Record<string, unknown>, operations?: Record<string, unknown> }>>([])

// Run layout when model or config changes
watch(
  [model, () => settingsStore.config],
  async () => {
    if (!model.value)
      return
    const result = await computeGraphLayout(model.value, settingsStore.config)
    layoutedNodes.value = result.nodes
    rawEdges.value = result.edges
  },
  { immediate: true, deep: true },
)

// Compute shortest paths from anchor node (for SHORTEST_PATH mode) - forward direction
const forwardPaths = computed(() => {
  const anchorNode = settingsStore.shortestPathAnchorNode
  if (!anchorNode || settingsStore.interactionMode !== 'SHORTEST_PATH' || !model.value) {
    return new Map<string, { path: string[], edges: string[] }>()
  }
  return computeShortestPaths(model.value, anchorNode, settingsStore.config.hiddenRelations)
})

// Compute shortest paths from hovered node (for SHORTEST_PATH mode) - reverse direction
const reversePaths = computed(() => {
  const hoveredNodeId = hoveredNode.value?.id
  if (!hoveredNodeId || settingsStore.interactionMode !== 'SHORTEST_PATH' || !model.value) {
    return new Map<string, { path: string[], edges: string[] }>()
  }
  return computeShortestPaths(model.value, hoveredNodeId, settingsStore.config.hiddenRelations)
})

// Compute highlighted nodes and edges based on hovered node and interaction mode
const highlights = computed(() => {
  // Handle SHORTEST_PATH mode separately
  if (settingsStore.interactionMode === 'SHORTEST_PATH') {
    const anchorNode = settingsStore.shortestPathAnchorNode
    if (anchorNode) {
      return computeShortestPathHighlights(
        forwardPaths.value,
        reversePaths.value,
        hoveredNode.value?.id ?? null,
        anchorNode,
      )
    }
    return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>() }
  }

  if (!model.value) {
    return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>() }
  }
  return computeHighlights(
    model.value,
    hoveredNode.value?.id ?? null,
    settingsStore.interactionMode,
    settingsStore.config.hiddenRelations,
  )
})

// Apply highlighting to nodes (skip hover highlighting in NORMAL mode)
const displayNodes = computed<Node[]>(() => {
  const isNormalMode = settingsStore.interactionMode === 'NORMAL'
  const isShortestPathMode = settingsStore.interactionMode === 'SHORTEST_PATH'
  // For SHORTEST_PATH mode: hasSelection = anchor node set AND hovering
  const shortestPathActive = isShortestPathMode && !!settingsStore.shortestPathAnchorNode && !!hoveredNode.value
  const hasSelection = (!isNormalMode && !isShortestPathMode && !!hoveredNode.value) || shortestPathActive

  // First, apply visible node IDs filter (from "Hide unselected nodes" feature)
  const visibleNodeIdsFilter = settingsStore.visibleNodeIds
  let filteredNodes = layoutedNodes.value
  if (visibleNodeIdsFilter !== null && visibleNodeIdsFilter.length > 0) {
    const visibleSet = new Set(visibleNodeIdsFilter)
    filteredNodes = filteredNodes.filter(node => visibleSet.has(node.id))
  }

  let nodes = applyNodeHighlights(
    filteredNodes,
    highlights.value.highlightedNodeIds,
    hasSelection,
  )

  // Check if search is active (search panel is open)
  const isSearchActive = settingsStore.isSearchOpen
  const query = settingsStore.searchQuery.trim().toLowerCase()

  // Check if hover interaction is active (non-NORMAL mode with a hovered node)
  const isHoverInteractionActive = !isNormalMode && !!hoveredNode.value

  // Apply node type filtering ONLY if neither search NOR hover interaction is active
  // Both search and hover interaction override node type filter while active
  if (!isSearchActive && !isHoverInteractionActive) {
    const visibleTypes = graphStore.visibleNodeTypes ?? []
    const componentTypes = model.value?.component_types ?? {}
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
  // BUT: Interaction mode highlighting (successor, predecessor, neighbour, shortest path)
  // should OVERWRITE search highlighting when actively hovering
  const isInteractionHighlightingActive = hasSelection
  if (query && !isInteractionHighlightingActive) {
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
  else if (query) {
    // Still pass the searchQuery so the node can show highlighting text,
    // but don't apply dimming based on search (interaction mode takes precedence)
    nodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        searchQuery: query,
      },
    }))
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

    // Add type-based color if COLOR mode is enabled
    const typeColor = settingsStore.typeDifferentiationMode === 'COLOR' && node.data?.type
      ? graphStore.getComponentTypeColor(node.data.type)
      : undefined

    if (typeColor)
      classes.push('edmm-node--type-colored')

    // Add type-based shape if SHAPE mode is enabled and available
    const nodeShape = settingsStore.typeDifferentiationMode === 'SHAPE'
      && graphStore.isShapeModeAvailable
      && node.data?.type
      ? graphStore.getComponentTypeShape(node.data.type)
      : undefined

    if (nodeShape)
      classes.push(`edmm-node--shape-${nodeShape}`)

    // Merge type color CSS variable with existing node style (preserving dimensions)
    const mergedStyle = typeColor
      ? { ...node.style, '--type-color': typeColor }
      : node.style

    return {
      ...node,
      class: classes.join(' '),
      style: mergedStyle,
      data: {
        ...node.data,
        typeColor,
        shape: nodeShape,
      },
    }
  })
})

// Apply highlighting to edges and add custom type
// Filter by hiddenRelations (display-only filtering, doesn't affect layout)
const displayEdges = computed<Edge[]>(() => {
  // Get visible node IDs for filtering edges
  const visibleNodeIdsFilter = settingsStore.visibleNodeIds
  const visibleNodeSet = visibleNodeIdsFilter !== null && visibleNodeIdsFilter.length > 0
    ? new Set(visibleNodeIdsFilter)
    : null

  // First, filter edges by visible relation types AND visible nodes
  const filteredEdges = rawEdges.value.filter((edge) => {
    // Check if relation type is visible (uses dynamic string-based filtering)
    const relationVisible = !edge.label || isRelationVisible(edge.label, settingsStore.config.hiddenRelations)

    // If we have a visible node filter, only show edges between visible nodes
    if (visibleNodeSet !== null) {
      const sourceVisible = visibleNodeSet.has(edge.source)
      const targetVisible = visibleNodeSet.has(edge.target)
      // Only show edge if BOTH source and target are visible
      if (!sourceVisible || !targetVisible) {
        return false
      }
    }

    return relationVisible
  })

  // Check if node type filter is active (and no search/hover override)
  const isSearchActive = settingsStore.isSearchOpen
  const isNormalMode = settingsStore.interactionMode === 'NORMAL'
  const isShortestPathMode = settingsStore.interactionMode === 'SHORTEST_PATH'
  const isHoverInteractionActive = !isNormalMode && !isShortestPathMode && !!hoveredNode.value
  const visibleTypes = graphStore.visibleNodeTypes ?? []
  const componentTypes = model.value?.component_types ?? {}

  // Determine if node type filtering should dim edges
  const shouldApplyNodeTypeFilter = !isSearchActive && !isHoverInteractionActive && visibleTypes.length > 0

  // Build a set of visible node IDs for edge filtering
  const visibleNodeIds = new Set<string>()
  if (shouldApplyNodeTypeFilter) {
    for (const node of layoutedNodes.value) {
      const nodeType = node.data?.type ?? ''
      if (isTypeVisible(nodeType, visibleTypes, componentTypes)) {
        visibleNodeIds.add(node.id)
      }
    }
  }

  const edgesWithData = filteredEdges.map((edge) => {
    // Check if edge should be dimmed based on node type filter
    let edgeDimmedByFilter = false
    if (shouldApplyNodeTypeFilter) {
      // Edge is dimmed if NEITHER source NOR target is a visible node type
      const sourceVisible = visibleNodeIds.has(edge.source)
      const targetVisible = visibleNodeIds.has(edge.target)
      edgeDimmedByFilter = !sourceVisible && !targetVisible
    }

    return {
      ...edge,
      type: 'edmm',
      data: {
        label: settingsStore.showEdgeLabels ? edge.label : undefined,
        relationType: edge.label ?? null,
        description: edge.description,
        properties: edge.properties,
        operations: edge.operations,
        hovered: edge.id === hoveredEdgeId.value,
        dimmedByFilter: edgeDimmedByFilter,
      },
    }
  })

  // For SHORTEST_PATH mode: hasSelection = anchor node set AND hovering
  const shortestPathActive = isShortestPathMode && !!settingsStore.shortestPathAnchorNode && !!hoveredNode.value
  const hasSelection = (!isNormalMode && !isShortestPathMode && !!hoveredNode.value) || shortestPathActive

  // Apply highlight logic then merge with filter-based dimming
  const highlightedEdges = applyEdgeHighlights(
    edgesWithData,
    highlights.value.highlightedEdgeIds,
    hasSelection,
  )

  // Apply the node type filter dimming
  return highlightedEdges.map((edge) => {
    const dimmedByFilter = edge.data?.dimmedByFilter ?? false
    return {
      ...edge,
      data: {
        ...edge.data,
        dimmed: edge.data?.dimmed || dimmedByFilter,
      },
    }
  })
})

// Edge mouse event handlers for hover glow effect
function onEdgeMouseEnter(event: { edge: Edge }) {
  // Only set hovered state if edge has metadata
  const data = event.edge.data
  const hasMetadata = (data?.description !== null && data?.description !== undefined && data?.description !== '')
    || (data?.properties && Object.keys(data.properties).length > 0)
    || (data?.operations && Object.keys(data.operations).length > 0)
  if (hasMetadata) {
    hoveredEdgeId.value = event.edge.id
  }
}

function onEdgeMouseLeave() {
  hoveredEdgeId.value = null
}

function closeInfoPanel() {
  selectedNode.value = null
  selectedEdge.value = null
}
</script>

<template>
  <div v-if="model" class="flex h-full w-full relative overflow-hidden">
    <!-- Settings Dropdown -->
    <GraphSettings :component-types="model.component_types" @close="emit('close')" />

    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div class="grow h-full relative">
          <InteractionModeHelper />
          <div class="flex flex-col bottom-3 left-3 absolute z-1">
            <NodeLegend class="rounded-b-0" />
            <EdgeLegend class="rounded-t-0" />
          </div>

          <!-- Floating banner when viewing filtered nodes -->
          <div
            v-if="isNodeFilterActive"
            class="py-2 pe-2 ps-3 border border-border rounded-lg bg-background/95 flex gap-3 shadow-lg translate-x-[-50%] items-center left-50% top-3 absolute z-10 backdrop-blur-sm"
          >
            <div class="text-sm text-muted-foreground flex gap-2 items-center">
              <span>Showing <strong class="text-foreground">{{ settingsStore.visibleNodeIds?.length }}</strong> of <strong class="text-foreground">{{ layoutedNodes.length }}</strong> nodes</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="text-xs h-7"
              @click="settingsStore.showAllNodes()"
            >
              <EyeIcon class="mr-1 h-3 w-3" />
              Show all
            </Button>
          </div>

          <VueFlow
            ref="vueFlow"
            :key="`${settingsStore.config.layoutAlgorithm}-${settingsStore.config.layoutDirection}`"
            :nodes="displayNodes"
            :edges="displayEdges"
            :nodes-draggable="false"
            :nodes-connectable="false"
            :node-types="nodeTypes"
            :edge-types="edgeTypes"
            :min-zoom="0.3"
            :max-zoom="2.5"
            :zoom-on-double-click="false"
            :delete-key-code="false"
            @edge-mouse-enter="onEdgeMouseEnter"
            @edge-mouse-leave="onEdgeMouseLeave"
          >
            <Background />
          </VueFlow>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent class="w-56">
        <ContextMenuItem
          :disabled="!hasSelectedNodes"
          @click="hideUnselectedNodes"
        >
          <EyeOffIcon class="mr-2 h-4 w-4" />
          Hide unselected nodes
        </ContextMenuItem>
        <ContextMenuSeparator v-if="isNodeFilterActive" />
        <ContextMenuItem
          v-if="isNodeFilterActive"
          @click="settingsStore.showAllNodes()"
        >
          <EyeIcon class="mr-2 h-4 w-4" />
          Show all nodes
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <!-- Element Info Panel (nodes and edges) -->
    <ElementInfoPanel
      :node="selectedNode"
      :component="selectedComponent"
      :component-types="model.component_types ?? {}"
      :edge="selectedEdge"
      :relation="selectedRelation"
      :relation-types="model.relation_types ?? {}"
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
    all 0.1s ease-out,
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
  border-color: oklch(0.597 0.2069 255.56 / 0.7) !important;
  box-shadow: 0 0 0 5px var(--colors-foreground) !important;
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

/* Type-based coloring - applies border color from parent type */
.vue-flow__node.edmm-node.edmm-node--type-colored {
  background: linear-gradient(
    to bottom,
    color-mix(in oklch, var(--type-color) 20%, white),
    color-mix(in oklch, var(--type-color) 50%, white)
  ) !important;
  border-color: var(--type-color) !important;
  --node-foreground: black !important;
  --node-background: white !important;
}

/* ===========================================
   Shape-based node differentiation
   =========================================== */

/* Rectangle - default, no changes needed */

/* Circle shape */
.vue-flow__node.edmm-node.edmm-node--shape-circle {
  border-radius: 50% !important;
  aspect-ratio: 1 / 1;
  justify-content: center;
}

/* Hexagon shape - uses ::before pseudo-element for clip-path so handles stay at node boundaries */
.vue-flow__node.edmm-node.edmm-node--shape-hexagon {
  background: transparent !important;
  border: none !important;
  padding: 0 20px !important;
}

.vue-flow__node.edmm-node.edmm-node--shape-hexagon::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%);
  background: var(--node-background);
  z-index: -1;
}

/* Parallelogram shape - uses ::before pseudo-element for clip-path so handles stay at node boundaries */
.vue-flow__node.edmm-node.edmm-node--shape-parallelogram {
  background: transparent !important;
  border: none !important;
  padding: 0 15px !important;
}

.vue-flow__node.edmm-node.edmm-node--shape-parallelogram::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%);
  background: var(--node-background);
  z-index: -1;
}
</style>
