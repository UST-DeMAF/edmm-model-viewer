import type { Edge, Node } from '@vue-flow/core'
import type { ComponentAssignment, EdmmDeploymentModel } from '~/lib/io'
import { useVueFlow } from '@vue-flow/core'
import { computed, ref, shallowRef } from 'vue'
import { hasMetadata } from '~/lib/graph-metadata'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

/**
 * Composable that encapsulates all click / hover / selection interaction logic
 * for the EDMM graph. Returns the reactive selection state and event handlers
 * that EdmmGraph.vue can wire directly to VueFlow.
 */
export function useGraphInteraction(
    vueFlowRef: Readonly<{ value: any }>,
    model: Readonly<{ value: EdmmDeploymentModel | null }>,
) {
    const graphStore = useGraphStore()
    const settingsStore = useGraphSettingsStore()

    // ---- Selection state ----
    const selectedNode = shallowRef<Node | null>(null)
    const selectedEdge = shallowRef<Edge | null>(null)
    const hoveredEdgeId = ref<string | null>(null)

    // ---- VueFlow event hooks ----
    const { onNodeClick, onEdgeClick, onPaneClick, updateNode } = useVueFlow()

    onNodeClick(({ node }) => {
        if (settingsStore.interactionMode === 'SHORTEST_PATH') {
            if (!node.data?.isGroupNode) {
                graphStore.shortestPathAnchorNode = node.id
                selectedNode.value = node
                selectedEdge.value = null
            }
        }
        else {
            selectedNode.value = node.data?.isGroupNode ? null : node
            selectedEdge.value = null
        }
    })

    onEdgeClick(({ edge }) => {
        if (hasMetadata(edge.data)) {
            selectedEdge.value = edge
            selectedNode.value = null
        }
    })

    onPaneClick(() => {
        selectedNode.value = null
        selectedEdge.value = null
        if (settingsStore.interactionMode === 'SHORTEST_PATH') {
            graphStore.shortestPathAnchorNode = null
        }
    })

    // ---- Edge hover handlers (for glow effect) ----
    function onEdgeMouseEnter(event: { edge: Edge }) {
        if (hasMetadata(event.edge.data)) {
            hoveredEdgeId.value = event.edge.id
        }
    }

    function onEdgeMouseLeave() {
        hoveredEdgeId.value = null
    }

    // ---- Context-menu: hide / show nodes ----
    function hideUnselectedNodes() {
        const selectedNodes = vueFlowRef.value?.getSelectedNodes
        if (selectedNodes && selectedNodes.length > 0) {
            const selectedIds = selectedNodes.map((n: Node) => n.id)
            graphStore.setVisibleNodeIds(selectedIds)
        }
    }

    const hasSelectedNodes = computed(() => {
        const selectedNodes = vueFlowRef.value?.getSelectedNodes
        return selectedNodes && selectedNodes.length > 0
    })

    const isNodeFilterActive = computed(() => {
        return graphStore.visibleNodeIds !== null && graphStore.visibleNodeIds.length > 0
    })

    // ---- Derived data for the info panel ----
    const selectedComponent = computed<ComponentAssignment | null>(() => {
        if (!selectedNode.value || !model.value)
            return null
        return model.value.components[selectedNode.value.id] ?? null
    })

    const selectedRelation = computed(() => {
        if (!selectedEdge.value || !model.value?.relations)
            return null
        return model.value.relations[selectedEdge.value.id] ?? null
    })

    // ---- Close info panel ----
    function closeInfoPanel() {
        selectedNode.value = null
        selectedEdge.value = null
    }

    return {
        // Selection state
        selectedNode,
        selectedEdge,
        hoveredEdgeId,

        // Computed helpers
        hasSelectedNodes,
        isNodeFilterActive,
        selectedComponent,
        selectedRelation,

        // Event handlers
        onEdgeMouseEnter,
        onEdgeMouseLeave,
        hideUnselectedNodes,
        closeInfoPanel,

        // VueFlow action passthrough
        updateNode,
    }
}
