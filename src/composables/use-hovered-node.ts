import type { GraphNode, NodeMouseEvent } from '@vue-flow/core'
import { useVueFlow } from '@vue-flow/core'
import { shallowRef } from 'vue'

/**
 * Composable to track the currently hovered node in a Vue Flow graph.
 * Uses nodeMouseEnter and nodeMouseLeave events to update the hovered node ref.
 *
 * @returns A shallowRef containing the currently hovered GraphNode or null
 */
export function useHoveredNode() {
  const hoveredNode = shallowRef<GraphNode | null>(null)

  const { onNodeMouseEnter, onNodeMouseLeave } = useVueFlow()

  onNodeMouseEnter(({ node }: NodeMouseEvent) => {
    hoveredNode.value = node
  })

  onNodeMouseLeave(() => {
    hoveredNode.value = null
  })

  return hoveredNode
}
