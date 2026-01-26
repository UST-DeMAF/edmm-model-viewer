<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { TreeItem, TreeRoot } from 'reka-ui'
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

interface RelationTreeItem {
  name: string
  label: string
  color: string
  description?: string | null
  children?: RelationTreeItem[]
}

const settingsStore = useGraphSettingsStore()
const graphStore = useGraphStore()

const { visibleRelations } = storeToRefs(settingsStore)
const { relationTypes, model } = storeToRefs(graphStore)

/**
 * Build a hierarchical tree structure from relation types based on their 'extends' property
 */
const relationTypeTree = computed<RelationTreeItem[]>(() => {
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

function isEdgeTypeVisible(edgeType: string): boolean {
  return visibleRelations.value.includes(edgeType as typeof visibleRelations.value[number])
}

/**
 * Recursively collect all descendant edge type names from a tree item
 */
function getAllDescendants(item: RelationTreeItem): string[] {
  const descendants: string[] = []
  if (item.children) {
    for (const child of item.children) {
      descendants.push(child.name)
      descendants.push(...getAllDescendants(child))
    }
  }
  return descendants
}

/**
 * Find a tree item by name in the relation type tree
 */
function findTreeItem(items: RelationTreeItem[], name: string): RelationTreeItem | undefined {
  for (const item of items) {
    if (item.name === name) {
      return item
    }
    if (item.children) {
      const found = findTreeItem(item.children, name)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

function toggleEdgeType(edgeType: string): void {
  if (isEdgeTypeVisible(edgeType)) {
    // When hiding an edge type, also hide all its descendants
    const treeItem = findTreeItem(relationTypeTree.value, edgeType)
    const descendantNames = treeItem ? getAllDescendants(treeItem) : []
    const toRemove = new Set([edgeType, ...descendantNames])

    visibleRelations.value = visibleRelations.value.filter(
      r => !toRemove.has(r),
    )
  }
  else {
    // When showing an edge type, also show all its descendants
    const treeItem = findTreeItem(relationTypeTree.value, edgeType)
    const descendantNames = treeItem ? getAllDescendants(treeItem) : []
    const toAdd = [edgeType, ...descendantNames] as typeof visibleRelations.value
    const currentVisible = new Set(visibleRelations.value)

    visibleRelations.value = [
      ...visibleRelations.value,
      ...toAdd.filter(r => !currentVisible.has(r)),
    ]
  }
}

function getIndentation(level: number, extra: number = 0): string {
  return `${(level - 1) * 1 + extra}rem`
}

/**
 * Check if a tree item has a next sibling at the same level
 */
function hasNextSiblingAtLevel(flattenItems: { level: number }[], index: number): boolean {
  const currentLevel = flattenItems[index].level
  for (let i = index + 1; i < flattenItems.length; i++) {
    const nextLevel = flattenItems[i].level
    if (nextLevel < currentLevel) {
      // We've exited the current subtree, no more siblings
      return false
    }
    if (nextLevel === currentLevel) {
      // Found a sibling at the same level
      return true
    }
    // nextLevel > currentLevel means it's a child, continue searching
  }
  return false
}
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    class="text-sm list-none rounded-lg bg-background/90 select-none backdrop-blur"
    :items="relationTypeTree"
    :get-key="(item) => item.name"
    disabled
    :expanded="relationTypes.map((rt) => rt.name)"
  >
    <Tooltip v-for="(item, index) in flattenItems" :key="item._id" :delay-duration="700">
      <TooltipTrigger as-child>
        <TreeItem
          :style="{ 'padding-left': getIndentation(item.level, 0.6) }"
          v-bind="item.bind"
          class="pr-3 rounded-lg flex gap-2 h-8 cursor-pointer items-center relative hover:bg-foreground/5"
          @click.stop="toggleEdgeType(item.value.name)"
        >
          <div class="flex gap-2 items-center" :class="{ 'opacity-40': !isEdgeTypeVisible(item.value.name) }">
            <!-- Color indicator -->
            <div
              class="rounded-full shrink-0 size-2 transition-opacity"
              :style="{ backgroundColor: item.value.color }"
            />

            <!-- Label -->
            <span class="transition-opacity">{{ item.value.label }}</span>

            <!-- Visibility icon -->
            <i
              class="i-lucide-eye-off text-muted-foreground ml-auto size-3.5"
              :class="{ 'opacity-0': isEdgeTypeVisible(item.value.name) }"
            />
          </div>
        </TreeItem>
      </TooltipTrigger>
      <TooltipContent v-if="item.value.description" side="left" class="max-w-xs">
        {{ item.value.description }}
      </TooltipContent>
    </Tooltip>
  </TreeRoot>
</template>
