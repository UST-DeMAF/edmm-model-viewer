<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import { Button } from './ui/button'
import { Input } from './ui/input'
import Kbd from './ui/kbd/Kbd.vue'

const emit = defineEmits<{
  close: []
}>()

// Store
const settingsStore = useGraphSettingsStore()

// Input ref for auto-focus
const inputRef = ref<InstanceType<typeof Input> | null>(null)

// Handle close
function handleClose() {
  settingsStore.searchQuery = ''
  emit('close')
}

// Keyboard handler for escape
onKeyStroke('Escape', handleClose)

// Keyboard handler for refocusing the input
onKeyStroke('f', (e) => {
  const inputEl = inputRef.value?.$el?.querySelector('input') || inputRef.value?.$el
  if (inputEl && document.activeElement !== inputEl) {
    e.preventDefault()
    inputEl.focus()
  }
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
    <div class="p-2 border rounded-lg bg-popover flex gap-2 shadow-foreground/20 shadow-md items-center">
      <div class="relative">
        <i
          class="i-lucide-search text-muted-foreground size-4 pointer-events-none translate-y-[-50%] left-3 top-[50%] absolute"
        />
        <Input
          ref="inputRef"
          v-model="settingsStore.searchQuery"
          placeholder="Search nodes..."
          class="pl-9 w-64"
        />
      </div>

      <Button class="px-2 shrink-0" @click="handleClose">
        Close <Kbd class="text-foreground">ESC</Kbd>
      </Button>
    </div>
  </div>
</template>
