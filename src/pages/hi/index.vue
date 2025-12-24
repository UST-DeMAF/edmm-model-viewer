<script setup lang="ts">
import { ChevronLeft, ChevronRight, FileText, Moon, Plus, Sun, Upload, X } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import EdmmGraph from '~/components/EdmmGraph.vue'
import EdmmModelLoader from '~/components/EdmmModelLoader.vue'
import TransformPanel from '~/components/TransformPanel.vue'
import { useTransformationStore } from '~/stores/transformations'

const transformationStore = useTransformationStore()

// UI State
const showTransformPanel = ref(false)
const sidebarCollapsed = ref(false)

type ViewMode = 'upload' | 'file' | 'transformation'
const viewMode = ref<ViewMode>('upload')

// Computed
const hasActiveTransformation = computed(() => !!transformationStore.activeTransformationId)

// Methods
function openTransformPanel() {
  showTransformPanel.value = true
  viewMode.value = 'upload'
  transformationStore.setActiveTransformation(null)
}

function openFilePicker() {
  viewMode.value = 'file'
  showTransformPanel.value = false
  transformationStore.setActiveTransformation(null)
}

function selectTransformation(id: string) {
  transformationStore.setActiveTransformation(id)
  viewMode.value = 'transformation'
  showTransformPanel.value = false
}

function handleTransformationComplete(payload: { id: string, name: string }) {
  transformationStore.addTransformation(payload.id, payload.name)
  selectTransformation(payload.id)
  showTransformPanel.value = false
}

function removeTransformation(id: string) {
  transformationStore.removeTransformation(id)
  if (transformationStore.transformations.length > 0) {
    selectTransformation(transformationStore.transformations[0].id)
  }
  else {
    viewMode.value = 'upload'
  }
}

onMounted(() => {
  // Validate stored transformations on load
  transformationStore.validateTransformations()
})
</script>

<template>
  <div class="bg-background flex h-full">
    <!-- Sidebar -->
    <aside
      class="border-r border-border bg-sidebar flex flex-col transition-all duration-300"
      :class="sidebarCollapsed ? 'w-12' : 'w-64'"
    >
      <!-- Sidebar Header -->
      <div class="p-3 border-b border-sidebar-border flex items-center justify-between">
        <span v-if="!sidebarCollapsed" class="text-sidebar-foreground font-semibold">
          Models
        </span>
        <button
          class="p-1 rounded transition-colors hover:bg-sidebar-accent"
          :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <ChevronLeft v-if="!sidebarCollapsed" class="text-sidebar-foreground h-4 w-4" />
          <ChevronRight v-else class="text-sidebar-foreground h-4 w-4" />
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="p-2 border-b border-sidebar-border space-y-1">
        <button
          class="text-sm px-3 py-2 rounded-md flex gap-2 w-full transition-colors items-center hover:bg-sidebar-accent"
          :class="showTransformPanel ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground'"
          :title="sidebarCollapsed ? 'Transform Model' : undefined" @click="openTransformPanel"
        >
          <Plus class="flex-shrink-0 h-4 w-4" />
          <span v-if="!sidebarCollapsed">Transform Model</span>
        </button>
        <button
          class="text-sm px-3 py-2 rounded-md flex gap-2 w-full transition-colors items-center hover:bg-sidebar-accent"
          :class="viewMode === 'file' && !hasActiveTransformation ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground'"
          :title="sidebarCollapsed ? 'Open Local File' : undefined" @click="openFilePicker"
        >
          <Upload class="flex-shrink-0 h-4 w-4" />
          <span v-if="!sidebarCollapsed">Open Local File</span>
        </button>
      </div>

      <!-- Transformations List -->
      <div class="p-2 flex-1 overflow-auto">
        <p
          v-if="!sidebarCollapsed && transformationStore.transformations.length === 0"
          class="text-xs text-muted-foreground px-3 py-2"
        >
          No transformations yet
        </p>
        <div class="space-y-1">
          <div
            v-for="transformation in transformationStore.transformations" :key="transformation.id"
            class="group px-3 py-2 rounded-md flex gap-2 cursor-pointer transition-colors items-center hover:bg-sidebar-accent"
            :class="transformationStore.activeTransformationId === transformation.id ? 'bg-sidebar-accent' : ''"
            :title="sidebarCollapsed ? transformation.name : undefined"
            @click="selectTransformation(transformation.id)"
          >
            <FileText class="text-sidebar-foreground flex-shrink-0 h-4 w-4" />
            <span v-if="!sidebarCollapsed" class="text-sm text-sidebar-foreground flex-1 truncate">
              {{ transformation.name }}
            </span>
            <button
              v-if="!sidebarCollapsed"
              class="p-1 rounded opacity-0 transition-all hover:bg-destructive/20 group-hover:opacity-100"
              title="Remove" @click.stop="removeTransformation(transformation.id)"
            >
              <X class="text-destructive h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Footer with theme toggle -->
      <div class="p-2 border-t border-sidebar-border">
        <button
          class="text-sidebar-foreground px-3 py-2 rounded-md flex gap-2 w-full transition-colors items-center justify-center hover:bg-sidebar-accent"
          :title="sidebarCollapsed ? 'Toggle theme' : undefined" @click="toggleDark()"
        >
          <Sun v-if="isDark" class="h-4 w-4" />
          <Moon v-else class="h-4 w-4" />
          <span v-if="!sidebarCollapsed" class="text-sm">
            {{ isDark ? 'Light Mode' : 'Dark Mode' }}
          </span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-hidden">
      <!-- Transform Panel -->
      <div v-if="showTransformPanel" class="pt-12 flex h-full items-start justify-center overflow-auto">
        <TransformPanel @transformation-complete="handleTransformationComplete" />
      </div>

      <!-- Local File Viewer -->
      <EdmmModelLoader v-else-if="viewMode === 'file' && !hasActiveTransformation">
        <template #default="{ model }">
          <EdmmGraph :model="model" />
        </template>
      </EdmmModelLoader>

      <!-- Transformation Viewer -->
      <EdmmModelLoader
        v-else-if="viewMode === 'transformation' && hasActiveTransformation"
        :transformation-id="transformationStore.activeTransformationId!" minimal
      >
        <template #default="{ model }">
          <EdmmGraph :model="model" />
        </template>
      </EdmmModelLoader>

      <!-- Welcome Screen -->
      <div v-else class="p-8 flex flex-col gap-6 h-full items-center justify-center">
        <div class="text-center max-w-md">
          <h1 class="text-3xl text-foreground font-bold mb-3">
            EDMM Model Viewer
          </h1>
          <p class="text-muted-foreground">
            Transform and visualize deployment models using the Essential Deployment Metamodel (EDMM).
          </p>
        </div>

        <div class="flex gap-4">
          <button
            class="text-primary-foreground font-medium px-6 py-3 rounded-lg bg-primary flex gap-2 transition-opacity items-center hover:opacity-90"
            @click="openTransformPanel"
          >
            <Plus class="h-5 w-5" />
            Transform Model
          </button>
          <button
            class="text-secondary-foreground font-medium px-6 py-3 rounded-lg bg-secondary flex gap-2 transition-colors items-center hover:bg-secondary/80"
            @click="openFilePicker"
          >
            <Upload class="h-5 w-5" />
            Open Local File
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
