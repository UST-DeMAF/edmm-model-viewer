import type { Edge, Node } from '@vue-flow/core'
import type { LayoutConfig } from '~/lib/graph-layout'
import type { EdmmDeploymentModel } from '~/lib/io'
import { isRelationVisible } from '~/lib/graph-layout'

export type InteractionMode = LayoutConfig['interactionMode']

interface HighlightResult {
  highlightedNodeIds: Set<string>
  highlightedEdgeIds: Set<string>
}

/**
 * Build a dependency graph from model relations.
 * Returns two maps:
 * - dependencies: nodeId -> Set of nodeIds that this node depends on (targets of outgoing edges)
 * - dependents: nodeId -> Set of nodeIds that depend on this node (sources of incoming edges)
 */
export function buildDependencyGraph(
  model: EdmmDeploymentModel,
  visibleRelations: string[],
): {
    dependencies: Map<string, Set<string>>
    dependents: Map<string, Set<string>>
    edgeMap: Map<string, { source: string, target: string, id: string }>
  } {
  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  const edgeMap = new Map<string, { source: string, target: string, id: string }>()

  // Initialize all components
  Object.keys(model.components).forEach((id) => {
    dependencies.set(id, new Set())
    dependents.set(id, new Set())
  })

  if (model.relations) {
    Object.entries(model.relations).forEach(([relationId, relation]) => {
      // Only consider visible relation types
      if (!isRelationVisible(relation.type, visibleRelations)) {
        return
      }

      // source depends on target (source -> target means source needs target)
      const sourceDeps = dependencies.get(relation.source) || new Set()
      sourceDeps.add(relation.target)
      dependencies.set(relation.source, sourceDeps)

      // target has source as a dependent (target is depended on by source)
      const targetDeps = dependents.get(relation.target) || new Set()
      targetDeps.add(relation.source)
      dependents.set(relation.target, targetDeps)

      edgeMap.set(relationId, {
        source: relation.source,
        target: relation.target,
        id: relationId,
      })
    })
  }

  return { dependencies, dependents, edgeMap }
}

/**
 * Compute the total number of transitive dependents (all successors) for each node.
 * A dependent is a node that depends on this node (directly or indirectly).
 * This is useful for scaling nodes by their "importance" in the dependency graph.
 */
export function computeDependentCounts(
  model: EdmmDeploymentModel,
  visibleRelations: string[],
): Map<string, number> {
  const { dependents } = buildDependencyGraph(model, visibleRelations)
  const counts = new Map<string, number>()
  const cache = new Map<string, Set<string>>()

  // Helper function to get all transitive dependents for a node
  function getAllDependents(nodeId: string, visited: Set<string> = new Set()): Set<string> {
    // Check cache first
    if (cache.has(nodeId)) {
      return cache.get(nodeId)!
    }

    // Prevent infinite loops in case of cycles
    if (visited.has(nodeId)) {
      return new Set()
    }
    visited.add(nodeId)

    const allDependents = new Set<string>()
    const directDependents = dependents.get(nodeId) || new Set()

    // Add direct dependents
    directDependents.forEach((depId) => {
      allDependents.add(depId)
      // Recursively get dependents of dependents
      const transitiveDeps = getAllDependents(depId, new Set(visited))
      transitiveDeps.forEach(id => allDependents.add(id))
    })

    cache.set(nodeId, allDependents)
    return allDependents
  }

  // Compute counts for all nodes
  Object.keys(model.components).forEach((nodeId) => {
    const allDeps = getAllDependents(nodeId)
    counts.set(nodeId, allDeps.size)
  })

  return counts
}

/**
 * Compute which nodes and edges should be highlighted based on the selected node
 * and the current interaction mode.
 */
