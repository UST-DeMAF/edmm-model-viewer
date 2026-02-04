import type {
  LayoutAlgorithm,
  LayoutConfig,
  LayoutDirection,
} from '~/lib/graph-layout'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

export type InteractionMode = LayoutConfig['interactionMode']

export type TypeDifferentiationMode = 'DISABLED' | 'COLOR' | 'SHAPE'

interface GraphSettingsState {
  interactionMode: InteractionMode
  showEdgeLabels: boolean
  /** Hidden relation types by name (empty = all visible) */
  hiddenRelations: string[]
  layoutDirection: LayoutDirection
  layoutAlgorithm: LayoutAlgorithm
  visibleNodeTypes: string[]
  scaleWithDependencies: boolean
  typeDifferentiationMode: TypeDifferentiationMode
  shortestPathAnchorNode: string | null
  visibleNodeIds: string[] | null // null = show all, array = filter to these IDs
  isSidebarExpanded: boolean
}

const DEFAULT_STATE: GraphSettingsState = {
  interactionMode: 'NORMAL',
  showEdgeLabels: false,
  hiddenRelations: [], // Empty = all relations visible (none hidden)
  layoutDirection: 'horizontal',
  layoutAlgorithm: 'default',
  visibleNodeTypes: [], // Empty = show all types
  scaleWithDependencies: false,
  typeDifferentiationMode: 'COLOR',
  shortestPathAnchorNode: null,
  visibleNodeIds: null, // null = show all, array = filter to these IDs
  isSidebarExpanded: true, // Sidebar opened by default
}

export const useGraphSettingsStore = defineStore('graph-settings', () => {
  // Persisted state using localStorage
  const state = useLocalStorage<GraphSettingsState>('graph-settings-state', { ...DEFAULT_STATE })

  // Search state is not persisted (should reset on page load)
  const searchQuery = ref('')
  const isSearchOpen = ref(false)

  // Computed getters/setters for individual state properties
  const interactionMode = computed({
    get: () => state.value.interactionMode,
    set: val => state.value.interactionMode = val,
  })

  const showEdgeLabels = computed({
    get: () => state.value.showEdgeLabels,
    set: val => state.value.showEdgeLabels = val,
  })

  const hiddenRelations = computed({
    get: () => state.value.hiddenRelations,
    set: val => state.value.hiddenRelations = val,
  })

  const layoutDirection = computed({
    get: () => state.value.layoutDirection,
    set: val => state.value.layoutDirection = val,
  })

  const layoutAlgorithm = computed({
    get: () => state.value.layoutAlgorithm,
    set: val => state.value.layoutAlgorithm = val,
  })

  const visibleNodeTypes = computed({
    get: () => state.value.visibleNodeTypes,
    set: val => state.value.visibleNodeTypes = val,
  })

  const scaleWithDependencies = computed({
    get: () => state.value.scaleWithDependencies,
    set: val => state.value.scaleWithDependencies = val,
  })

  const typeDifferentiationMode = computed({
    get: () => state.value.typeDifferentiationMode,
    set: val => state.value.typeDifferentiationMode = val,
  })

  // Shortest path anchor node (non-persisted state that resets when mode changes)
  const shortestPathAnchorNode = computed({
    get: () => state.value.shortestPathAnchorNode,
    set: val => state.value.shortestPathAnchorNode = val,
  })

  // Visible node IDs filter (null = show all, array = only show these nodes)
  const visibleNodeIds = computed({
    get: () => state.value.visibleNodeIds,
    set: val => state.value.visibleNodeIds = val,
  })

  // Sidebar expanded state
  const isSidebarExpanded = computed({
    get: () => state.value.isSidebarExpanded,
    set: val => state.value.isSidebarExpanded = val,
  })

  // Helper to set visible node IDs (for "Hide unselected nodes" feature)
  function setVisibleNodeIds(nodeIds: string[] | null): void {
    state.value.visibleNodeIds = nodeIds
  }

  // Helper to show all nodes (clear the filter)
  function showAllNodes(): void {
    state.value.visibleNodeIds = null
  }

  // Computed config for use in graph layout
  const config = computed<LayoutConfig>(() => ({
    interactionMode: interactionMode.value,
    showEdgeLabels: showEdgeLabels.value,
    hiddenRelations: hiddenRelations.value,
    layoutDirection: layoutDirection.value,
    layoutAlgorithm: layoutAlgorithm.value,
    scaleWithDependencies: scaleWithDependencies.value,
  }))

  // Helper to check if a relation type is visible (not hidden)
  function isRelationVisible(type: string): boolean {
    // Relation is visible if it's NOT in the hidden list
    return !state.value.hiddenRelations.includes(type)
  }

  function toggleRelationVisibility(type: string): void {
    const index = state.value.hiddenRelations.indexOf(type)
    if (index === -1) {
      // Not hidden yet, add to hidden list
      state.value.hiddenRelations = [...state.value.hiddenRelations, type]
    }
    else {
      // Already hidden, remove from hidden list (make visible)
      state.value.hiddenRelations = state.value.hiddenRelations.filter(t => t !== type)
    }
  }

  // Reset all to defaults
  function resetToDefaults() {
    state.value = { ...DEFAULT_STATE }
    searchQuery.value = ''
  }

  return {
    // State
    interactionMode,
    showEdgeLabels,
    hiddenRelations,
    layoutDirection,
    layoutAlgorithm,
    visibleNodeTypes,
    scaleWithDependencies,
    typeDifferentiationMode,
    shortestPathAnchorNode,
    visibleNodeIds,
    isSidebarExpanded,
    searchQuery,
    isSearchOpen,
    // Computed
    config,
    // Actions
    isRelationVisible,
    toggleRelationVisibility,
    setVisibleNodeIds,
    showAllNodes,
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGraphSettingsStore as any, import.meta.hot))
