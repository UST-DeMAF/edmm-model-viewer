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
 * Generate evenly-distributed HSL colors for maximum visual distinction
 * Uses golden ratio for optimal hue distribution
 */
function generateComplementaryColors(count: number, isDarkMode: boolean): string[] {
  if (count === 0)
    return []

  const colors: string[] = []
  const saturation = 70 // Vibrant but not overwhelming
  // Brighter colors in dark mode for better visibility
  const lightness = isDarkMode ? 60 : 50

  // Use golden angle (137.5°) for optimal distribution
  const goldenAngle = 137.508
  let hue = 220 // Start with a blue-ish hue

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
   * Map from component type to its color based on direct parent type
   * All types that share the same direct parent get the same color
   */
  const componentTypeColorMap = computed<Record<string, string>>(() => {
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

    // Generate colors for parent types
    const sortedParentTypes = Array.from(parentTypes).sort()
    const colors = generateComplementaryColors(sortedParentTypes.length, isDark.value)

    // Create parent type -> color mapping
    const parentColorMap: Record<string, string> = {}
    sortedParentTypes.forEach((parentType, index) => {
      parentColorMap[parentType] = colors[index]
    })

    // Map each component type to the color of its direct parent
    const colorMap: Record<string, string> = {}
    for (const typeName of Object.keys(componentTypes)) {
      const parentType = getDirectParentType(typeName, componentTypes)
      colorMap[typeName] = parentColorMap[parentType]
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

  return {
    model: readonly(model),
    relationTypes,
    relationTypeColorMap,
    componentTypeColorMap,
    setModel,
    clearModel,
    getRelationColor,
    getComponentTypeColor,
  }
})
