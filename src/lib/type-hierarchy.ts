/**
 * Utilities for working with EDMM component type hierarchies
 */

// Type definition matching the schema
export interface ComponentTypeDefinition {
  extends?: string
  description?: string | null
  metadata?: Record<string, string>
  properties?: Record<string, unknown>
  operations?: Record<string, unknown>
}

export interface TypeNode {
  name: string
  children: TypeNode[]
}

/**
 * Build a hierarchical tree structure from flat component_types
 */
export function buildTypeHierarchy(componentTypes: Record<string, ComponentTypeDefinition>): TypeNode[] {
  const typeNames = Object.keys(componentTypes)

  // Build parent-to-children map
  const childrenMap: Record<string, string[]> = {}
  const hasParent = new Set<string>()

  typeNames.forEach((typeName) => {
    const typeDef = componentTypes[typeName]
    // Ignore '-' as a parent (YAML convention for null/undefined)
    if (typeDef.extends && typeDef.extends !== '-') {
      hasParent.add(typeName)
      if (!childrenMap[typeDef.extends]) {
        childrenMap[typeDef.extends] = []
      }
      childrenMap[typeDef.extends].push(typeName)
    }
  })

  // Find root types (those with no parent)
  const rootTypes = typeNames.filter(name => !hasParent.has(name))

  // Recursively build tree
  function buildNode(name: string): TypeNode {
    const children = (childrenMap[name] || [])
      .sort()
      .map(childName => buildNode(childName))
    return { name, children }
  }

  return rootTypes.sort().map(name => buildNode(name))
}

/**
 * Get all descendant types (types that extend the given type, recursively)
 */
export function getAllDescendantTypes(
  typeName: string,
  componentTypes: Record<string, ComponentTypeDefinition>,
): string[] {
  const descendants: string[] = []

  Object.entries(componentTypes).forEach(([name, typeDef]) => {
    // Ignore '-' as a parent (YAML convention for null/undefined)
    if (typeDef.extends && typeDef.extends !== '-' && typeDef.extends === typeName) {
      descendants.push(name)
      descendants.push(...getAllDescendantTypes(name, componentTypes))
    }
  })

  return descendants
}

/**
 * Get all ancestor types (parent types up the inheritance chain)
 */
export function getAllAncestorTypes(
  typeName: string,
  componentTypes: Record<string, ComponentTypeDefinition>,
): string[] {
  const ancestors: string[] = []
  let currentType = typeName

  while (currentType && componentTypes[currentType]) {
    const parentType = componentTypes[currentType].extends
    // Ignore '-' as a parent (YAML convention for null/undefined)
    if (parentType && parentType !== '-') {
      ancestors.push(parentType)
      currentType = parentType
    }
    else {
      break
    }
  }

  return ancestors
}

/**
 * Flatten a type hierarchy tree to get all type names
 */
export function flattenTypeHierarchy(nodes: TypeNode[]): string[] {
  const result: string[] = []

  function traverse(node: TypeNode) {
    result.push(node.name)
    node.children.forEach(child => traverse(child))
  }

  nodes.forEach(node => traverse(node))
  return result
}

/**
 * Check if a node's type should be visible based on selected filter types
 * A node is visible if:
 * - No filter is applied (visibleTypes is empty)
 * - Its exact type is in visibleTypes
 */
export function isTypeVisible(
  nodeType: string,
  visibleTypes: string[],
  _componentTypes: Record<string, ComponentTypeDefinition>,
): boolean {
  // Empty filter = show all
  if (visibleTypes.length === 0) {
    return true
  }

  // Check exact match only
  return visibleTypes.includes(nodeType)
}
