<script setup lang="ts">
import type { EdmmDeploymentModel } from '~/lib/io'
import { AlertCircle, FileText, Loader2, Upload } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { parseAndValidateEdmm } from '~/lib/io'
import { fetchTADM } from '~/services/transformationService'

const props = defineProps<{
  /** Optional: Load model from backend by transformation process ID */
  transformationId?: string
  /** Optional: Show minimal UI (just status, no file picker) */
  minimal?: boolean
}>()

const model = ref<EdmmDeploymentModel | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  loading.value = true
  errorMessage.value = null
  model.value = null

  try {
    const contents = await file.text()
    const result = parseAndValidateEdmm(contents)

    if (result.success && result.data) {
      model.value = result.data
    }
    else {
      errorMessage.value = result.errors?.join(' | ') ?? 'Model failed to validate'
    }
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loading.value = false
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

async function loadFromBackend(transformationId: string) {
  loading.value = true
  errorMessage.value = null
  model.value = null

  try {
    const yamlContent = await fetchTADM(transformationId)
    const result = parseAndValidateEdmm(yamlContent)

    if (result.success && result.data) {
      model.value = result.data
    }
    else {
      errorMessage.value = result.errors?.join(' | ') ?? 'Model failed to validate'
    }
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    loading.value = false
  }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

// Watch for transformationId changes
watch(
  () => props.transformationId,
  (newId) => {
    if (newId) {
      loadFromBackend(newId)
    }
  },
  { immediate: true },
)

onMounted(async () => {
  // Load test YAML in development mode
  if (import.meta.env.VITE_APP_USE_TEST_YAML && !props.transformationId) {
    loading.value = true
    try {
      const testYaml = (await import('@/assets/edmm-models/otelshopAnsible_expected.yaml?raw')).default
      const result = parseAndValidateEdmm(testYaml)
      if (result.success && result.data) {
        model.value = result.data
      }
      else {
        errorMessage.value = result.errors?.join(' | ') ?? 'Model failed to validate'
      }
    }
    finally {
      loading.value = false
    }
  }
})

// Expose model for parent components
defineExpose({ model, loading, errorMessage, loadFromBackend })
</script>

<template>
  <!-- Loading State -->
  <div v-if="loading" class="flex flex-col gap-4 min-h-[200px] items-center justify-center">
    <Loader2 class="text-primary h-8 w-8 animate-spin" />
    <p class="text-muted-foreground">
      Loading model…
    </p>
  </div>

  <!-- Error State -->
  <div v-else-if="errorMessage" class="p-6 flex flex-col gap-4 min-h-[200px] items-center justify-center">
    <div class="p-4 rounded-lg bg-destructive/10 flex gap-3 max-w-md items-center">
      <AlertCircle class="text-destructive flex-shrink-0 h-6 w-6" />
      <p class="text-sm text-destructive">
        {{ errorMessage }}
      </p>
    </div>
    <button
      v-if="!minimal"
      class="text-secondary-foreground px-4 py-2 rounded-lg bg-secondary flex gap-2 transition-colors items-center hover:bg-secondary/80"
      @click="openFilePicker"
    >
      <Upload class="h-4 w-4" />
      Try another file
    </button>
  </div>

  <!-- Model Loaded - Render Slot -->
  <slot v-else-if="model" :model="model" />

  <!-- No Model - File Picker -->
  <div v-else-if="!minimal" class="p-8 flex flex-col gap-6 min-h-[400px] items-center justify-center">
    <div
      class="p-12 border-2 border-border rounded-xl border-dashed bg-secondary/30 flex flex-col gap-4 max-w-md w-full cursor-pointer transition-all items-center justify-center hover:border-primary/50 hover:bg-secondary/50"
      @click="openFilePicker"
    >
      <div class="p-4 rounded-full bg-primary/10">
        <FileText class="text-primary h-10 w-10" />
      </div>
      <div class="text-center">
        <p class="text-lg text-foreground font-medium">
          Pick an EDMM YAML file
        </p>
        <p class="text-sm text-muted-foreground mt-1">
          Click to browse or drag and drop
        </p>
      </div>
      <div class="mt-2 flex gap-2">
        <span class="text-xs px-2 py-1 rounded bg-secondary">.yaml</span>
        <span class="text-xs px-2 py-1 rounded bg-secondary">.yml</span>
        <span class="text-xs px-2 py-1 rounded bg-secondary">.json</span>
      </div>
    </div>
  </div>

  <!-- Minimal mode - waiting for backend -->
  <div v-else class="flex flex-col gap-4 min-h-[200px] items-center justify-center">
    <p class="text-muted-foreground">
      No model loaded yet.
    </p>
  </div>

  <!-- Hidden file input -->
  <input ref="fileInputRef" type="file" accept=".yaml,.yml,.json" class="hidden" @change="handleFileChange">
</template>
