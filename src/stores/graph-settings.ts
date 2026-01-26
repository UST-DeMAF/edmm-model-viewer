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
  /** Visible relation types by name (empty = show all) */
  visibleRelations: string[]
  layoutDirection: LayoutDirection
  layoutAlgorithm: LayoutAlgorithm
  visibleNodeTypes: string[]
  scaleWithDependencies: boolean
  typeDifferentiationMode: TypeDifferentiationMode
  shortestPathAnchorNode: string | null
  visibleNodeIds: string[] | null // null = show all, array = filter to these IDs
}

const DEFAULT_STATE: GraphSettingsState = {
  interactionMode: 'NORMAL',
  showEdgeLabels: false,
  visibleRelations: [], // Empty = show all relations (dynamic from model)
  layoutDirection: 'horizontal',
  layoutAlgorithm: 'default',
  visibleNodeTypes: [], // Empty = show all types
  scaleWithDependencies: false,
  typeDifferentiationMode: 'DISABLED',
  shortestPathAnchorNode: null,
  visibleNodeIds: null, // null = show all, array = filter to these IDs
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

  const visibleRelations = computed({
    get: () => state.value.visibleRelations,
    set: val => state.value.visibleRelations = val,
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
    visibleRelations: visibleRelations.value,
    layoutDirection: layoutDirection.value,
    layoutAlgorithm: layoutAlgorithm.value,
    scaleWithDependencies: scaleWithDependencies.value,
  }))

  // Helper to check/toggle visible relation types (now uses strings)
  function isVisibleRelationEnabled(type: string): boolean {
    // If visibleRelations is empty, all relations are visible
    if (state.value.visibleRelations.length === 0) {
      return true
    }
    return state.value.visibleRelations.includes(type)
  }

  function toggleVisibleRelation(type: string): void {
    const index = state.value.visibleRelations.indexOf(type)
    if (index === -1) {
      state.value.visibleRelations = [...state.value.visibleRelations, type]
    }
    else {
      state.value.visibleRelations = state.value.visibleRelations.filter(t => t !== type)
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
    visibleRelations,
    layoutDirection,
    layoutAlgorithm,
    visibleNodeTypes,
    scaleWithDependencies,
    typeDifferentiationMode,
    shortestPathAnchorNode,
    visibleNodeIds,
    searchQuery,
    isSearchOpen,
    // Computed
    config,
    // Actions
    isVisibleRelationEnabled,
    toggleVisibleRelation,
    setVisibleNodeIds,
    showAllNodes,
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGraphSettingsStore as any, import.meta.hot))
