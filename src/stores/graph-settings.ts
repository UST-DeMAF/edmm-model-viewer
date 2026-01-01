import type {
  HostedOnRelationDisplay,
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

interface GraphSettingsState {
  hostedOnRelationDisplay: HostedOnRelationDisplay
  interactionMode: InteractionMode
  showEdgeLabels: boolean
  layoutRelations: RelationType[]
  visibleRelations: RelationType[]
  layoutDirection: LayoutDirection
  visibleNodeTypes: string[]
  scaleWithDependencies: boolean
}

const DEFAULT_STATE: GraphSettingsState = {
  hostedOnRelationDisplay: 'SHOW',
  interactionMode: 'NORMAL',
  showEdgeLabels: false,
  layoutRelations: [...ALL_RELATION_TYPES],
  visibleRelations: [...ALL_RELATION_TYPES],
  layoutDirection: 'horizontal',
  visibleNodeTypes: [], // Empty = show all types
  scaleWithDependencies: false,
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

  const layoutRelations = computed({
    get: () => state.value.layoutRelations,
    set: val => state.value.layoutRelations = val,
  })

  const visibleRelations = computed({
    get: () => state.value.visibleRelations,
    set: val => state.value.visibleRelations = val,
  })

  const layoutDirection = computed({
    get: () => state.value.layoutDirection,
    set: val => state.value.layoutDirection = val,
  })

  const visibleNodeTypes = computed({
    get: () => state.value.visibleNodeTypes,
    set: val => state.value.visibleNodeTypes = val,
  })

  const scaleWithDependencies = computed({
    get: () => state.value.scaleWithDependencies,
    set: val => state.value.scaleWithDependencies = val,
  })

  // Computed config for use in graph layout
  const config = computed<LayoutConfig>(() => ({
    hostedOnRelationDisplay: hostedOnRelationDisplay.value,
    interactionMode: interactionMode.value,
    showEdgeLabels: showEdgeLabels.value,
    layoutRelations: layoutRelations.value,
    visibleRelations: visibleRelations.value,
    layoutDirection: layoutDirection.value,
    scaleWithDependencies: scaleWithDependencies.value,
  }))

  // Helper to check/toggle layout relation types
  function isLayoutRelationEnabled(type: RelationType): boolean {
    return state.value.layoutRelations.includes(type)
  }

  function toggleLayoutRelation(type: RelationType): void {
    const index = state.value.layoutRelations.indexOf(type)
    if (index === -1) {
      state.value.layoutRelations = [...state.value.layoutRelations, type]
    }
    else {
      state.value.layoutRelations = state.value.layoutRelations.filter(t => t !== type)
    }
  }

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
    layoutRelations,
    visibleRelations,
    layoutDirection,
    visibleNodeTypes,
    scaleWithDependencies,
    searchQuery,
    isSearchOpen,
    // Computed
    config,
    // Actions
    isLayoutRelationEnabled,
    toggleLayoutRelation,
    isVisibleRelationEnabled,
    toggleVisibleRelation,
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGraphSettingsStore as any, import.meta.hot))
