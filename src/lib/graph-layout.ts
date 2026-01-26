import type { Node } from '@vue-flow/core'
import type { EdmmDeploymentModel } from './io'
import dagre from '@dagrejs/dagre'
import ELK from 'elkjs'
import { computeDependentCounts } from './graph-highlighting'

// Node dimensions
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 60

export type LayoutDirection = 'vertical' | 'horizontal'

export type LayoutAlgorithm = 'default' | 'layered' | 'force' | 'mrtree'

export interface LayoutConfig {
  interactionMode: 'NORMAL' | 'HIGHLIGHT_DIRECT_SUCCESSORS' | 'HIGHLIGHT_DIRECT_PREDECESSORS' | 'HIGHLIGHT_NEIGHBOURS' | 'SHORTEST_PATH'
  showEdgeLabels: boolean
  /** Which relation types to display (by type name string) */
  visibleRelations: string[]
  /** Direction of the graph layout */
  layoutDirection: LayoutDirection
  /** Whether to scale nodes based on their dependency count */
  scaleWithDependencies: boolean
  /** Which algorithm to use for layout: 'default' (dagre) or 'layered' (elkjs) */
  layoutAlgorithm: LayoutAlgorithm
}

export interface EdgeData {
  id: string
  source: string
  target: string
  label?: string
  /** Description of the relation (if any) */
  description?: string | null
  /** Properties defined on the relation */
  properties?: Record<string, unknown>
  /** Operations defined on the relation */
  operations?: Record<string, unknown>
}

export interface LayoutResult {
  nodes: Node[]
  edges: EdgeData[]
}

/**
 * Check if a relation type is visible based on the visible relations list.
 * If visibleRelations is empty, all relations are visible.
 * Otherwise, checks if the relation type is in the list.
 */
export function isRelationVisible(relationType: string, visibleRelations: string[]): boolean {
  // If no filter is set (empty array), show all relations
  if (visibleRelations.length === 0) {
    return true
  }
  return visibleRelations.includes(relationType)
}

/**
 * Compute edges based on config
 */
export function computeEdges(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): EdgeData[] {
  const collection: EdgeData[] = []

  if (model.relations) {
    Object.entries(model.relations).forEach(([relationId, relation]) => {
      // Skip if relation type is not in visible relations list
      if (!isRelationVisible(relation.type, config.visibleRelations)) {
        return
      }

      collection.push({
        id: relationId,
        source: relation.source,
        target: relation.target,
        label: relation.type,
        description: relation.description,
        properties: relation.properties,
        operations: relation.operations,
      })
    })
  }

  return collection
}

/**
 * Run dagre layout for flat graph
 */
