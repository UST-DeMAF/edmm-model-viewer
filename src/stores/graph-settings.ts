import type {
  HostedOnRelationDisplay,
  LayoutAlgorithm,
  LayoutConfig,
  LayoutDirection,
  RelationType,
} from '~/lib/graph-layout'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  ALL_RELATION_TYPES,

} from '~/lib/graph-layout'

export type InteractionMode = LayoutConfig['interactionMode']

export type TypeDifferentiationMode = 'DISABLED' | 'COLOR' | 'SHAPE'

interface GraphSettingsState {
  hostedOnRelationDisplay: HostedOnRelationDisplay
  interactionMode: InteractionMode
  showEdgeLabels: boolean
  visibleRelations: RelationType[]
  layoutDirection: LayoutDirection
  layoutAlgorithm: LayoutAlgorithm
  visibleNodeTypes: string[]
  scaleWithDependencies: boolean
  typeDifferentiationMode: TypeDifferentiationMode
  shortestPathAnchorNode: string | null
}

const DEFAULT_STATE: GraphSettingsState = {
  hostedOnRelationDisplay: 'SHOW',
  interactionMode: 'NORMAL',
  showEdgeLabels: false,
  visibleRelations: [...ALL_RELATION_TYPES],
  layoutDirection: 'horizontal',
  layoutAlgorithm: 'default',
  visibleNodeTypes: [], // Empty = show all types
  scaleWithDependencies: false,
  typeDifferentiationMode: 'DISABLED',
  shortestPathAnchorNode: null,
}

export const useGraphSettingsStore = defineStore('graph-settings', () => {
  // Persisted state using localStorage
  const state = useLocalStorage<GraphSettingsState>('graph-settings-state', { ...DEFAULT_STATE })

  // Search state is not persisted (should reset on page load)
  const searchQuery = ref('')
  const isSearchOpen = ref(false)

  // Computed getters/setters for individual state properties
  const hostedOnRelationDisplay = computed({
    get: () => state.value.hostedOnRelationDisplay,
    set: val => state.value.hostedOnRelationDisplay = val,
  })

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

  // Computed config for use in graph layout
  const config = computed<LayoutConfig>(() => ({
    hostedOnRelationDisplay: hostedOnRelationDisplay.value,
    interactionMode: interactionMode.value,
    showEdgeLabels: showEdgeLabels.value,
    visibleRelations: visibleRelations.value,
    layoutDirection: layoutDirection.value,
    layoutAlgorithm: layoutAlgorithm.value,
    scaleWithDependencies: scaleWithDependencies.value,
  }))

  // Helper to check/toggle visible relation types
  function isVisibleRelationEnabled(type: RelationType): boolean {
    return state.value.visibleRelations.includes(type)
  }

  function toggleVisibleRelation(type: RelationType): void {
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
    hostedOnRelationDisplay,
    interactionMode,
    showEdgeLabels,
    visibleRelations,
    layoutDirection,
    layoutAlgorithm,
    visibleNodeTypes,
    scaleWithDependencies,
    typeDifferentiationMode,
    shortestPathAnchorNode,
    searchQuery,
    isSearchOpen,
    // Computed
    config,
    // Actions
    isVisibleRelationEnabled,
    toggleVisibleRelation,
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGraphSettingsStore as any, import.meta.hot))
