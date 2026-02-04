import type { EdmmDeploymentModel } from '~/lib/io'
import { defineStore } from 'pinia'
import { computed, readonly, ref } from 'vue'
import { isDark } from '~/composables/dark'

/**
 * Represents a relation type with its computed display color
 */
export interface RelationTypeInfo {
  /** The relation type name (e.g., 'HostedOn', 'ConnectsTo') */
  name: string
  /** Human-readable label (e.g., 'Hosted On', 'Connects To') */
  label: string
  /** HSL color string for this relation type */
  color: string
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
 * Generate evenly-distributed HSL colors for maximum visual distinction
 * Uses golden ratio for optimal hue distribution
 * @param count Number of colors to generate
 * @param isDarkMode Whether dark mode is active (affects lightness)
 * @param hueOffset Starting hue offset (default 0). Use half the golden angle (~68.75) to offset from another color set
 */
function generateComplementaryColors(count: number, isDarkMode: boolean, hueOffset: number = 0): string[] {
  if (count === 0)
    return []

  const colors: string[] = []
  const saturation = 70 // Vibrant but not overwhelming
  // Brighter colors in dark mode for better visibility
  const lightness = isDarkMode ? 60 : 50

  // Use golden angle (137.5°) for optimal distribution
  const goldenAngle = 137.508
  let hue = 220 + hueOffset // Start with a blue-ish hue, plus any offset

  for (let i = 0; i < count; i++) {
    colors.push(`hsl(${Math.round(hue % 360)}, ${saturation}%, ${lightness}%)`)
    hue += goldenAngle
  }

  return colors
}

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

  /**
   * Computed relation types with their colors, derived from the model
   */
  const relationTypes = computed<RelationTypeInfo[]>(() => {
    if (!model.value?.relation_types) {
      return []
    }

    const typeNames = Object.keys(model.value.relation_types)
    const colors = generateComplementaryColors(typeNames.length, isDark.value)

    return typeNames.map((name, index) => ({
      name,
      label: toHumanReadable(name),
      color: colors[index],
      description: model.value!.relation_types![name].description,
    }))
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
   * Map from parent type to its color
   * Each unique parent type gets a distinct color
   */
  const parentTypeColorMap = computed<Record<string, string>>(() => {
    if (!model.value?.component_types) {
      return {}
    }

    const componentTypes = model.value.component_types

    // Find all unique direct parent types (including types that are their own parent)
    const parentTypes = new Set<string>()
    for (const typeName of Object.keys(componentTypes)) {
      const parentType = getDirectParentType(typeName, componentTypes)
      parentTypes.add(parentType)
    }

    // Generate colors for parent types with offset from edge colors
    // Using half the golden angle (68.75°) ensures node colors fall between edge colors
    const sortedParentTypes = Array.from(parentTypes).sort()
    const halfGoldenAngle = 137.508 / 2 // ~68.75° offset for maximum distance from edge colors
    const colors = generateComplementaryColors(sortedParentTypes.length, isDark.value, halfGoldenAngle)

    // Create parent type -> color mapping
    const colorMap: Record<string, string> = {}
    sortedParentTypes.forEach((parentType, index) => {
      colorMap[parentType] = colors[index]
    })

    return colorMap
  })

  /**
   * Map from component type to its color based on direct parent type
   * All types that share the same direct parent get the same color
   */
  const componentTypeColorMap = computed<Record<string, string>>(() => {
    if (!model.value?.component_types) {
      return {}
    }

    const componentTypes = model.value.component_types

    // Map each component type to the color of its direct parent
    const colorMap: Record<string, string> = {}
    for (const typeName of Object.keys(componentTypes)) {
      const parentType = getDirectParentType(typeName, componentTypes)
      colorMap[typeName] = parentTypeColorMap.value[parentType] ?? 'hsl(0, 0%, 50%)'
    }

    return colorMap
  })

  /**
   * Get the color for a component type by name
   * Falls back to a default gray if not found
   */
  function getComponentTypeColor(typeName: string): string {
    return componentTypeColorMap.value[typeName] ?? 'hsl(0, 0%, 50%)'
  }

  /**
   * Set the deployment model to display
   */
  function setModel(newModel: EdmmDeploymentModel | null) {
    model.value = newModel
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
   * Get all unique parent type categories from the model
   */
  const uniqueParentTypes = computed<string[]>(() => {
    if (!model.value?.component_types)
      return []

    const parentTypes = new Set<string>()
    for (const typeName of Object.keys(model.value.component_types)) {
      const parentType = getDirectParentType(typeName, model.value.component_types)
      parentTypes.add(parentType)
    }
    return Array.from(parentTypes).sort()
  })

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

  return {
    model: readonly(model),
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
    clearModel,
    getRelationColor,
    getComponentTypeColor,
    getComponentTypeShape,
  }
})
