import type { EdmmDeploymentModel } from '~/lib/io'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { parseAndValidateEdmm } from '~/lib/io'

/**
 * Represents a color pair for nodes with background and brightness type
 * The type determines text color and gradient mixing:
 * - 'dark': white text, mix bg with black for gradient
 * - 'light': dark text, mix bg with white for gradient
 */
export interface NodeColorPair {
  bg: string
  type: 'dark' | 'light'
}

/**
 * Extended color info for nodes that includes texture flag for overflow types
 */
export interface NodeColorInfo extends NodeColorPair {
  textured: boolean
}

/**
 * Colorblind-friendly palette for nodes (5 colors)
 * Uses orange-blue spectrum which is safe for red-green color blindness
 */
const NODE_COLORBLIND_PALETTE: NodeColorPair[] = [
  { bg: '#c44601', type: 'dark' }, // Burnt Orange
  { bg: '#f57600', type: 'light' }, // Orange
  { bg: '#8babf1', type: 'light' }, // Light Blue
  { bg: '#0073e6', type: 'dark' }, // Blue
  { bg: '#054fb9', type: 'dark' }, // Dark Blue
]

/**
 * Colorblind-friendly palette for edges/relations (5 colors)
 * Uses green-pink spectrum which is distinguishable for most color blindness types
 */
const EDGE_COLORBLIND_PALETTE: string[] = [
  '#5ba300', // Green
  '#89ce00', // Light Green
  '#0073e6', // Blue
  '#e6308a', // Pink
  '#b51963', // Dark Pink
]

/**
 * Represents a relation type with its computed display color
 */
export interface RelationTypeInfo {
  /** The relation type name (e.g., 'HostedOn', 'ConnectsTo') */
  name: string
  /** Human-readable label (e.g., 'Hosted On', 'Connects To') */
  label: string
  /** Background color for this relation type */
  color: string
  /** Whether this type uses a textured pattern (for overflow beyond palette size) */
  textured: boolean
  /** Optional description from the model */
  description?: string | null
}

/**
 * Represents a relation type in a hierarchical tree structure
 */
export interface RelationTreeItem {
  name: string
  label: string
  color: string
  textured: boolean
  description?: string | null
  children?: RelationTreeItem[]
}

/**
 * Available node shapes for type differentiation
 */
export type NodeShape = 'rectangle' | 'circle' | 'hexagon' | 'parallelogram'

/**
 * Array of available shapes for assignment (max 4 parent types supported)
 */
const AVAILABLE_SHAPES: NodeShape[] = ['rectangle', 'circle', 'hexagon', 'parallelogram']

/**
 * Convert a camelCase or PascalCase string to a human-readable label
 * e.g., 'HostedOn' -> 'Hosted On', 'connectsTo' -> 'Connects To'
 */
function toHumanReadable(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before capitals
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Handle consecutive capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
}

