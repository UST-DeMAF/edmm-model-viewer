import type { Node } from '@vue-flow/core'
import type { EdmmDeploymentModel } from './io'
import dagre from '@dagrejs/dagre'

// Node dimensions
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 60

// Relation types in EDMM models
export enum RelationType {
  HostedOn = 'HostedOn',
  ConnectsTo = 'ConnectsTo',
  AttachesTo = 'AttachesTo',
  DependsOn = 'DependsOn',
}

// All relation types for convenience
export const ALL_RELATION_TYPES: RelationType[] = Object.values(RelationType)

/**
 * Get the relation type from a relation type string
 */
export function getRelationType(typeString: string): RelationType | null {
  const lowerType = typeString.toLowerCase()
  if (lowerType.includes('hostedon'))
    return RelationType.HostedOn
  if (lowerType.includes('connectsto'))
    return RelationType.ConnectsTo
  if (lowerType.includes('attachesto'))
    return RelationType.AttachesTo
  if (lowerType.includes('dependson'))
    return RelationType.DependsOn
  return null
}

export type HostedOnRelationDisplay = 'HIDE' | 'GROUP' | 'SHOW'

export type LayoutDirection = 'vertical' | 'horizontal'

export interface LayoutConfig {
  hostedOnRelationDisplay: HostedOnRelationDisplay
  interactionMode: 'HIGHLIGHT_DIRECT_DEPENDENCIES' | 'HIGHLIGHT_ALL_DEPENDENCIES' | 'HIGHLIGHT_DIRECT_DESCENDANTS' | 'HIGHLIGHT_ALL_DESCENDANTS' | 'HIGHLIGHT_NEIGHBOURS'
  showEdgeLabels: boolean
  /** Which relation types to use for calculating node positions (affects layout) */
  layoutRelations: RelationType[]
  /** Which relation types to display as edges (affects visibility) */
  visibleRelations: RelationType[]
  /** Direction of the graph layout */
  layoutDirection: LayoutDirection
}

export interface LayoutResult {
  nodes: Node[]
  edges: Array<{ id: string, source: string, target: string, label?: string }>
}

/**
 * Build a map of component -> host (what it's hosted on)
 */
export function buildHostedOnMap(model: EdmmDeploymentModel): Record<string, string> {
  const map: Record<string, string> = {}
  if (model.relations) {
    Object.values(model.relations).forEach((relation) => {
      if (relation.type.toLowerCase().includes('hostedon')) {
        // source is hosted on target
        map[relation.source] = relation.target
      }
    })
  }
  return map
}

/**
 * Build a map of host -> children (components hosted on it)
 */
export function buildHostChildrenMap(hostedOnMap: Record<string, string>): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  Object.entries(hostedOnMap).forEach(([child, host]) => {
    if (!map[host]) {
      map[host] = []
    }
    map[host].push(child)
  })
  return map
}

/**
 * Compute edges based on config
 */
export function computeEdges(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): Array<{ id: string, source: string, target: string, label?: string }> {
  const collection: Array<{ id: string, source: string, target: string, label?: string }> = []

  if (model.relations) {
    Object.entries(model.relations).forEach(([relationId, relation]) => {
      const relationType = getRelationType(relation.type)
      const isHostedOn = relationType === RelationType.HostedOn

      // Skip hosted_on relations if hiding or grouping
      if ((config.hostedOnRelationDisplay === 'HIDE' || config.hostedOnRelationDisplay === 'GROUP') && isHostedOn) {
        return
      }

      collection.push({
        id: relationId,
        source: relation.source,
        target: relation.target,
        label: relation.type,
      })
    })
  }

  return collection
}

/**
 * Run dagre layout for flat graph (HIDE/SHOW modes)
 */
function runFlatDagreLayout(
  model: EdmmDeploymentModel,
  componentIds: string[],
  config: LayoutConfig,
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

  // Add nodes
  componentIds.forEach((id) => {
    dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  })

  // Add edges (only enabled relation types)
  if (model.relations) {
    Object.values(model.relations).forEach((relation) => {
      const relationType = getRelationType(relation.type)

      // Skip if relation type is not in layout list
      if (relationType && !config.layoutRelations.includes(relationType)) {
        return
      }

      const isHostedOn = relationType === RelationType.HostedOn

      // Include edge based on mode
      if (config.hostedOnRelationDisplay === 'SHOW' || !isHostedOn) {
        dagreGraph.setEdge(relation.source, relation.target)
      }
    })
  }

  // Run layout
  dagre.layout(dagreGraph)

  // Extract positioned nodes
  return componentIds.map((id) => {
    const nodeWithPosition = dagreGraph.node(id)
    const component = model.components[id]

    return {
      id,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: {
        label: id,
        type: component?.type ?? 'unknown',
      },
      style: {
        width: `${NODE_WIDTH}px`,
        height: `${NODE_HEIGHT}px`,
      },
    }
  })
}

/**
 * Run dagre layout for hierarchical graph (GROUP mode)
 * Note: dagre doesn't support true hierarchy, so we simulate it by:
 * 1. First layouting children within each parent
 * 2. Then layouting the roots with their computed sizes
 */
