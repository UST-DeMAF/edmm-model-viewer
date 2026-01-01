<script setup lang="ts">
import type { ComponentTypeDefinition, TypeNode } from '~/lib/type-hierarchy'
import { Check, ChevronDown, ChevronRight, Minus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { buildTypeHierarchy } from '~/lib/type-hierarchy'
import { Button } from './ui/button'
import { DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu'

const props = defineProps<{
  componentTypes?: Record<string, ComponentTypeDefinition>
}>()

const modelValue = defineModel<string[]>({ required: true })

// Build the type hierarchy tree
const typeTree = computed(() => {
  if (!props.componentTypes)
    return []
  return buildTypeHierarchy(props.componentTypes)
})

// Pre-compute descendants map once when componentTypes changes (O(n) once instead of O(n) per call)
const descendantsMap = computed(() => {
  const map: Record<string, string[]> = {}
  if (!props.componentTypes)
    return map

  // Build map by iterating once
  Object.entries(props.componentTypes).forEach(([name, typeDef]) => {
    if (typeDef.extends && typeDef.extends !== '-') {
      if (!map[typeDef.extends]) {
        map[typeDef.extends] = []
      }
      map[typeDef.extends].push(name)
    }
  })

  // Now recursively get all descendants for each type
  function getAllDescendants(typeName: string): string[] {
    const directChildren = map[typeName] || []
    const allDescendants = [...directChildren]
    directChildren.forEach((child) => {
      allDescendants.push(...getAllDescendants(child))
    })
    return allDescendants
  }

  const result: Record<string, string[]> = {}
  Object.keys(props.componentTypes).forEach((typeName) => {
    result[typeName] = getAllDescendants(typeName)
  })
  return result
})

// Track expanded state for each type
const expandedTypes = ref<Set<string>>(new Set())

function toggleExpanded(typeName: string, event: Event) {
  event.stopPropagation()
  if (expandedTypes.value.has(typeName)) {
    expandedTypes.value.delete(typeName)
  }
  else {
    expandedTypes.value.add(typeName)
  }
}

function isExpanded(typeName: string): boolean {
  return expandedTypes.value.has(typeName)
}

// Compute selection states for ALL types at once (cached)
const selectionStates = computed(() => {
  const states: Record<string, 'all' | 'some' | 'none'> = {}
  const selectedSet = new Set(modelValue.value)

  if (!props.componentTypes)
    return states

  Object.keys(props.componentTypes).forEach((typeName) => {
    const descendants = descendantsMap.value[typeName] || []
    const selfSelected = selectedSet.has(typeName)

    if (descendants.length === 0) {
      // Leaf node
      states[typeName] = selfSelected ? 'all' : 'none'
    }
    else {
      const selectedDescendantsCount = descendants.filter(d => selectedSet.has(d)).length

      if (selfSelected && selectedDescendantsCount === descendants.length) {
        states[typeName] = 'all'
      }
      else if (selfSelected || selectedDescendantsCount > 0) {
        states[typeName] = 'some'
      }
      else {
        states[typeName] = 'none'
      }
    }
  })

  return states
})

// Toggle selection for a type with smart parent behavior
function toggleSelection(typeName: string) {
  if (!props.componentTypes)
    return

  const descendants = descendantsMap.value[typeName] || []
  const state = selectionStates.value[typeName] || 'none'
  let newSelection = [...modelValue.value]

  if (state === 'all') {
    // All selected -> deselect self and all descendants
    const toRemove = new Set([typeName, ...descendants])
    newSelection = newSelection.filter(t => !toRemove.has(t))
  }
  else {
    // None or some selected -> select self and all descendants
    const toAdd = [typeName, ...descendants]
    const existingSet = new Set(newSelection)
    toAdd.forEach((t) => {
      if (!existingSet.has(t)) {
        newSelection.push(t)
      }
    })
  }

  modelValue.value = newSelection
}

// Clear all selections
function clearAll() {
  modelValue.value = []
}

// Select all types
function selectAll() {
  if (!props.componentTypes)
    return
  modelValue.value = Object.keys(props.componentTypes)
}

// Flatten a node and its visible children into an array, including pre-computed state
function flattenVisibleNodes(
  nodes: TypeNode[],
  depth: number = 0,
): Array<{ node: TypeNode, depth: number, state: 'all' | 'some' | 'none' }> {
  const result: Array<{ node: TypeNode, depth: number, state: 'all' | 'some' | 'none' }> = []
  for (const treeNode of nodes) {
    result.push({
      node: treeNode,
      depth,
      state: selectionStates.value[treeNode.name] || 'none',
    })
    if (treeNode.children.length > 0 && isExpanded(treeNode.name)) {
      result.push(...flattenVisibleNodes(treeNode.children, depth + 1))
    }
  }
  return result
}

const visibleNodes = computed(() => flattenVisibleNodes(typeTree.value))

// Compute a summary of the current filter state
const filterSummary = computed(() => {
  const totalTypes = props.componentTypes ? Object.keys(props.componentTypes).length : 0
  const selectedCount = modelValue.value.length

  if (totalTypes === 0) {
    return 'No types'
  }
  if (selectedCount === 0) {
    return 'All visible'
  }
  return `${selectedCount} of ${totalTypes} visible`
})
</script>

<template>
  <div class="w-72">
    <!-- Header with actions -->
    <DropdownMenuLabel class="flex items-center justify-between">
      <span class="text-muted-foreground">{{ filterSummary }}</span>
      <div class="flex gap-1">
        <button
          class="text-xs text-muted-foreground transition-colors hover:text-foreground"
          @click="selectAll"
        >
          All
        </button>
        <span class="text-muted-foreground">/</span>
        <button
          class="text-xs text-muted-foreground transition-colors hover:text-foreground"
          @click="clearAll"
        >
          Clear
        </button>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />

    <!-- Type tree -->
    <div class="max-h-128 overflow-y-auto">
      <template v-if="visibleNodes.length === 0">
        <div class="text-sm text-muted-foreground px-3 py-4 text-center">
          No types defined
        </div>
      </template>
      <template v-else>
        <div
          v-for="{ node: treeNode, depth, state } in visibleNodes"
          :key="treeNode.name"
          :title="treeNode.name"
          class="pe-2 rounded-sm flex gap-1 h-8 cursor-pointer transition-colors items-center hover:bg-accent"
          :style="{ marginLeft: `${depth * 16}px` }"
          @click="toggleSelection(treeNode.name)"
        >
          <!-- Expand/collapse button -->
          <Button
            v-if="treeNode.children.length > 0"
            variant="ghost"
            class="text-muted-foreground ms-1 flex shrink-0 size-6 items-center justify-center hover:text-foreground hover:bg-foreground/10!"
            @click.stop="toggleExpanded(treeNode.name, $event)"
          >
            <ChevronDown v-if="isExpanded(treeNode.name)" class="size-4" />
            <ChevronRight v-else class="size-4" />
          </Button>
          <span v-else class="ms-1 shrink-0 size-6" />

          <!-- Type name -->
          <span class="text-sm flex-1 truncate">{{ treeNode.name }}</span>

          <!-- Selection indicator -->
          <Check v-if="state === 'all'" class="text-foreground shrink-0 size-4" />
          <Minus v-else-if="state === 'some'" class="text-foreground shrink-0 size-4" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
</style>
