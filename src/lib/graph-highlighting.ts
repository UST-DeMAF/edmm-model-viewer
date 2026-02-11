import type { Edge, Node } from '@vue-flow/core'
import type { LayoutConfig } from '~/lib/graph-layout'
import type { EdmmDeploymentModel } from '~/lib/io'
import { isRelationVisible } from '~/lib/graph-layout'

export type InteractionMode = LayoutConfig['interactionMode']

export interface HighlightResult {
  highlightedNodeIds: Set<string>
  highlightedEdgeIds: Set<string>
  nodeDistances: Map<string, number>
}

/**
 * Build a dependency graph from model relations.
 * Returns two maps:
 * - dependencies: nodeId -> Set of nodeIds that this node depends on (targets of outgoing edges)
 * - dependents: nodeId -> Set of nodeIds that depend on this node (sources of incoming edges)
 */
export function buildDependencyGraph(
  model: EdmmDeploymentModel,
  hiddenRelations: string[],
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
      if (!isRelationVisible(relation.type, hiddenRelations)) {
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
  hiddenRelations: string[],
): Map<string, number> {
  const { dependents } = buildDependencyGraph(model, hiddenRelations)
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

interface AdjacencyEntry {
  neighbor: string
  edgeId: string
}

/**
 * Collect all nodes reachable within a given number of steps using BFS.
 * Also tracks which edges were actually traversed during the BFS.
 * @param startNodeId - The node to start from
 * @param adjacency - Edge-aware adjacency map
 * @param range - Max number of steps (1 = direct only, null = unlimited)
 * @returns nodes: Set of reachable node IDs, edges: Set of edge IDs used during traversal, distances: Map of nodeId to BFS depth
 */
function collectNodesWithinRange(
  startNodeId: string,
  adjacency: Map<string, AdjacencyEntry[]>,
  range: number | null,
): { nodes: Set<string>, edges: Set<string>, distances: Map<string, number> } {
  const resultNodes = new Set<string>()
  const resultEdges = new Set<string>()
  const distances = new Map<string, number>()
  const visited = new Set<string>([startNodeId])
  const queue: Array<{ nodeId: string, depth: number }> = [{ nodeId: startNodeId, depth: 0 }]

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!

    // If range is set and we've reached the max depth, don't explore further
    if (range !== null && depth >= range) {
      continue
    }

    const neighbors = adjacency.get(nodeId) || []
    for (const { neighbor, edgeId } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        resultNodes.add(neighbor)
        resultEdges.add(edgeId)
        distances.set(neighbor, depth + 1)
        queue.push({ nodeId: neighbor, depth: depth + 1 })
      }
    }
  }

  return { nodes: resultNodes, edges: resultEdges, distances }
}

/**
 * Build edge-aware adjacency maps for BFS traversal.
 * - successorAdj: nodeId -> [{neighbor: dependency target, edgeId}]
 * - predecessorAdj: nodeId -> [{neighbor: dependent source, edgeId}]
 */
function buildEdgeAwareAdjacency(
  edgeMap: Map<string, { source: string, target: string, id: string }>,
): {
    successorAdj: Map<string, AdjacencyEntry[]>
    predecessorAdj: Map<string, AdjacencyEntry[]>
  } {
  const successorAdj = new Map<string, AdjacencyEntry[]>()
  const predecessorAdj = new Map<string, AdjacencyEntry[]>()

  edgeMap.forEach((edge, edgeId) => {
    // Successor direction: source -> target (following dependency direction)
    if (!successorAdj.has(edge.source))
      successorAdj.set(edge.source, [])
    successorAdj.get(edge.source)!.push({ neighbor: edge.target, edgeId })

    // Predecessor direction: target -> source (reverse dependency direction)
    if (!predecessorAdj.has(edge.target))
      predecessorAdj.set(edge.target, [])
    predecessorAdj.get(edge.target)!.push({ neighbor: edge.source, edgeId })
  })

  return { successorAdj, predecessorAdj }
}

/**
 * Compute which nodes and edges should be highlighted based on the selected node
 * and the current interaction mode.
 */
