import type { Edge, GraphNode, Node } from '@vue-flow/core'
import type { Ref } from 'vue'
import type { HighlightResult } from '~/lib/graph-highlighting'
import type { EdmmDeploymentModel } from '~/lib/io'
import { computed } from 'vue'
import { applyEdgeHighlights } from '~/lib/graph-highlighting'
import { isRelationVisible } from '~/lib/graph-layout'
import { isTypeVisible } from '~/lib/type-hierarchy'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

/**
 * Composable that computes the final list of display-ready edges for VueFlow.
 *
 * Responsibilities:
 * - Relation-type visibility filtering
 * - Visible-node filtering (edges between hidden nodes are removed)
 * - Node-type dimming
 * - Highlight application
 */
export function useDisplayEdges(
    layoutedNodes: Ref<Node[]>,
    rawEdges: Ref<Array<{
        id: string
        source: string
        target: string
        label?: string
        description?: string | null
        properties?: Record<string, unknown>
        operations?: Record<string, unknown>
    }>>,
    hoveredNode: Readonly<Ref<GraphNode | null>>,
    hoveredEdgeId: Readonly<Ref<string | null>>,
    effectiveHighlightNodeId: Readonly<Ref<string | null>>,
    highlights: Readonly<Ref<HighlightResult>>,
    model: Readonly<Ref<EdmmDeploymentModel | null>>,
) {
    const graphStore = useGraphStore()
    const settingsStore = useGraphSettingsStore()

    const displayEdges = computed<Edge[]>(() => {
        // 1. Visible-node filter
        const visibleNodeIdsFilter = graphStore.visibleNodeIds
        const visibleNodeSet = visibleNodeIdsFilter !== null && visibleNodeIdsFilter.length > 0
            ? new Set(visibleNodeIdsFilter)
            : null

        // 2. Relation-type & visible-node filtering
        const filteredEdges = rawEdges.value.filter((edge) => {
            const relationVisible = !edge.label || isRelationVisible(edge.label, graphStore.hiddenRelations)

            if (visibleNodeSet !== null) {
                const sourceVisible = visibleNodeSet.has(edge.source)
                const targetVisible = visibleNodeSet.has(edge.target)
                if (!sourceVisible || !targetVisible) {
                    return false
                }
            }

            return relationVisible
        })

        // 3. Node-type dimming setup
        const isSearchActive = settingsStore.isSearchOpen
        const isNormalMode = settingsStore.interactionMode === 'NORMAL'
        const isShortestPathMode = settingsStore.interactionMode === 'SHORTEST_PATH'
        const isHoverInteractionActive = !isNormalMode && !isShortestPathMode && !!effectiveHighlightNodeId.value
        const visibleTypes = graphStore.visibleNodeTypes ?? []
        const componentTypes = model.value?.component_types ?? {}

        const shouldApplyNodeTypeFilter = !isSearchActive && !isHoverInteractionActive && visibleTypes.length > 0

        const visibleNodeIds = new Set<string>()
        if (shouldApplyNodeTypeFilter) {
            for (const node of layoutedNodes.value) {
                const nodeType = node.data?.type ?? ''
                if (isTypeVisible(nodeType, visibleTypes, componentTypes)) {
                    visibleNodeIds.add(node.id)
                }
            }
        }

        // 4. Enrich edges with data
        const edgesWithData = filteredEdges.map((edge) => {
            let edgeDimmedByFilter = false
            if (shouldApplyNodeTypeFilter) {
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

        // 5. Apply highlight logic
        const shortestPathActive = isShortestPathMode && !!graphStore.shortestPathAnchorNode && !!hoveredNode.value
        const hasSelection = (!isNormalMode && !isShortestPathMode && !!effectiveHighlightNodeId.value) || shortestPathActive

        const highlightedEdges = applyEdgeHighlights(
            edgesWithData,
            highlights.value.highlightedEdgeIds,
            hasSelection,
        )

        // 6. Merge filter-based dimming
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

    return {
        displayEdges,
    }
}
