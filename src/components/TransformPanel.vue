<script setup lang="ts">
import { AlertCircle, CheckCircle2, ChevronDown, FileText, FolderOpen, Loader2, Upload, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  checkTotalSize,
  generateSessionId,
  getRegisteredPlugins,
  handleMultipleFilesTransformation,
  handleSingleFileTransformation,
  moveToTADMS,
  startTransformationProcess,
} from '~/services/transformationService'

const emit = defineEmits<{
  (e: 'transformationComplete', payload: { id: string, name: string }): void
}>()

// State
const sessionId = ref(generateSessionId())
const uploadedFiles = ref<File[]>([])
const fileName = ref('')
const folderName = ref('')
const startFilePath = ref('')
const selectedTechnology = ref<string | null>(null)
const technologies = ref<string[]>([])
const commands = ref('')
const options = ref('')
const isTransforming = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const showFileInput = ref(false)
const showFolderInput = ref(false)
const technologyDropdownOpen = ref(false)

// Refs for hidden inputs
const fileInputRef = ref<HTMLInputElement | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)

// Polling interval
let pluginsInterval: number | null = null

// Computed
const canTransform = computed(() => {
  return uploadedFiles.value.length > 0 && selectedTechnology.value && !isTransforming.value
})

const statusIcon = computed(() => {
  if (isTransforming.value)
    return Loader2
  if (error.value)
    return AlertCircle
  if (success.value)
    return CheckCircle2
  return Upload
})

const statusColor = computed(() => {
  if (error.value)
    return 'text-destructive'
  if (success.value)
    return 'text-green-500'
  return 'text-muted-foreground'
})

const statusMessage = computed(() => {
  if (isTransforming.value)
    return 'Transformation in progress...'
  if (error.value)
    return error.value
  if (success.value)
    return success.value
  return 'Upload a file or folder to start'
})

// Methods
function selectFile() {
  fileInputRef.value?.click()
  showFileInput.value = true
  showFolderInput.value = false
}

function selectFolder() {
  folderInputRef.value?.click()
  showFileInput.value = false
  showFolderInput.value = true
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])

  if (!checkTotalSize(files)) {
    error.value = 'Total file size exceeds 50 MB. Please upload a smaller file.'
    return
  }

  uploadedFiles.value = files
  fileName.value = files[0]?.name || ''
  folderName.value = ''
  error.value = null
}

function handleFolderUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])

  if (!checkTotalSize(files)) {
    error.value = 'Total file size exceeds 50 MB. Please upload smaller files.'
    return
  }

  uploadedFiles.value = files
  if (files.length > 0) {
    folderName.value = files[0].webkitRelativePath.split('/')[0]
    fileName.value = ''
  }
  error.value = null
}

function clearSelection() {
  uploadedFiles.value = []
  fileName.value = ''
  folderName.value = ''
  showFileInput.value = false
  showFolderInput.value = false
  if (fileInputRef.value)
    fileInputRef.value.value = ''
  if (folderInputRef.value)
    folderInputRef.value.value = ''
}

function selectTechnology(tech: string) {
  selectedTechnology.value = tech
  technologyDropdownOpen.value = false
}

async function loadPlugins() {
  try {
    technologies.value = await getRegisteredPlugins()
  }
  catch (err) {
    console.error('Failed to load plugins:', err)
  }
}

async function startTransformation() {
  if (!canTransform.value)
    return

  isTransforming.value = true
  error.value = null
  success.value = null

  try {
    let transformationProcessName: string | undefined
    let tsdm

    const optionsArray = options.value
      ? options.value.split(',').map(opt => opt.trim())
      : []

    const technology = selectedTechnology.value === 'TADM'
      ? 'visualization-service'
      : selectedTechnology.value!

    if (uploadedFiles.value.length === 1) {
      const result = await handleSingleFileTransformation(
        uploadedFiles.value[0],
        sessionId.value,
        technology,
        commands.value,
        optionsArray,
      )
      transformationProcessName = result.transformationProcessName
      tsdm = result.tsdm
    }
    else {
      const result = await handleMultipleFilesTransformation(
        uploadedFiles.value,
        sessionId.value,
        technology,
        commands.value,
        optionsArray,
        startFilePath.value,
      )
      transformationProcessName = result.transformationProcessName
      tsdm = result.tsdm
    }

    const { transformationProcessId, statusMessage } = await startTransformationProcess(tsdm)

    if (statusMessage) {
      success.value = `Transformation complete: ${transformationProcessName}`

      // Move to TADMS if using visualization-service directly
      if (technology === 'visualization-service' && uploadedFiles.value.length === 1) {
        await moveToTADMS(uploadedFiles.value[0].name, sessionId.value, transformationProcessId)
      }

      emit('transformationComplete', {
        id: transformationProcessId,
        name: transformationProcessName || 'Untitled',
      })
    }
    else {
      error.value = 'Transformation failed - no result received'
    }
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : 'Transformation failed'
  }
  finally {
    isTransforming.value = false
  }
}

onMounted(() => {
  loadPlugins()
  pluginsInterval = window.setInterval(loadPlugins, 30000)
})

onUnmounted(() => {
  if (pluginsInterval) {
    clearInterval(pluginsInterval)
  }
})
</script>

