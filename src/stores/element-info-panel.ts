import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

export interface ElementInfoPanelState {
  descriptionOpen: boolean
  typeHierarchyOpen: boolean
  metadataOpen: boolean
  propertiesOpen: boolean
  operationsOpen: boolean
  artifactsOpen: boolean
}

const DEFAULT_STATE: ElementInfoPanelState = {
  descriptionOpen: true,
  typeHierarchyOpen: true,
  metadataOpen: true,
  propertiesOpen: true,
  operationsOpen: true,
  artifactsOpen: true,
}

export const useElementInfoPanelStore = defineStore('element-info-panel', () => {
  // Persisted state using localStorage
  const state = useLocalStorage<ElementInfoPanelState>('element-info-panel-state', { ...DEFAULT_STATE })

  // Individual refs for easier v-model binding
  const descriptionOpen = computed({
    get: () => state.value.descriptionOpen,
    set: val => state.value.descriptionOpen = val,
  })

  const typeHierarchyOpen = computed({
    get: () => state.value.typeHierarchyOpen,
    set: val => state.value.typeHierarchyOpen = val,
  })

  const metadataOpen = computed({
    get: () => state.value.metadataOpen,
    set: val => state.value.metadataOpen = val,
  })

  const propertiesOpen = computed({
    get: () => state.value.propertiesOpen,
    set: val => state.value.propertiesOpen = val,
  })

  const operationsOpen = computed({
    get: () => state.value.operationsOpen,
    set: val => state.value.operationsOpen = val,
  })

  const artifactsOpen = computed({
    get: () => state.value.artifactsOpen,
    set: val => state.value.artifactsOpen = val,
  })

  // Reset all to default
  function resetToDefaults() {
    state.value = { ...DEFAULT_STATE }
  }

  return {
    descriptionOpen,
    typeHierarchyOpen,
    metadataOpen,
    propertiesOpen,
    operationsOpen,
    artifactsOpen,
    resetToDefaults,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useElementInfoPanelStore as any, import.meta.hot))