function runFlatDagreLayout(
  model: EdmmDeploymentModel,
  componentIds: string[],
  config: LayoutConfig,
  nodeScales: Map<string, number>,
): Node[] {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Dagre uses the Sugiyama algorithm (same as ELK's "layered")
  // Key options:
  // - rankdir: Direction of layout (TB=top-bottom, LR=left-right, BT, RL)
  // - ranker: Algorithm for rank assignment ('network-simplex', 'tight-tree', 'longest-path')
  // - acyclicer: How to handle cycles ('greedy', 'dfs')
  // - nodesep: Horizontal separation between nodes in the same rank
  // - ranksep: Separation between ranks/layers
  dagreGraph.setGraph({
    rankdir: config.layoutDirection === 'vertical' ? 'TB' : 'LR',
    ranker: 'network-simplex', // Same as ELK's default, gives best results
    acyclicer: 'greedy',
    nodesep: 50, // Spacing between nodes in same layer
    ranksep: 100, // Spacing between layers (similar to ELK's nodeNodeBetweenLayers)
    marginx: 20,
    marginy: 20,
  })

  // Add nodes (with scaled dimensions if enabled)
  componentIds.forEach((id) => {
    const scale = nodeScales.get(id) ?? 1
    const width = Math.round(NODE_WIDTH * scale)
    const height = Math.round(NODE_HEIGHT * scale)
    dagreGraph.setNode(id, { width, height })
  })

  // Add edges (only enabled relation types)
  if (model.relations) {
    Object.values(model.relations).forEach((relation) => {
      // Skip if relation type is not in visible relations list
      if (!isRelationVisible(relation.type, config.visibleRelations)) {
        return
      }

      dagreGraph.setEdge(relation.source, relation.target)
    })
  }

  // Run layout
  dagre.layout(dagreGraph)

  // Extract positioned nodes
  return componentIds.map((id) => {
    const nodeWithPosition = dagreGraph.node(id)
    const component = model.components[id]
    const scale = nodeScales.get(id) ?? 1
    const width = Math.round(NODE_WIDTH * scale)
    const height = Math.round(NODE_HEIGHT * scale)

    // Base styling values
    const baseFontSize = 14
    const baseBorderRadius = 12
    const basePaddingV = 12
    const basePaddingH = 16

    return {
      id,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
      data: {
        label: id,
        type: component?.type ?? 'unknown',
        scale: scale !== 1 ? scale : undefined,
        dependentCount: nodeScales.has(id) && scale > 1 ? Math.round((scale - 1) * 2 * nodeScales.size) : undefined,
      },
      class: 'edmm-node',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${Math.round(baseFontSize * scale)}px`,
        borderRadius: `${Math.round(baseBorderRadius * scale)}px`,
        padding: `${Math.round(basePaddingV * scale)}px ${Math.round(basePaddingH * scale)}px`,
      },
    }
  })
}

/**
 * Compute scale factors for nodes based on their dependent counts
 */
function computeNodeScales(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): Map<string, number> {
  if (!config.scaleWithDependencies) {
    return new Map()
  }

  const counts = computeDependentCounts(model, config.visibleRelations)
  const maxCount = Math.max(...counts.values(), 1)

  const scaleFactors = new Map<string, number>()
  counts.forEach((count, nodeId) => {
    // Scale from 1.0 (no dependents) to 1.5 (max dependents)
    const normalized = maxCount > 0 ? count / maxCount : 0
    const scale = 1 + (normalized * 0.5)
    scaleFactors.set(nodeId, scale)
  })

  return scaleFactors
}

/**
 * Run dagre layout and return positioned nodes
 */
export function runDagreLayout(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): Node[] {
  const componentIds = Object.keys(model.components)
  const nodeScales = computeNodeScales(model, config)
  return runFlatDagreLayout(model, componentIds, config, nodeScales)
}

/**
 * Run ELK layout for flat graph using the layered algorithm
 */
async function runElkLayout(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
  nodeScales: Map<string, number>,
): Promise<Node[]> {
  const elk = new ELK()
  const componentIds = Object.keys(model.components)

  // Build ELK graph structure
  const children = componentIds.map((id) => {
    const scale = nodeScales.get(id) ?? 1
    const width = Math.round(NODE_WIDTH * scale)
    const height = Math.round(NODE_HEIGHT * scale)
    return { id, width, height }
  })

  // Build edges for ELK (only visible relations)
  const edges: Array<{ id: string, sources: string[], targets: string[] }> = []
  if (model.relations) {
    Object.entries(model.relations).forEach(([relationId, relation]) => {
      // Skip if relation type is not in visible relations list
      if (!isRelationVisible(relation.type, config.visibleRelations)) {
        return
      }

      edges.push({
        id: relationId,
        sources: [relation.source],
        targets: [relation.target],
      })
    })
  }

  // Build algorithm-specific layout options
  const getLayoutOptions = (): Record<string, string> => {
    const baseOptions: Record<string, string> = {
      'elk.padding': '[top=20,left=20,bottom=20,right=20]',
    }

    switch (config.layoutAlgorithm) {
      case 'force':
        return {
          ...baseOptions,
          'elk.algorithm': 'force',
          'elk.force.iterations': '300',
          'elk.spacing.nodeNode': '80',
        }
      case 'mrtree':
        return {
          ...baseOptions,
          'elk.algorithm': 'mrtree',
          'elk.direction': config.layoutDirection === 'vertical' ? 'DOWN' : 'RIGHT',
          'elk.spacing.nodeNode': '50',
          'elk.mrtree.weighting': 'CONSTRAINT',
        }
      case 'layered':
      default:
        return {
          ...baseOptions,
          'elk.algorithm': 'layered',
          'elk.direction': config.layoutDirection === 'vertical' ? 'DOWN' : 'RIGHT',
          'elk.spacing.nodeNode': '100',
          'elk.layered.spacing.nodeNodeBetweenLayers': '200',
        }
    }
  }

  const graph = {
    id: 'root',
    layoutOptions: getLayoutOptions(),
    children,
    edges,
  }

  const layoutedGraph = await elk.layout(graph)

  // Convert ELK result to Vue Flow nodes
  return componentIds.map((id) => {
    const elkNode = layoutedGraph.children?.find(n => n.id === id)
    const component = model.components[id]
    const scale = nodeScales.get(id) ?? 1
    const width = Math.round(NODE_WIDTH * scale)
    const height = Math.round(NODE_HEIGHT * scale)

    // Base styling values
    const baseFontSize = 14
    const baseBorderRadius = 12
    const basePaddingV = 12
    const basePaddingH = 16

    return {
      id,
      position: {
        x: elkNode?.x ?? 0,
        y: elkNode?.y ?? 0,
      },
      data: {
        label: id,
        type: component?.type ?? 'unknown',
        scale: scale !== 1 ? scale : undefined,
        dependentCount: nodeScales.has(id) && scale > 1 ? Math.round((scale - 1) * 2 * nodeScales.size) : undefined,
      },
      class: 'edmm-node',
      style: {
        width: `${width}px`,
        height: `${height}px`,
        fontSize: `${Math.round(baseFontSize * scale)}px`,
        borderRadius: `${Math.round(baseBorderRadius * scale)}px`,
        padding: `${Math.round(basePaddingV * scale)}px ${Math.round(basePaddingH * scale)}px`,
      },
    }
  })
}

/**
 * Compute the full layout result (nodes + edges)
 * Returns a Promise since ELK layout is async
 */
export async function computeGraphLayout(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): Promise<LayoutResult> {
  let nodes: Node[]

  if (config.layoutAlgorithm !== 'default') {
    // Use ELK for layered, force, and mrtree algorithms
    const nodeScales = computeNodeScales(model, config)
    nodes = await runElkLayout(model, config, nodeScales)
  }
  else {
    // Default: use dagre
    nodes = runDagreLayout(model, config)
  }

  const edges = computeEdges(model, config)

  return { nodes, edges }
}
