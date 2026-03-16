<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Background } from '@vue-flow/background'
import { VueFlow } from '@vue-flow/core'
import { EyeIcon, EyeOffIcon } from 'lucide-vue-next'
import { useDisplayEdges } from '~/composables/use-display-edges'
import { useDisplayNodes } from '~/composables/use-display-nodes'
import { useGraphInteraction } from '~/composables/use-graph-interaction'
import { useHoveredNode } from '~/composables/use-hovered-node'
import { computeGraphLayout } from '~/lib/graph-layout'
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

const graphStore = useGraphStore()
const settingsStore = useGraphSettingsStore()

const model = computed(() => graphStore.model)

const nodeTypes = {
  default: markRaw(EdmmNode),
} as any

const edgeTypes = {
  edmm: markRaw(EdmmEdge),
} as any

const hoveredNode = useHoveredNode()

// ---- Layout ----
const layoutedNodes = ref<Node[]>([])
const rawEdges = ref<Array<{
  id: string
  source: string
  target: string
  label?: string
  description?: string | null
  properties?: Record<string, unknown>
  operations?: Record<string, unknown>
}>>([])

const {
  selectedNode,
  selectedEdge,
  hoveredEdgeId,
  hasSelectedNodes,
  isNodeFilterActive,
  selectedComponent,
  selectedRelation,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  hideUnselectedNodes,
  closeInfoPanel,
  updateNode,
} = useGraphInteraction(vueFlow, model)

watch(
  [model, () => settingsStore.config, () => graphStore.hiddenRelations],
  async () => {
    if (!model.value)
      return
    const result = await computeGraphLayout(model.value, settingsStore.config, graphStore.hiddenRelations)
    layoutedNodes.value = result.nodes
    rawEdges.value = result.edges

    // Programmatically push updated positions into VueFlow's internal state.
    // Without this, VueFlow keeps its cached positions and nodes only visually
    // move on hover (when the individual node component re-renders).
    for (const node of result.nodes) {
      updateNode(node.id, { position: node.position, style: node.style })
    }
  },
  { immediate: true, deep: true },
)

const { displayNodes, highlights, effectiveHighlightNodeId } = useDisplayNodes(
  layoutedNodes,
  hoveredNode,
  selectedNode,
  model,
)

const { displayEdges } = useDisplayEdges(
  layoutedNodes,
  rawEdges,
  hoveredNode,
  hoveredEdgeId,
  effectiveHighlightNodeId,
  highlights,
  model,
)
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
              <span>Showing <strong class="text-foreground">{{ graphStore.visibleNodeIds?.length }}</strong> of <strong class="text-foreground">{{ layoutedNodes.length }}</strong> nodes</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="text-xs h-7"
              @click="graphStore.showAllNodes()"
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
            :delete-key-code="null"
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
          @click="graphStore.showAllNodes()"
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
