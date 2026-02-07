<script setup lang="ts">
import type { EdmmDeploymentModel } from '~/lib/io'
import { AlertCircle, FileText, Upload } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import TransformDialog from '~/components/dialogs/TransformDialog.vue'
import EdmmGraph from '~/components/EdmmGraph.vue'
import EdmmModelLoader from '~/components/EdmmModelLoader.vue'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { parseAndValidateEdmm } from '~/lib/io'
import { useGraphStore } from '~/stores/graph'
import { useTransformationStore } from '~/stores/transformations'

const graphStore = useGraphStore()
const transformationStore = useTransformationStore()

type ViewMode = 'welcome' | 'local' | 'transformation' | 'demo'
// Skip welcome screen when using test YAML mode
const initialViewMode: ViewMode = import.meta.env.VITE_APP_USE_TEST_YAML ? 'local' : 'welcome'
const viewMode = ref<ViewMode>(initialViewMode)

// Local file state
const localModel = ref<EdmmDeploymentModel | null>(null)
const localFileInputRef = ref<HTMLInputElement | null>(null)
const parseError = ref<string | null>(null)
const errorDialogOpen = ref(false)

// Demo model state
const demoModel = ref<EdmmDeploymentModel | null>(null)
const demoLoading = ref(false)

async function openDemoModel() {
  demoLoading.value = true
  try {
    const demoYaml = (await import('@/assets/edmm-models/otelshopAnsible_expected.yaml?raw')).default
    const result = parseAndValidateEdmm(demoYaml)
    if (result.success && result.data) {
      demoModel.value = result.data
      graphStore.setModel(result.data)
      viewMode.value = 'demo'
    }
  }
  finally {
    demoLoading.value = false
  }
}

// Computed
const hasActiveTransformation = computed(() => !!transformationStore.activeTransformationId)

// Methods
function openFilePicker() {
  localFileInputRef.value?.click()
  transformationStore.setActiveTransformation(null)
}

async function handleLocalFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  parseError.value = null
  localModel.value = null

  try {
    const contents = await file.text()
    const result = parseAndValidateEdmm(contents)

    if (result.success && result.data) {
      localModel.value = result.data
      graphStore.setModel(result.data)
      viewMode.value = 'local'
    }
    else {
      parseError.value = result.errors?.join('\n') ?? 'Model failed to validate'
      errorDialogOpen.value = true
    }
  }
  catch (error) {
    parseError.value = error instanceof Error ? error.message : String(error)
    errorDialogOpen.value = true
  }
  finally {
    // Reset file input so the same file can be selected again
    if (localFileInputRef.value) {
      localFileInputRef.value.value = ''
    }
  }
}

function selectTransformation(id: string) {
  transformationStore.setActiveTransformation(id)
  viewMode.value = 'transformation'
}

function handleTransformationComplete(payload: { id: string, name: string }) {
  transformationStore.addTransformation(payload.id, payload.name)
  selectTransformation(payload.id)
}

function closeGraph() {
  viewMode.value = 'welcome'
  transformationStore.setActiveTransformation(null)
  graphStore.clearModel()
}

onMounted(async () => {
  // Validate stored transformations on load
  transformationStore.validateTransformations()

  // Load test YAML in development mode
  if (import.meta.env.VITE_APP_USE_TEST_YAML) {
    try {
      const testYaml = (await import('@/assets/edmm-models/otelshopAnsible_expected.yaml?raw')).default
      const result = parseAndValidateEdmm(testYaml)
      if (result.success && result.data) {
        localModel.value = result.data
        graphStore.setModel(result.data)
        viewMode.value = 'local'
      }
      else {
        parseError.value = result.errors?.join('\n') ?? 'Test YAML failed to validate'
        errorDialogOpen.value = true
      }
    }
    catch (error) {
      parseError.value = error instanceof Error ? error.message : String(error)
      errorDialogOpen.value = true
    }
  }
})
</script>

<template>
  <div class="bg-background h-full w-full">
    <!-- Hidden file input for local file selection -->
    <input
      ref="localFileInputRef"
      type="file"
      accept=".yaml,.yml,.json"
      class="hidden"
      @change="handleLocalFileChange"
    >

    <!-- Local File Viewer -->
    <EdmmGraph v-if="viewMode === 'local' && localModel" :model="localModel" @close="closeGraph" />

    <!-- Transformation Viewer -->
    <EdmmModelLoader
      v-else-if="viewMode === 'transformation' && hasActiveTransformation"
      :transformation-id="transformationStore.activeTransformationId!"
      minimal
      class="h-full"
    >
      <template #default="{ model }">
        <EdmmGraph :model="model" @close="closeGraph" />
      </template>
    </EdmmModelLoader>

    <!-- Demo Model Viewer -->
    <EdmmGraph v-else-if="viewMode === 'demo' && demoModel" :model="demoModel" @close="closeGraph" />

    <!-- Welcome Screen -->
    <div v-else class="p-8 flex flex-col gap-8 h-full items-center justify-center">
      <div class="text-center max-w-md space-y-4">
        <div class="flex justify-center">
          <img src="@/assets/images/edmm.png" alt="EDMM Logo" class="size-20">
        </div>
        <h2 class="text-2xl text-foreground font-bold">
          EDMM Model Viewer
        </h2>
        <p class="text-muted-foreground">
          Transform and visualize deployment models using the Essential Deployment Metamodel. Get started by transforming a model or opening a local file.
        </p>
      </div>

      <div class="flex gap-4">
        <TransformDialog size="lg" @transformation-complete="handleTransformationComplete" />
        <Button size="lg" variant="outline" class="gap-2 cursor-default" @click="openFilePicker">
          <Upload class="h-5 w-5" />
          Open Local File
        </Button>
      </div>

      <!-- Recent Transformations -->
      <div v-if="transformationStore.hasTransformations" class="max-w-md w-full">
        <h3 class="text-sm text-muted-foreground font-medium mb-3 text-center">
          Recent Transformations
        </h3>
        <div class="border rounded-lg bg-card overflow-hidden divide-border divide-y">
          <div
            v-for="transformation in transformationStore.transformations"
            :key="transformation.id"
            class="group px-4 py-3 flex gap-3 cursor-pointer transition-colors items-center hover:bg-accent/50"
            @click="selectTransformation(transformation.id)"
          >
            <FileText class="text-muted-foreground shrink-0 size-4" />
            <span class="text-sm text-foreground flex-1 truncate">{{ transformation.name }}</span>
            <button
              class="text-muted-foreground p-1 rounded opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              title="Remove from list"
              @click.stop="transformationStore.removeTransformation(transformation.id)"
            >
              <i class="i-lucide-x size-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Demo Model Link -->
      <Button variant="link" :disabled="demoLoading" @click="openDemoModel">
        {{ demoLoading ? 'Loading...' : 'Try Demo Model' }}
      </Button>
    </div>

    <!-- Parse Error Dialog -->
    <Dialog v-model:open="errorDialogOpen">
      <DialogContent class="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle class="flex gap-2 items-center">
            <AlertCircle class="text-destructive h-5 w-5" />
            Failed to Parse Model
          </DialogTitle>
          <DialogDescription>
            There was an error parsing the EDMM model file. Please check the file format and try again.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4">
          <div class="p-4 rounded-lg bg-destructive/10 max-h-64 overflow-auto">
            <pre class="text-sm text-destructive whitespace-pre-wrap break-words">{{ parseError }}</pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="errorDialogOpen = false">
            Close
          </Button>
          <Button @click="errorDialogOpen = false; openFilePicker()">
            Try Another File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
