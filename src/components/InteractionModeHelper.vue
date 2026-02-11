<script setup lang="ts">
import { useGraphSettingsStore } from '~/stores/graph-settings'

const settingsStore = useGraphSettingsStore()

// Build a label for the current range setting
const rangeLabel = computed(() => {
  const range = settingsStore.highlightRange
  if (range === null)
    return 'all'
  if (range === 1)
    return 'direct'
  return `within ${range} steps`
})

// Map interaction modes to their helper messages (dynamic based on range)
const helperMessages = computed<Record<string, string>>(() => ({
  SHORTEST_PATH: 'Click on a node to select it, then hover over another node to show the shortest path between them',
  HIGHLIGHT_PREDECESSORS: `Hover over a node to highlight ${rangeLabel.value} predecessors`,
  HIGHLIGHT_SUCCESSORS: `Hover over a node to highlight ${rangeLabel.value} successors`,
  HIGHLIGHT_NEIGHBOURS: `Hover over a node to highlight ${rangeLabel.value} neighbours`,
}))

// Computed property that returns the message for the current interaction mode
const currentHelperMessage = computed(() => {
  return helperMessages.value[settingsStore.interactionMode] ?? null
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="currentHelperMessage"
      :key="settingsStore.interactionMode"
      class="text-sm text-foreground flex w-full top-3 justify-center absolute z-1"
    >
      <div class="p-2 text-center border rounded-lg bg-background/90 max-w-[300px] backdrop-blur">
        {{ currentHelperMessage }}
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active {
  animation: pop-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.fade-leave-active {
  animation: pop-out 0.2s ease-out forwards;
}

@keyframes pop-bounce {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.6);
  }
  50% {
    opacity: 1;
    transform: translateY(0) scale(1.15);
  }
  70% {
    transform: translateY(0) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pop-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-10px) scale(0.9);
  }
}
</style>