function runHierarchicalDagreLayout(
  model: EdmmDeploymentModel,
  componentIds: string[],
  hostedComponents: Set<string>,
  hostChildrenMap: Record<string, string[]>,
  config: LayoutConfig,
): Node[] {
  const nodes: Node[] = []
  const PADDING_TOP = NODE_HEIGHT + 30
  const PADDING_SIDE = 20
  const CHILD_SPACING = 20

  // Find root-level nodes (not hosted by anything)
  const rootNodeIds = componentIds.filter(id => !hostedComponents.has(id))

  // Calculate dimensions for a node including its children
  function calculateNodeDimensions(nodeId: string): { width: number, height: number } {
    const children = hostChildrenMap[nodeId] || []
    if (children.length === 0) {
      return { width: NODE_WIDTH, height: NODE_HEIGHT }
    }

    // Layout children in a simple horizontal arrangement
    const childDimensions = children.map(childId => calculateNodeDimensions(childId))
    const totalChildWidth = childDimensions.reduce((sum, dim) => sum + dim.width, 0)
      + (children.length - 1) * CHILD_SPACING
    const maxChildHeight = Math.max(...childDimensions.map(dim => dim.height))

    return {
      width: Math.max(NODE_WIDTH, totalChildWidth + 2 * PADDING_SIDE),
      height: PADDING_TOP + maxChildHeight + PADDING_SIDE,
    }
  }

  // Recursively create nodes with proper positioning
  function createNodesRecursively(
    nodeId: string,
    parentId: string | null,
    offsetX: number,
    offsetY: number,
  ): void {
    const children = hostChildrenMap[nodeId] || []
    const component = model.components[nodeId]
    const hasChildren = children.length > 0
    const dimensions = calculateNodeDimensions(nodeId)

    const node: Node = {
      id: nodeId,
      type: 'default',
      position: { x: offsetX, y: offsetY },
      data: {
        label: nodeId,
        type: component?.type ?? 'unknown',
        isGroupNode: hasChildren,
        ...(hasChildren && {
          width: dimensions.width,
          height: dimensions.height,
        }),
      },
      ...(parentId && { parentNode: parentId }),
      ...(hasChildren && { draggable: false, selectable: false }),
      style: {
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      },
    }

    nodes.push(node)

    // Position children
    if (hasChildren) {
      let childX = PADDING_SIDE
      children.forEach((childId) => {
        const childDim = calculateNodeDimensions(childId)
        createNodesRecursively(childId, nodeId, childX, PADDING_TOP)
        childX += childDim.width + CHILD_SPACING
      })
    }
  }

  // Use dagre (Sugiyama/layered algorithm) to layout root nodes
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: config.layoutDirection === 'vertical' ? 'TB' : 'LR',
    ranker: 'network-simplex',
    acyclicer: 'greedy',
    nodesep: 80,
    ranksep: 100,
    marginx: 20,
    marginy: 20,
  })

  // Add root nodes with their computed dimensions
  rootNodeIds.forEach((id) => {
    const dim = calculateNodeDimensions(id)
    dagreGraph.setNode(id, { width: dim.width, height: dim.height })
  })

  // Add non-hostedOn edges (only enabled relation types)
  if (model.relations) {
    Object.values(model.relations).forEach((relation) => {
      const relationType = getRelationType(relation.type)

      // Skip if relation type is not in layout list
      if (relationType && !config.layoutRelations.includes(relationType)) {
        return
      }

      const isHostedOn = relationType === RelationType.HostedOn
      if (!isHostedOn) {
        dagreGraph.setEdge(relation.source, relation.target)
      }
    })
  }

  // Run layout on roots
  dagre.layout(dagreGraph)

  // Create nodes starting from roots
  rootNodeIds.forEach((id) => {
    const nodeWithPosition = dagreGraph.node(id)
    const dim = calculateNodeDimensions(id)
    createNodesRecursively(
      id,
      null,
      nodeWithPosition.x - dim.width / 2,
      nodeWithPosition.y - dim.height / 2,
    )
  })

  return nodes
}

/**
 * Run dagre layout and return positioned nodes
 */
export function runDagreLayout(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): Node[] {
  const componentIds = Object.keys(model.components)
  const hostedOnMap = buildHostedOnMap(model)
  const hostedComponents = new Set(Object.keys(hostedOnMap))
  const hostChildrenMap = buildHostChildrenMap(hostedOnMap)

  if (config.hostedOnRelationDisplay === 'GROUP') {
    return runHierarchicalDagreLayout(model, componentIds, hostedComponents, hostChildrenMap, config)
  }
  else {
    return runFlatDagreLayout(model, componentIds, config)
  }
}

/**
 * Compute the full layout result (nodes + edges)
 * Note: This is now synchronous since dagre is synchronous
 */
export function computeGraphLayout(
  model: EdmmDeploymentModel,
  config: LayoutConfig,
): LayoutResult {
  const nodes = runDagreLayout(model, config)
  const edges = computeEdges(model, config)

  return { nodes, edges }
}