export const useGraphStore = defineStore('graph', () => {
  // The deployment model to be displayed in the graph
  const model = ref<EdmmDeploymentModel | null>(null)

  // Visible node types filter (empty = show all types)
  const visibleNodeTypes = ref<string[]>([])

  /**
   * Computed relation types with their colors, derived from the model
   * Uses fixed colorblind-friendly palette with texture fallback for overflow
   */
  const relationTypes = computed<RelationTypeInfo[]>(() => {
    if (!model.value?.relation_types) {
      return []
    }

    const typeNames = Object.keys(model.value.relation_types)

    return typeNames.map((name, index) => {
      const paletteIndex = index % EDGE_COLORBLIND_PALETTE.length
      const color = EDGE_COLORBLIND_PALETTE[paletteIndex]
      const isTextured = index >= EDGE_COLORBLIND_PALETTE.length

      return {
        name,
        label: toHumanReadable(name),
        color,
        textured: isTextured,
        description: model.value!.relation_types![name].description,
      }
    })
  })

  /**
   * Build a hierarchical tree structure from relation types based on their 'extends' property
   */
  const relationTypesHierarchy = computed<RelationTreeItem[]>(() => {
    if (!model.value?.relation_types) {
      return []
    }

    const relationTypesData = model.value.relation_types
    const relationTypeNames = new Set(Object.keys(relationTypesData))

    // Create a map of relation type name to its tree item
    const itemMap = new Map<string, RelationTreeItem>()

    // First pass: create all items
    for (const rt of relationTypes.value) {
      itemMap.set(rt.name, {
        name: rt.name,
        label: rt.label,
        color: rt.color,
        textured: rt.textured,
        description: rt.description,
        children: [],
      })
    }

    // Second pass: build the tree structure
    const roots: RelationTreeItem[] = []

    for (const [name, relationType] of Object.entries(relationTypesData)) {
      const item = itemMap.get(name)
      if (!item)
        continue

      const parentName = relationType.extends

      // If no parent or parent is not a known relation type, it's a root
      if (!parentName || !relationTypeNames.has(parentName)) {
        roots.push(item)
      }
      else {
        // Find the parent and add this as a child
        const parent = itemMap.get(parentName)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(item)
        }
        else {
          // Fallback: treat as root if parent not found
          roots.push(item)
        }
      }
    }

    // Clean up empty children arrays
    function cleanEmptyChildren(items: RelationTreeItem[]): RelationTreeItem[] {
      return items.map((item) => {
        if (item.children && item.children.length === 0) {
          const { children: _, ...rest } = item
          return rest as RelationTreeItem
        }
        if (item.children) {
          return { ...item, children: cleanEmptyChildren(item.children) }
        }
        return item
      })
    }

    return cleanEmptyChildren(roots)
  })

  /**
   * Map from relation type name to its color for quick lookup
   */
  const relationTypeColorMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const rt of relationTypes.value) {
      map[rt.name] = rt.color
    }
    return map
  })

  /**
   * Get the direct parent type for a given component type
   * Returns the type's immediate parent, or the type itself if it has no parent
   */
  function getDirectParentType(typeName: string, componentTypes: Record<string, { extends?: string }>): string {
    const typeDef = componentTypes[typeName]
    if (!typeDef)
      return typeName

    const parentType = typeDef.extends
    // If no parent or parent is '-' (YAML null convention), return the type itself
    if (!parentType || parentType === '-') {
      return typeName
    }
    return parentType
  }

  /**
   * Get all unique parent type categories from the model
   * Only includes parent types where at least one node exists with a type that directly inherits from that parent
   */
  const uniqueParentTypes = computed<string[]>(() => {
    if (!model.value?.component_types || !model.value?.components)
      return []

    // Get all component types that are actually used by nodes
    const usedTypes = new Set<string>()
    for (const component of Object.values(model.value.components)) {
      if (component.type) {
        usedTypes.add(component.type)
      }
    }

    // Find parent types only for the actually used component types
    const parentTypes = new Set<string>()
    for (const typeName of usedTypes) {
      if (model.value.component_types[typeName]) {
        const parentType = getDirectParentType(typeName, model.value.component_types)
        parentTypes.add(parentType)
      }
    }
    return Array.from(parentTypes).sort()
  })

  /**
   * Map from parent type to its color info
   * Each unique parent type gets a distinct color from the palette
   * Only includes parent types that have actual nodes using their child types
   */
  const parentTypeColorMap = computed<Record<string, NodeColorInfo>>(() => {
    // Use uniqueParentTypes which already filters to only parent types with actual nodes
    const sortedParentTypes = uniqueParentTypes.value

    // Create parent type -> color info mapping using NODE_COLORBLIND_PALETTE
    const colorMap: Record<string, NodeColorInfo> = {}
    sortedParentTypes.forEach((parentType, index) => {
      const paletteIndex = index % NODE_COLORBLIND_PALETTE.length
      const colorPair = NODE_COLORBLIND_PALETTE[paletteIndex]
      const isTextured = index >= NODE_COLORBLIND_PALETTE.length

      colorMap[parentType] = {
        bg: colorPair.bg,
        type: colorPair.type,
        textured: isTextured,
      }
    })

    return colorMap
  })

  /**
   * Map from component type to its color info based on direct parent type
   * All types that share the same direct parent get the same color
   */
  const componentTypeColorMap = computed<Record<string, NodeColorInfo>>(() => {
    if (!model.value?.component_types) {
      return {}
    }

    const componentTypes = model.value.component_types
    const defaultColor: NodeColorInfo = { bg: '#808080', type: 'dark', textured: false }

    // Map each component type to the color info of its direct parent
    const colorMap: Record<string, NodeColorInfo> = {}
    for (const typeName of Object.keys(componentTypes)) {
      const parentType = getDirectParentType(typeName, componentTypes)
      colorMap[typeName] = parentTypeColorMap.value[parentType] ?? defaultColor
    }

    return colorMap
  })

  /**
   * Get the color info for a component type by name
   * Falls back to a default gray if not found
   */
  function getComponentTypeColor(typeName: string): NodeColorInfo {
    return componentTypeColorMap.value[typeName] ?? { bg: '#808080', type: 'dark', textured: false }
  }

  /**
   * Set the deployment model to display
   */
  function setModel(newModel: EdmmDeploymentModel | null) {
    model.value = newModel
  }

  /**
   * Parse a YAML string, validate it, and set it as the current model.
   * Returns a validation result with Success/Errors.
   */
  function loadModelFromYaml(yamlContent: string) {
    const result = parseAndValidateEdmm(yamlContent)

    if (result.success && result.data) {
      setModel(result.data)
    }

    return result
  }

  /**
   * Clear the current model
   */
  function clearModel() {
    model.value = null
  }

  /**
   * Get the color for a relation type by name
   * Falls back to a default gray if not found
   */
  function getRelationColor(typeName: string): string {
    return relationTypeColorMap.value[typeName] ?? 'hsl(0, 0%, 50%)'
  }

  /**
   * Check if SHAPE mode can be used (≤4 unique parent types)
   */
  const isShapeModeAvailable = computed<boolean>(() => {
    return uniqueParentTypes.value.length > 0 && uniqueParentTypes.value.length <= AVAILABLE_SHAPES.length
  })

  /**
   * Map from parent type to its shape
   * Each unique parent type gets a distinct shape
   */
  const parentTypeShapeMap = computed<Record<string, NodeShape>>(() => {
    if (!model.value?.component_types || !isShapeModeAvailable.value) {
      return {}
    }

    // Map parent types to shapes
    const shapeMap: Record<string, NodeShape> = {}
    uniqueParentTypes.value.forEach((parentType, index) => {
      shapeMap[parentType] = AVAILABLE_SHAPES[index]
    })

    return shapeMap
  })

  /**
   * Map from component type to its shape based on direct parent type
   * All types that share the same direct parent get the same shape
   */
  const componentTypeShapeMap = computed<Record<string, NodeShape>>(() => {
    if (!model.value?.component_types || !isShapeModeAvailable.value) {
      return {}
    }

    const componentTypes = model.value.component_types

    // Map each component type to the shape of its parent
    const shapeMap: Record<string, NodeShape> = {}
    for (const typeName of Object.keys(componentTypes)) {
      const parentType = getDirectParentType(typeName, componentTypes)
      shapeMap[typeName] = parentTypeShapeMap.value[parentType] ?? 'rectangle'
    }

    return shapeMap
  })

  /**
   * Get the shape for a component type by name
   * Returns null if shape mode is not available or type not found
   */
  function getComponentTypeShape(typeName: string): NodeShape | null {
    return componentTypeShapeMap.value[typeName] ?? null
  }

  // =====================================================
  // Non-persisted state (resets on page reload)
  // =====================================================

  /** Hidden relation types by name (empty = all visible) */
  const hiddenRelations = ref<string[]>([])

  /** Shortest path anchor node (null = no anchor selected) */
  const shortestPathAnchorNode = ref<string | null>(null)

  /** Visible node IDs filter (null = show all, array = filter to these IDs) */
  const visibleNodeIds = ref<string[] | null>(null)

  /**
   * Check if a relation type is visible (not hidden)
   */
  function isRelationVisible(type: string): boolean {
    return !hiddenRelations.value.includes(type)
  }

  /**
   * Toggle the visibility of a relation type
   */
  function toggleRelationVisibility(type: string): void {
    const index = hiddenRelations.value.indexOf(type)
    if (index === -1) {
      // Not hidden yet, add to hidden list
      hiddenRelations.value = [...hiddenRelations.value, type]
    }
    else {
      // Already hidden, remove from hidden list (make visible)
      hiddenRelations.value = hiddenRelations.value.filter(t => t !== type)
    }
  }

  /**
   * Set visible node IDs (for "Hide unselected nodes" feature)
   */
  function setVisibleNodeIds(nodeIds: string[] | null): void {
    visibleNodeIds.value = nodeIds
  }

  /**
   * Show all nodes (clear the filter)
   */
  function showAllNodes(): void {
    visibleNodeIds.value = null
  }

  return {
    model,
    visibleNodeTypes,
    relationTypes,
    relationTypesHierarchy,
    relationTypeColorMap,
    parentTypeColorMap,
    componentTypeColorMap,
    uniqueParentTypes,
    isShapeModeAvailable,
    parentTypeShapeMap,
    componentTypeShapeMap,
    setModel,
    loadModelFromYaml,
    clearModel,
    getRelationColor,
    getComponentTypeColor,
    getComponentTypeShape,
    // Non-persisted state
    hiddenRelations,
    shortestPathAnchorNode,
    visibleNodeIds,
    // Helper functions
    isRelationVisible,
    toggleRelationVisibility,
    setVisibleNodeIds,
    showAllNodes,
  }
})
