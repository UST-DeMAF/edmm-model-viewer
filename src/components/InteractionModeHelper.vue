<script setup lang="ts">
import { useGraphSettingsStore } from '~/stores/graph-settings'

const settingsStore = useGraphSettingsStore()

// Map interaction modes to their helper messages
const helperMessages: Record<string, string> = {
  SHORTEST_PATH: 'Click on a node to select it, then hover over another node to show the shortest path between them',
  HIGHLIGHT_DIRECT_PREDECESSORS: 'Hover over a node to highlight its direct predecessors',
  HIGHLIGHT_DIRECT_SUCCESSORS: 'Hover over a node to highlight its direct successors',
  HIGHLIGHT_NEIGHBOURS: 'Hover over a node to highlight its direct neighbours',
}

// Computed property that returns the message for the current interaction mode
const currentHelperMessage = computed(() => {
  return helperMessages[settingsStore.interactionMode] ?? null
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="currentHelperMessage"
      :key="settingsStore.interactionMode"
      class="absolute top-3 z-1 flex w-full justify-center text-sm text-foreground"
    >
      <div class="text-center max-w-[300px] bg-background/90  backdrop-blur border rounded-lg p-2">
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
