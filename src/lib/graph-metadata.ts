/**
 * Shared metadata helpers for EDMM graph elements (nodes and edges).
 *
 * Centralises the `hasMetadata` check that was previously copy-pasted across
 * `EdmmEdge.vue`, `use-graph-interaction.ts`, and `EdmmGraph.vue`.
 */

export interface ElementMetadata {
    description?: string | null
    properties?: Record<string, unknown> | null
    operations?: Record<string, unknown> | null
}

/**
 * Returns `true` when the element carries at least one piece of displayable
 * metadata: a non-empty description, at least one property, or at least one
 * operation.
 *
 * This is the single source of truth used to decide whether an edge/node is
 * hoverable / clickable and whether the info-panel should open.
 */
export function hasMetadata(data: ElementMetadata | null | undefined): boolean {
    if (!data)
        return false

    const hasDescription = data.description !== null
      && data.description !== undefined
      && data.description !== ''

    const hasProperties = data.properties != null
      && Object.keys(data.properties).length > 0

    const hasOperations = data.operations != null
      && Object.keys(data.operations).length > 0

    return hasDescription || hasProperties || hasOperations
}
