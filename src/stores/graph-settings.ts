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
  layoutDirection: LayoutDirection
  layoutAlgorithm: LayoutAlgorithm
  scaleWithDependencies: boolean
  typeDifferentiationMode: TypeDifferentiationMode
  isSidebarExpanded: boolean
  highlightRange: number | null // 1-5 or null (unlimited)
}

const DEFAULT_STATE: GraphSettingsState = {
  interactionMode: 'NORMAL',
  showEdgeLabels: false,
  layoutDirection: 'horizontal',
  layoutAlgorithm: 'default',
  scaleWithDependencies: false,
  typeDifferentiationMode: 'COLOR',
  isSidebarExpanded: true, // Sidebar opened by default
  highlightRange: 1, // default: direct only (1 step)
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

  const layoutDirection = computed({
    get: () => state.value.layoutDirection,
    set: val => state.value.layoutDirection = val,
  })

  const layoutAlgorithm = computed({
    get: () => state.value.layoutAlgorithm,
    set: val => state.value.layoutAlgorithm = val,
  })

  const scaleWithDependencies = computed({
    get: () => state.value.scaleWithDependencies,
    set: val => state.value.scaleWithDependencies = val,
  })

  const typeDifferentiationMode = computed({
    get: () => state.value.typeDifferentiationMode,
    set: val => state.value.typeDifferentiationMode = val,
  })

  // Sidebar expanded state
  const isSidebarExpanded = computed({
    get: () => state.value.isSidebarExpanded,
    set: val => state.value.isSidebarExpanded = val,
  })

  // Highlight range: 1-5 or null (unlimited)
  const highlightRange = computed({
    get: () => state.value.highlightRange,
    set: val => state.value.highlightRange = val,
  })

  // Computed config for use in graph layout
  const config = computed<LayoutConfig>(() => ({
    interactionMode: interactionMode.value,
    showEdgeLabels: showEdgeLabels.value,
    layoutDirection: layoutDirection.value,
    layoutAlgorithm: layoutAlgorithm.value,
    scaleWithDependencies: scaleWithDependencies.value,
  }))

  // Reset all to defaults
  function resetToDefaults() {
    state.value = { ...DEFAULT_STATE }
    searchQuery.value = ''
  }

  return {
    // State
    interactionMode,
    showEdgeLabels,
    layoutDirection,
    layoutAlgorithm,
    scaleWithDependencies,
    typeDifferentiationMode,
    isSidebarExpanded,
    highlightRange,
    searchQuery,
    isSearchOpen,
    // Computed
    config,
    // Actions
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGraphSettingsStore as any, import.meta.hot))