export function computeHighlights(
  model: EdmmDeploymentModel,
  selectedNodeId: string | null,
  interactionMode: InteractionMode,
  hiddenRelations: string[],
  range: number | null = 1,
): HighlightResult {
  const highlightedNodeIds = new Set<string>()
  const highlightedEdgeIds = new Set<string>()
  const nodeDistances = new Map<string, number>()

  if (!selectedNodeId) {
    return { highlightedNodeIds, highlightedEdgeIds, nodeDistances }
  }

  const { edgeMap } = buildDependencyGraph(model, hiddenRelations)
  const { successorAdj, predecessorAdj } = buildEdgeAwareAdjacency(edgeMap)

  // Always highlight the selected node
  highlightedNodeIds.add(selectedNodeId)

  let bfsResult: { nodes: Set<string>, edges: Set<string>, distances: Map<string, number> }

  switch (interactionMode) {
    case 'HIGHLIGHT_SUCCESSORS':
      // Nodes that the selected node depends on (successors), within range
      bfsResult = collectNodesWithinRange(selectedNodeId, successorAdj, range)
      break

    case 'HIGHLIGHT_PREDECESSORS':
      // Nodes that depend on the selected node (predecessors), within range
      bfsResult = collectNodesWithinRange(selectedNodeId, predecessorAdj, range)
      break

    case 'HIGHLIGHT_NEIGHBOURS': {
      // Both predecessors and successors within range
      const successorResult = collectNodesWithinRange(selectedNodeId, successorAdj, range)
      const predecessorResult = collectNodesWithinRange(selectedNodeId, predecessorAdj, range)
      const mergedDistances = new Map<string, number>()
      successorResult.distances.forEach((d, id) => mergedDistances.set(id, d))
      predecessorResult.distances.forEach((d, id) => {
        const existing = mergedDistances.get(id)
        if (existing === undefined || d < existing)
          mergedDistances.set(id, d)
      })
      bfsResult = {
        nodes: new Set([...successorResult.nodes, ...predecessorResult.nodes]),
        edges: new Set([...successorResult.edges, ...predecessorResult.edges]),
        distances: mergedDistances,
      }
      break
    }

    default:
      bfsResult = { nodes: new Set(), edges: new Set(), distances: new Map() }
  }

  // Add BFS-discovered nodes, edges, and distances to result
  bfsResult.nodes.forEach(id => highlightedNodeIds.add(id))
  bfsResult.edges.forEach(id => highlightedEdgeIds.add(id))
  bfsResult.distances.forEach((d, id) => nodeDistances.set(id, d))
  // Start node has distance 0
  nodeDistances.set(selectedNodeId, 0)

  return { highlightedNodeIds, highlightedEdgeIds, nodeDistances }
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
  hiddenRelations: string[],
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
      if (!isRelationVisible(relation.type, hiddenRelations)) {
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
 * Compute highlights for the shortest path between anchor and hovered node.
 * Checks both directions (anchor→hovered and hovered→anchor) and uses the shorter path.
 */
export function computeShortestPathHighlights(
  forwardPaths: Map<string, { path: string[], edges: string[] }>,
  reversePaths: Map<string, { path: string[], edges: string[] }>,
  hoveredNodeId: string | null,
  anchorNodeId: string,
): HighlightResult {
  const highlightedNodeIds = new Set<string>()
  const highlightedEdgeIds = new Set<string>()

  // Always highlight the anchor node
  highlightedNodeIds.add(anchorNodeId)

  if (hoveredNodeId) {
    // Get forward path (anchor → hovered)
    const forwardPath = forwardPaths.get(hoveredNodeId)
    // Get reverse path (hovered → anchor)
    const reversePath = reversePaths.get(anchorNodeId)

    // Determine which path to use (shorter one, or the one that exists)
    let selectedPath: { path: string[], edges: string[] } | undefined

    if (forwardPath && reversePath) {
      // Both paths exist, choose the shorter one
      selectedPath = forwardPath.path.length <= reversePath.path.length ? forwardPath : reversePath
    }
    else if (forwardPath) {
      selectedPath = forwardPath
    }
    else if (reversePath) {
      selectedPath = reversePath
    }

    if (selectedPath) {
      // Highlight all nodes in the path
      selectedPath.path.forEach(id => highlightedNodeIds.add(id))

      // Highlight all edges in the path
      selectedPath.edges.forEach(id => highlightedEdgeIds.add(id))
    }
  }

  return { highlightedNodeIds, highlightedEdgeIds, nodeDistances: new Map() }
}
