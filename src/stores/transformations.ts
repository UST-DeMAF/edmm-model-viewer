import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  existsTADM,
  generateSessionId,
} from '~/services/transformationService'

export interface Transformation {
  id: string
  name: string
  timestamp: number
}

export const useTransformationStore = defineStore('transformations', () => {
  // State
  const sessionId = ref(generateSessionId())
  const transformations = ref<Transformation[]>([])
  const activeTransformationId = ref<string | null>(null)

  // Load from localStorage on init
  const storedTransformations = localStorage.getItem('transformations')
  if (storedTransformations) {
    try {
      transformations.value = JSON.parse(storedTransformations)
    }
    catch {
      transformations.value = []
    }
  }

  // Computed
  const activeTransformation = computed(() => {
    return (
      transformations.value.find(
        t => t.id === activeTransformationId.value,
      ) || null
    )
  })

  const hasTransformations = computed(() => transformations.value.length > 0)

  // Actions
  function addTransformation(id: string, name: string) {
    const transformation: Transformation = {
      id,
      name,
      timestamp: Date.now(),
    }
    transformations.value.unshift(transformation)
    saveToLocalStorage()
  }

  function removeTransformation(id: string) {
    const index = transformations.value.findIndex(t => t.id === id)
    if (index !== -1) {
      transformations.value.splice(index, 1)
      saveToLocalStorage()
    }
    if (activeTransformationId.value === id) {
      activeTransformationId.value = null
    }
  }

  function setActiveTransformation(id: string | null) {
    activeTransformationId.value = id
  }

  function saveToLocalStorage() {
    localStorage.setItem(
      'transformations',
      JSON.stringify(transformations.value),
    )
  }

  async function validateTransformations() {
    const validTransformations: Transformation[] = []

    for (const transformation of transformations.value) {
      try {
        const exists = await existsTADM(transformation.id)
        if (exists) {
          validTransformations.push(transformation)
        }
      }
      catch {
        // Keep transformation if we can't validate (offline mode)
        validTransformations.push(transformation)
      }
    }

    transformations.value = validTransformations
    saveToLocalStorage()
  }

  function resetSessionId() {
    sessionId.value = generateSessionId()
  }

  return {
    // State
    sessionId,
    transformations,
    activeTransformationId,

    // Computed
    activeTransformation,
    hasTransformations,

    // Actions
    addTransformation,
    removeTransformation,
    setActiveTransformation,
    validateTransformations,
    resetSessionId,
  }
})