<template>
  <div class="mx-auto p-6 max-w-xl w-full">
    <div class="p-6 border border-border rounded-xl bg-card shadow-lg space-y-6">
      <!-- Header -->
      <div class="pb-4 text-center border-b border-border">
        <h2 class="text-xl text-foreground font-semibold">
          Deployment Model Transformation
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Upload a deployment model file to transform it to EDMM
        </p>
      </div>

      <!-- File/Folder Selection -->
      <div class="space-y-4">
        <!-- Current Selection Display -->
        <div v-if="fileName || folderName" class="p-3 rounded-lg bg-secondary/50 flex gap-3 items-center">
          <FileText class="text-primary h-5 w-5" />
          <span class="text-sm flex-1 truncate">
            {{ fileName || folderName }}
            <span v-if="folderName" class="text-muted-foreground">
              ({{ uploadedFiles.length }} files)
            </span>
          </span>
          <button
            class="p-1 rounded transition-colors hover:bg-destructive/20" title="Clear selection"
            @click="clearSelection"
          >
            <X class="text-destructive h-4 w-4" />
          </button>
        </div>

        <!-- Upload Buttons -->
        <div class="flex gap-3">
          <button
            class="text-secondary-foreground px-4 py-3 rounded-lg bg-secondary flex flex-1 gap-2 transition-colors items-center justify-center hover:bg-secondary/80"
            @click="selectFile"
          >
            <Upload class="h-4 w-4" />
            Select File
          </button>
          <button
            class="text-secondary-foreground px-4 py-3 rounded-lg bg-secondary flex flex-1 gap-2 transition-colors items-center justify-center hover:bg-secondary/80"
            @click="selectFolder"
          >
            <FolderOpen class="h-4 w-4" />
            Select Folder
          </button>
        </div>

        <!-- Hidden Inputs -->
        <input
          ref="fileInputRef" type="file" class="hidden" accept=".yaml,.yml,.json,.tf,.hcl"
          @change="handleFileUpload"
        >
        <input
          ref="folderInputRef" type="file" class="hidden" webkitdirectory multiple
          @change="handleFolderUpload"
        >

        <!-- Start File Path (for folders) -->
        <div v-if="showFolderInput && folderName" class="space-y-2">
          <label class="text-sm text-foreground font-medium">
            Start File (optional)
          </label>
          <div class="flex gap-2 items-center">
            <span class="text-sm text-muted-foreground">{{ folderName }}/</span>
            <input
              v-model="startFilePath" type="text" placeholder="main.tf"
              class="focus:outline-none text-sm px-3 py-2 border border-input rounded-md bg-background flex-1 focus:ring-2 focus:ring-ring"
            >
          </div>
          <p class="text-xs text-muted-foreground">
            Leave blank or use * to process all files
          </p>
        </div>
      </div>

      <!-- Technology Selection -->
      <div class="space-y-2">
        <label class="text-sm text-foreground font-medium">
          Technology
        </label>
        <div class="relative">
          <button
            class="focus:outline-none text-sm px-3 py-2 border border-input rounded-md bg-background flex w-full items-center justify-between focus:ring-2 focus:ring-ring"
            @click="technologyDropdownOpen = !technologyDropdownOpen"
          >
            <span :class="selectedTechnology ? 'text-foreground' : 'text-muted-foreground'">
              {{ selectedTechnology || 'Select technology...' }}
            </span>
            <ChevronDown
              class="text-muted-foreground h-4 w-4 transition-transform"
              :class="{ 'rotate-180': technologyDropdownOpen }"
            />
          </button>

          <div
            v-if="technologyDropdownOpen"
            class="mt-1 border border-border rounded-md bg-popover max-h-48 w-full shadow-lg absolute z-10 overflow-auto"
          >
            <button
              v-for="tech in technologies" :key="tech"
              class="text-sm px-3 py-2 text-left w-full transition-colors hover:text-accent-foreground hover:bg-accent"
              @click="selectTechnology(tech)"
            >
              {{ tech }}
            </button>
            <p v-if="technologies.length === 0" class="text-sm text-muted-foreground px-3 py-2">
              Loading plugins...
            </p>
          </div>
        </div>
      </div>

      <!-- Commands (optional) -->
      <div class="space-y-2">
        <label class="text-sm text-foreground font-medium">
          Commands <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          v-model="commands" type="text" placeholder="e.g., apply, plan"
          class="focus:outline-none text-sm px-3 py-2 border border-input rounded-md bg-background w-full focus:ring-2 focus:ring-ring"
        >
      </div>

      <!-- Options (optional) -->
      <div class="space-y-2">
        <label class="text-sm text-foreground font-medium">
          Options <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          v-model="options" type="text" placeholder="e.g., width=1920, height=1080"
          class="focus:outline-none text-sm px-3 py-2 border border-input rounded-md bg-background w-full focus:ring-2 focus:ring-ring"
        >
        <p class="text-xs text-muted-foreground">
          Comma-separated options: width, height, dpi, flatten
        </p>
      </div>

      <!-- Transform Button -->
      <button
        :disabled="!canTransform"
        class="text-primary-foreground font-medium px-4 py-3 rounded-lg bg-primary flex gap-2 w-full transition-all items-center justify-center disabled:opacity-50 hover:opacity-90 disabled:cursor-not-allowed"
        @click="startTransformation"
      >
        <Loader2 v-if="isTransforming" class="h-4 w-4 animate-spin" />
        <span>{{ isTransforming ? 'Transforming...' : 'Transform' }}</span>
      </button>

      <!-- Status -->
      <div
        v-if="isTransforming || error || success" class="p-3 rounded-lg flex gap-3 items-center" :class="{
          'bg-secondary': !error && !success,
          'bg-destructive/10': error,
          'bg-green-500/10': success,
        }"
      >
        <component
          :is="statusIcon" class="h-5 w-5"
          :class="[statusColor, { 'animate-spin': isTransforming }]"
        />
        <span class="text-sm" :class="statusColor">{{ statusMessage }}</span>
      </div>
    </div>
  </div>
</template>