export function computeHighlights(
  model: EdmmDeploymentModel,
  selectedNodeId: string | null,
  interactionMode: InteractionMode,
  visibleRelations: string[],
): HighlightResult {
  const highlightedNodeIds = new Set<string>()
  const highlightedEdgeIds = new Set<string>()

  if (!selectedNodeId) {
    return { highlightedNodeIds, highlightedEdgeIds }
  }

  const { dependencies, dependents, edgeMap } = buildDependencyGraph(model, visibleRelations)

  // Always highlight the selected node
  highlightedNodeIds.add(selectedNodeId)

  let targetNodeIds: Set<string>

  switch (interactionMode) {
    case 'HIGHLIGHT_DIRECT_SUCCESSORS':
      // Nodes that the selected node directly depends on (successors)
      targetNodeIds = dependencies.get(selectedNodeId) || new Set()
      break

    case 'HIGHLIGHT_DIRECT_PREDECESSORS':
      // Nodes that directly depend on the selected node (predecessors)
      targetNodeIds = dependents.get(selectedNodeId) || new Set()
      break

    case 'HIGHLIGHT_NEIGHBOURS': {
      // Both direct predecessors (dependencies) and direct successors (dependents)
      const directDeps = dependencies.get(selectedNodeId) || new Set()
      const directDependents = dependents.get(selectedNodeId) || new Set()
      targetNodeIds = new Set([...directDeps, ...directDependents])
      break
    }

    default:
      targetNodeIds = new Set()
  }

  // Add target nodes to highlighted set
  targetNodeIds.forEach(id => highlightedNodeIds.add(id))

  // Find edges based on interaction mode
  // For DIRECT modes: only edges directly connected to the selected node
  // For ALL modes: edges along the dependency/descendant chain
  edgeMap.forEach((edge, edgeId) => {
    switch (interactionMode) {
      case 'HIGHLIGHT_DIRECT_SUCCESSORS':
        // Only edges FROM the selected node TO its direct successors
        if (edge.source === selectedNodeId && targetNodeIds.has(edge.target)) {
          highlightedEdgeIds.add(edgeId)
        }
        break

      case 'HIGHLIGHT_DIRECT_PREDECESSORS':
        // Only edges FROM direct predecessors TO the selected node
        if (targetNodeIds.has(edge.source) && edge.target === selectedNodeId) {
          highlightedEdgeIds.add(edgeId)
        }
        break

      case 'HIGHLIGHT_NEIGHBOURS':
        // Edges directly connected to the selected node in either direction
        if (edge.source === selectedNodeId && targetNodeIds.has(edge.target)) {
          highlightedEdgeIds.add(edgeId)
        }
        if (edge.target === selectedNodeId && targetNodeIds.has(edge.source)) {
          highlightedEdgeIds.add(edgeId)
        }
        break
    }
  })

  return { highlightedNodeIds, highlightedEdgeIds }
}

/**
 * Apply highlight states to nodes based on selection and interaction mode
 */
export function applyNodeHighlights(
  nodes: Node[],
  highlightedNodeIds: Set<string>,
  hasSelection: boolean,
): Node[] {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      highlighted: highlightedNodeIds.has(node.id),
      dimmed: hasSelection && !highlightedNodeIds.has(node.id),
    },
  }))
}

/**
 * Apply highlight states to edges based on highlighted nodes
 */
export function applyEdgeHighlights(
  edges: Edge[],
  highlightedEdgeIds: Set<string>,
  hasSelection: boolean,
): Edge[] {
  return edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      highlighted: highlightedEdgeIds.has(edge.id),
      dimmed: hasSelection && !highlightedEdgeIds.has(edge.id),
    },
  }))
}

/**
 * Compute shortest paths from an anchor node to all other nodes using BFS.
 * The graph is treated as undirected for path finding purposes.
 * Returns a map of targetNodeId -> { path: nodeIds[], edges: edgeIds[] }
 */
export function computeShortestPaths(
  model: EdmmDeploymentModel,
  anchorNodeId: string,
  visibleRelations: string[],
): Map<string, { path: string[], edges: string[] }> {
  const result = new Map<string, { path: string[], edges: string[] }>()

  // Build adjacency list (directed graph: source -> target)
  const adjacency = new Map<string, Array<{ neighbor: string, edgeId: string }>>()

  // Initialize all components
  Object.keys(model.components).forEach((id) => {
    adjacency.set(id, [])
  })

  if (model.relations) {
    Object.entries(model.relations).forEach(([relationId, relation]) => {
      // Only consider visible relation types
      if (!isRelationVisible(relation.type, visibleRelations)) {
        return
      }

      // Add directed edge: source -> target (following relation direction)
      adjacency.get(relation.source)?.push({ neighbor: relation.target, edgeId: relationId })
    })
  }

  // BFS to find shortest paths
  const visited = new Set<string>([anchorNodeId])
  const queue: Array<{ nodeId: string, path: string[], edges: string[] }> = [
    { nodeId: anchorNodeId, path: [anchorNodeId], edges: [] },
  ]

  // Anchor node has empty path to itself
  result.set(anchorNodeId, { path: [anchorNodeId], edges: [] })

  while (queue.length > 0) {
    const { nodeId, path, edges } = queue.shift()!

    const neighbors = adjacency.get(nodeId) || []
    for (const { neighbor, edgeId } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        const newPath = [...path, neighbor]
        const newEdges = [...edges, edgeId]
        result.set(neighbor, { path: newPath, edges: newEdges })
        queue.push({ nodeId: neighbor, path: newPath, edges: newEdges })
      }
    }
  }

  return result
}

/**
 * Compute highlights for the shortest path from anchor to hovered node
 */
export function computeShortestPathHighlights(
  shortestPaths: Map<string, { path: string[], edges: string[] }>,
  hoveredNodeId: string | null,
  anchorNodeId: string,
): HighlightResult {
  const highlightedNodeIds = new Set<string>()
  const highlightedEdgeIds = new Set<string>()

  // Always highlight the anchor node
  highlightedNodeIds.add(anchorNodeId)

  if (hoveredNodeId && shortestPaths.has(hoveredNodeId)) {
    const { path, edges } = shortestPaths.get(hoveredNodeId)!

    // Highlight all nodes in the path
    path.forEach(id => highlightedNodeIds.add(id))

    // Highlight all edges in the path
    edges.forEach(id => highlightedEdgeIds.add(id))
  }

  return { highlightedNodeIds, highlightedEdgeIds }
}
