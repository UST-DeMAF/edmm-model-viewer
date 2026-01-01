<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'
import { nextTick, onMounted, ref } from 'vue'
import { Button } from './ui/button'
import { Input } from './ui/input'

const emit = defineEmits<{
  close: []
}>()

const model = defineModel<string>({ default: '' })

const inputRef = ref<InstanceType<typeof Input> | null>(null)

onMounted(async () => {
  await nextTick()
  // Focus the input element when the component mounts
  const inputEl = inputRef.value?.$el?.querySelector('input') || inputRef.value?.$el
  inputEl?.focus()
})

function handleClose() {
  model.value = ''
  emit('close')
}

onKeyStroke('Escape', handleClose)
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
          v-model="model"
          placeholder="Search nodes..."
          class="pl-9 w-72"
        />
      </div>
      <Button variant="ghost" size="icon" class="shrink-0" @click="handleClose">
        <i class="i-lucide-x size-4" />
      </Button>
    </div>
  </div>
</template>
