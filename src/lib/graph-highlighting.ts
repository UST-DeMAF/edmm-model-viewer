import type { Edge, Node } from '@vue-flow/core'
import type { LayoutConfig, RelationType } from '~/lib/graph-layout'
import type { EdmmDeploymentModel } from '~/lib/io'
import { getRelationType } from '~/lib/graph-layout'

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
function buildDependencyGraph(
  model: EdmmDeploymentModel,
  visibleRelations: RelationType[]
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
      const relationType = getRelationType(relation.type)
      if (relationType && !visibleRelations.includes(relationType)) {
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
 * Get all transitive dependencies of a node (nodes it depends on, recursively)
 */
function getAllDependencies(
  nodeId: string,
  dependencies: Map<string, Set<string>>,
  visited = new Set<string>(),
): Set<string> {
  const result = new Set<string>()
  const directDeps = dependencies.get(nodeId) || new Set()

  directDeps.forEach((depId) => {
    if (!visited.has(depId)) {
      visited.add(depId)
      result.add(depId)
      // Recursively get dependencies
      const transitiveDeps = getAllDependencies(depId, dependencies, visited)
      transitiveDeps.forEach(id => result.add(id))
    }
  })

  return result
}

/**
 * Get all transitive dependents of a node (nodes that depend on it, recursively)
 */
function getAllDependents(
  nodeId: string,
  dependents: Map<string, Set<string>>,
  visited = new Set<string>(),
): Set<string> {
  const result = new Set<string>()
  const directDeps = dependents.get(nodeId) || new Set()

  directDeps.forEach((depId) => {
    if (!visited.has(depId)) {
      visited.add(depId)
      result.add(depId)
      // Recursively get dependents
      const transitiveDeps = getAllDependents(depId, dependents, visited)
      transitiveDeps.forEach(id => result.add(id))
    }
  })

  return result
}

/**
 * Compute which nodes and edges should be highlighted based on the selected node
 * and the current interaction mode.
 */
export function computeHighlights(
  model: EdmmDeploymentModel,
  selectedNodeId: string | null,
  interactionMode: InteractionMode,
  visibleRelations: RelationType[],
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
    case 'HIGHLIGHT_DIRECT_DEPENDENCIES':
      // Nodes that the selected node directly depends on
      targetNodeIds = dependencies.get(selectedNodeId) || new Set()
      break

    case 'HIGHLIGHT_ALL_DEPENDENCIES':
      // All nodes in the dependency chain (transitive)
      targetNodeIds = getAllDependencies(selectedNodeId, dependencies)
      break

    case 'HIGHLIGHT_DIRECT_DESCENDANTS':
      // Nodes that directly depend on the selected node
      targetNodeIds = dependents.get(selectedNodeId) || new Set()
      break

    case 'HIGHLIGHT_ALL_DESCENDANTS':
      // All nodes that depend on the selected node (transitive)
      targetNodeIds = getAllDependents(selectedNodeId, dependents)
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
      case 'HIGHLIGHT_DIRECT_DEPENDENCIES':
        // Only edges FROM the selected node TO its direct dependencies
        if (edge.source === selectedNodeId && targetNodeIds.has(edge.target)) {
          highlightedEdgeIds.add(edgeId)
        }
        break

      case 'HIGHLIGHT_DIRECT_DESCENDANTS':
        // Only edges FROM direct descendants TO the selected node
        if (targetNodeIds.has(edge.source) && edge.target === selectedNodeId) {
          highlightedEdgeIds.add(edgeId)
        }
        break

      case 'HIGHLIGHT_ALL_DEPENDENCIES':
        // Edges along the dependency chain: source depends on target
        // Include edge if source is highlighted AND target is a dependency of source
        if (highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target)) {
          // Verify this edge is part of the dependency chain from selected node
          const sourceDeps = dependencies.get(edge.source) || new Set()
          if (sourceDeps.has(edge.target)) {
            highlightedEdgeIds.add(edgeId)
          }
        }
        break

      case 'HIGHLIGHT_ALL_DESCENDANTS':
        // Edges along the descendant chain: source depends on target
        // Include edge if target is highlighted AND source is a dependent of target
        if (highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target)) {
          // Verify this edge is part of the descendant chain to selected node
          const targetDependents = dependents.get(edge.target) || new Set()
          if (targetDependents.has(edge.source)) {
            highlightedEdgeIds.add(edgeId)
          }
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
