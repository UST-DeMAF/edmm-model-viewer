import type { GraphNode, Node } from '@vue-flow/core'
import type { Ref } from 'vue'
import type { HighlightResult } from '~/lib/graph-highlighting'
import type { EdmmDeploymentModel } from '~/lib/io'
import { computed } from 'vue'
import {
    applyNodeHighlights,
    computeHighlights,
    computeShortestPathHighlights,
    computeShortestPaths,
} from '~/lib/graph-highlighting'
import { isTypeVisible } from '~/lib/type-hierarchy'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

/**
 * Composable that computes the final list of display-ready nodes for VueFlow.
 *
 * Responsibilities:
 * - Shortest-path computation (forward / reverse)
 * - Highlight computation (all interaction modes)
 * - Visibility filtering (hide / show nodes)
 * - Node-type dimming
 * - Search-based dimming
 * - CSS class & style assembly (type colors, shapes)
 */
export function useDisplayNodes(
    layoutedNodes: Ref<Node[]>,
    hoveredNode: Readonly<Ref<GraphNode | null>>,
    selectedNode: Readonly<Ref<Node | null>>,
    model: Readonly<Ref<EdmmDeploymentModel | null>>,
) {
    const graphStore = useGraphStore()
    const settingsStore = useGraphSettingsStore()

    // ---- Effective highlight target ----
    const effectiveHighlightNodeId = computed(() => {
        if (hoveredNode.value?.id)
            return hoveredNode.value.id
        if (selectedNode.value?.id && !selectedNode.value.data?.isGroupNode)
            return selectedNode.value.id
        return null
    })

    // ---- Shortest-path computations ----
    const forwardPaths = computed(() => {
        const anchorNode = graphStore.shortestPathAnchorNode
        if (
            !anchorNode
            || settingsStore.interactionMode !== 'SHORTEST_PATH'
            || !model.value
        ) {
            return new Map<string, { path: string[], edges: string[] }>()
        }
        return computeShortestPaths(
            model.value,
            anchorNode,
            graphStore.hiddenRelations,
        )
    })

    const reversePaths = computed(() => {
        const hoveredNodeId = hoveredNode.value?.id
        if (
            !hoveredNodeId
            || settingsStore.interactionMode !== 'SHORTEST_PATH'
            || !model.value
        ) {
            return new Map<string, { path: string[], edges: string[] }>()
        }
        return computeShortestPaths(
            model.value,
            hoveredNodeId,
            graphStore.hiddenRelations,
        )
    })

    // ---- Highlights (shared between nodes and edges) ----
    const highlights = computed<HighlightResult>(() => {
        if (settingsStore.interactionMode === 'SHORTEST_PATH') {
            const anchorNode = graphStore.shortestPathAnchorNode
            if (anchorNode) {
                return computeShortestPathHighlights(
                    forwardPaths.value,
                    reversePaths.value,
                    hoveredNode.value?.id ?? null,
                    anchorNode,
                )
            }
            return {
                highlightedNodeIds: new Set<string>(),
                highlightedEdgeIds: new Set<string>(),
                nodeDistances: new Map<string, number>(),
            }
        }

        if (!model.value) {
            return {
                highlightedNodeIds: new Set<string>(),
                highlightedEdgeIds: new Set<string>(),
                nodeDistances: new Map<string, number>(),
            }
        }
        return computeHighlights(
            model.value,
            effectiveHighlightNodeId.value,
            settingsStore.interactionMode,
            graphStore.hiddenRelations,
            settingsStore.highlightRange,
        )
    })

    // ---- Display-ready nodes ----
    const displayNodes = computed<Node[]>(() => {
        const isNormalMode = settingsStore.interactionMode === 'NORMAL'
        const isShortestPathMode
            = settingsStore.interactionMode === 'SHORTEST_PATH'
        const shortestPathActive
            = isShortestPathMode
              && !!graphStore.shortestPathAnchorNode
              && !!hoveredNode.value
        const hasSelection
            = (!isNormalMode
              && !isShortestPathMode
              && !!effectiveHighlightNodeId.value)
            || shortestPathActive

        // 1. Visible-node filter
        const visibleNodeIdsFilter = graphStore.visibleNodeIds
        let filteredNodes = layoutedNodes.value
        if (visibleNodeIdsFilter !== null && visibleNodeIdsFilter.length > 0) {
            const visibleSet = new Set(visibleNodeIdsFilter)
            filteredNodes = filteredNodes.filter(node => visibleSet.has(node.id))
        }

        // 2. Highlight logic
        let nodes = applyNodeHighlights(
            filteredNodes,
            highlights.value.highlightedNodeIds,
            hasSelection,
        )

        // 3. BFS distance injection
        const distances = highlights.value.nodeDistances
        if (hasSelection && distances.size > 0) {
            nodes = nodes.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    distance: distances.get(node.id) ?? undefined,
                },
            }))
        }

        // 4. Node-type dimming
        const isSearchActive = settingsStore.isSearchOpen
        const query = settingsStore.searchQuery.trim().toLowerCase()
        const isHoverInteractionActive
            = !isNormalMode && !!effectiveHighlightNodeId.value

        if (!isSearchActive && !isHoverInteractionActive) {
            const visibleTypes = graphStore.visibleNodeTypes ?? []
            const componentTypes = model.value?.component_types ?? {}
            if (visibleTypes.length > 0) {
                nodes = nodes.map((node) => {
                    const nodeType = node.data?.type ?? ''
                    const typeVisible = isTypeVisible(
                        nodeType,
                        visibleTypes,
                        componentTypes,
                    )
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

        // 5. Search dimming
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
                        dimmed: node.data.dimmed || !matches,
                    },
                }
            })
        }
        else if (query) {
            nodes = nodes.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    searchQuery: query,
                },
            }))
        }

        // 6. CSS class & style assembly
        return nodes.map((node) => {
            const classes = ['edmm-node']
            if (node.data?.isGroupNode)
                classes.push('edmm-node--group')
            if (node.data?.dimmed)
                classes.push('edmm-node--dimmed')
            if (node.data?.highlighted)
                classes.push('edmm-node--highlighted')

            // Type color
            const typeColorInfo
                = settingsStore.typeDifferentiationMode === 'COLOR' && node.data?.type
                    ? graphStore.getComponentTypeColor(node.data.type)
                    : undefined

            if (typeColorInfo)
                classes.push('edmm-node--type-colored')
            if (typeColorInfo?.textured)
                classes.push('edmm-node--textured')

            // Type shape
            const nodeShape
                = settingsStore.typeDifferentiationMode === 'SHAPE'
                  && graphStore.isShapeModeAvailable
                  && node.data?.type
                    ? graphStore.getComponentTypeShape(node.data.type)
                    : undefined

            if (nodeShape)
                classes.push(`edmm-node--shape-${nodeShape}`)

            // Merge style
            const mergedStyle = typeColorInfo
                ? { ...node.style, '--type-color': typeColorInfo.bg }
                : node.style

            if (typeColorInfo)
                classes.push(`edmm-node--type-${typeColorInfo.type}`)

            return {
                ...node,
                class: classes.join(' '),
                style: mergedStyle,
                data: {
                    ...node.data,
                    typeColorInfo,
                    shape: nodeShape,
                },
            }
        })
    })

    return {
        effectiveHighlightNodeId,
        highlights,
        displayNodes,
    }
}
