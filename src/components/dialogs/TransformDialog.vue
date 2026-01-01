<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, ChevronDown, FileText, Loader2, Plus, Upload, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'
import {
  checkTotalSize,
  generateSessionId,
  getRegisteredPlugins,
  handleMultipleFilesTransformation,
  handleSingleFileTransformation,
  moveToTADMS,
  startTransformationProcess,
} from '~/services/transformation-service'

// Props for different trigger button styles
const props = withDefaults(defineProps<{
  sidebarCollapsed?: boolean
  size?: 'default' | 'sm' | 'lg' | 'icon'
}>(), {
  sidebarCollapsed: undefined,
  size: 'default',
})

const emit = defineEmits<{
  (e: 'transformationComplete', payload: { id: string, name: string }): void
}>()

const { sidebarCollapsed, size } = toRefs(props)

// Dialog state
const isOpen = ref(false)

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

function resetForm() {
  clearSelection()
  selectedTechnology.value = null
  commands.value = ''
  options.value = ''
  error.value = null
  success.value = null
  sessionId.value = generateSessionId()
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

      // Close dialog after successful transformation
      setTimeout(() => {
        isOpen.value = false
        resetForm()
      }, 1500)
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

// Watch for dialog close to reset state
watch(isOpen, (open) => {
  if (!open && !isTransforming.value) {
    // Optionally reset form when dialog is closed
    // resetForm()
  }
})

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
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <!-- Sidebar trigger button -->
      <button
        v-if="sidebarCollapsed !== undefined"
        class="text-sm text-sidebar-foreground px-3 py-2 rounded-md flex gap-2 w-full transition-colors items-center hover:bg-sidebar-accent"
        :title="sidebarCollapsed ? 'Transform Model' : undefined"
      >
        <Plus class="flex-shrink-0 h-4 w-4" />
        <span v-if="!sidebarCollapsed">Transform Model</span>
      </button>
      <!-- Default button (welcome screen) -->
      <Button v-else :size="size" class="gap-2 cursor-default">
        <Plus class="h-5 w-5" />
        Transform Model
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Deployment Model Transformation</DialogTitle>
        <DialogDescription>
          Upload a deployment model file to transform it to EDMM format.
        </DialogDescription>
      </DialogHeader>

      <div class="py-4 gap-4 grid">
        <!-- File/Folder Selection -->
        <div class="space-y-3">
          <!-- Current Selection Display -->
          <div v-if="fileName || folderName" class="p-3 rounded-lg bg-secondary/50 flex gap-3 items-center">
            <FileText class="text-primary shrink-0 h-5 w-5" />
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
            <Button variant="secondary" class="flex-1" @click="selectFile">
              <Upload class="h-4 w-4" />
              Select File
            </Button>
          </div>

          <!-- Hidden Inputs -->
          <input
            ref="fileInputRef" type="file" class="hidden" accept=".yaml,.yml,.json,.tf,.hcl"
            @change="handleFileUpload"
          >
          <input
            ref="folderInputRef" type="file" class="hidden" multiple webkitdirectory
            @change="handleFolderUpload"
          >

          <!-- Start File Path (for folders) -->
          <div v-if="showFolderInput && folderName" class="space-y-2">
            <Label for="start-file">Start File (optional)</Label>
            <div class="flex gap-2 items-center">
              <span class="text-sm text-muted-foreground">{{ folderName }}/</span>
              <Input
                id="start-file" v-model="startFilePath" type="text" placeholder="main.tf"
                class="flex-1"
              />
            </div>
            <p class="text-xs text-muted-foreground">
              Leave blank or use * to process all files
            </p>
          </div>
        </div>

        <!-- Technology Selection -->
        <div class="gap-2 grid">
          <Label for="technology">Technology</Label>
          <div class="relative">
            <button
              id="technology"
              class="focus:outline-none text-sm px-3 py-2 border border-input rounded-md bg-background flex h-9 w-full items-center justify-between focus:ring-2 focus:ring-ring"
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
              class="mt-1 border border-border rounded-md bg-popover max-h-48 w-full shadow-lg absolute z-50 overflow-auto"
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
        <div class="gap-2 grid">
          <Label for="commands">
            Commands <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="commands" v-model="commands" type="text" placeholder="e.g., apply, plan" />
        </div>

        <!-- Options (optional) -->
        <div class="gap-2 grid">
          <Label for="options">
            Options <span class="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input id="options" v-model="options" type="text" placeholder="e.g., width=1920, height=1080" />
          <p class="text-xs text-muted-foreground">
            Comma-separated options: width, height, dpi, flatten
          </p>
        </div>

        <!-- Status -->
        <div
          v-if="isTransforming || error || success" class="p-3 rounded-lg flex gap-3 items-center" :class="{
            'bg-secondary': !error && !success,
            'bg-destructive/10': error,
            'bg-green-500/10': success,
          }"
        >
          <component
            :is="statusIcon" class="shrink-0 h-5 w-5"
            :class="[statusColor, { 'animate-spin': isTransforming }]"
          />
          <span class="text-sm" :class="statusColor">{{ statusMessage }}</span>
        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline" :disabled="isTransforming">
            Cancel
          </Button>
        </DialogClose>
        <Button :disabled="!canTransform" @click="startTransformation">
          <Loader2 v-if="isTransforming" class="h-4 w-4 animate-spin" />
          {{ isTransforming ? 'Transforming...' : 'Transform' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
