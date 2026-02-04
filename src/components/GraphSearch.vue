<script setup lang="ts">
import { onKeyStroke, useDebounceFn, useEventBus } from '@vueuse/core'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import { Button } from './ui/button'
import { Input } from './ui/input'
import Kbd from './ui/kbd/Kbd.vue'

const emit = defineEmits<{
  close: []
}>()

// Stores
const graphStore = useGraphStore()
const settingsStore = useGraphSettingsStore()

// Event bus for focus events
const focusBus = useEventBus<string>('graph:focus-node')

// Local search input (bound to input field)
const localQuery = ref('')

// Current position in results (0-indexed internally)
const currentIndex = ref(0)

// Input ref for auto-focus
const inputRef = ref<InstanceType<typeof Input> | null>(null)

// Computed: matching node IDs based on search query
const matchingNodeIds = computed<string[]>(() => {
  const query = localQuery.value.trim().toLowerCase()
  if (!query || !graphStore.model?.components) {
    return []
  }

  // Search through component names (keys)
  return Object.keys(graphStore.model.components)
    .filter(nodeId => nodeId.toLowerCase().includes(query))
    .sort() // Consistent ordering
})

// Computed: total result count
const resultCount = computed(() => matchingNodeIds.value.length)

// Computed: display position (1-indexed for UI)
const displayPosition = computed(() => {
  if (resultCount.value === 0)
    return '0/0'
  return `${currentIndex.value + 1}/${resultCount.value}`
})

// Computed: current node ID
const currentNodeId = computed(() => {
  if (resultCount.value === 0)
    return null
  return matchingNodeIds.value[currentIndex.value]
})

// Emit focus event for current node
function emitFocus() {
  if (currentNodeId.value) {
    focusBus.emit(currentNodeId.value)
  }
}

// Update store and emit focus (debounced)
const debouncedSearchAndEmit = useDebounceFn(() => {
  // Update the store's search query for highlighting
  settingsStore.searchQuery = localQuery.value

  // Reset to first result when query changes
  currentIndex.value = 0

  // Auto-emit for first result
  emitFocus()
}, 300)

// Watch local query changes
watch(localQuery, () => {
  debouncedSearchAndEmit()
})

// Navigate to previous result (with wrap-around)
function goToPrevious() {
  if (resultCount.value === 0)
    return

  if (currentIndex.value === 0)
    currentIndex.value = resultCount.value - 1 // Wrap to last
  else
    currentIndex.value--

  emitFocus()
}

// Navigate to next result (with wrap-around)
function goToNext() {
  if (resultCount.value === 0)
    return

  if (currentIndex.value >= resultCount.value - 1)
    currentIndex.value = 0 // Wrap to first
  else
    currentIndex.value++

  emitFocus()
}

// Handle close
function handleClose() {
  localQuery.value = ''
  settingsStore.searchQuery = ''
  currentIndex.value = 0
  emit('close')
}

// Keyboard handlers
onKeyStroke('Escape', handleClose)

onKeyStroke('ArrowUp', (e) => {
  e.preventDefault()
  goToPrevious()
})

onKeyStroke('ArrowDown', (e) => {
  e.preventDefault()
  goToNext()
})

onKeyStroke('Enter', (e) => {
  e.preventDefault()
  emitFocus()
})

// Auto-focus input on mount
onMounted(async () => {
  await nextTick()
  const inputEl = inputRef.value?.$el?.querySelector('input') || inputRef.value?.$el
  inputEl?.focus()
})
</script>

<template>
  <div class="translate-x-[-50%] bottom-8 left-[50%] fixed z-50">
    <div class="p-2 border rounded-lg bg-popover flex gap-2 shadow-lg items-center">
      <div class="relative">
        <i
          class="i-lucide-search text-muted-foreground size-4 pointer-events-none translate-y-[-50%] left-3 top-[50%] absolute"
        />
        <Input
          ref="inputRef"
          v-model="localQuery"
          placeholder="Search nodes..."
          class="w-64 pl-9"
        />
      </div>

      <!--
      <span class="min-w-12 text-center text-sm text-muted-foreground tabular-nums">
        {{ displayPosition }}
      </span>

      <div class="flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          :disabled="resultCount === 0"
          @click="goToPrevious"
        >
          <i class="i-lucide-chevron-up size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          :disabled="resultCount === 0"
          @click="goToNext"
        >
          <i class="i-lucide-chevron-down size-4" />
        </Button>
      </div> -->

      <Button class="shrink-0 px-2" @click="handleClose">
        Close <Kbd class="text-foreground">ESC</Kbd>
      </Button>
    </div>
  </div>
</template>
