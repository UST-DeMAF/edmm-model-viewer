<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { TreeItem, TreeRoot } from 'reka-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'

const settingsStore = useGraphSettingsStore()
const graphStore = useGraphStore()

const { hiddenRelations } = storeToRefs(settingsStore)
const { relationTypes, relationTypesHierarchy } = storeToRefs(graphStore)

function isEdgeTypeVisible(edgeType: string): boolean {
  // Edge is visible if it's NOT in the hidden list
  return !hiddenRelations.value.includes(edgeType)
}

function toggleEdgeType(edgeType: string): void {
  if (isEdgeTypeVisible(edgeType)) {
    // Currently visible, add to hidden list
    hiddenRelations.value = [...hiddenRelations.value, edgeType]
  }
  else {
    // Currently hidden, remove from hidden list
    hiddenRelations.value = hiddenRelations.value.filter(r => r !== edgeType)
  }
}

function getIndentation(level: number, extra: number = 0): string {
  return `${(level - 1) * 1 + extra}rem`
}
</script>

<template>
  <TreeRoot
    v-slot="{ flattenItems }"
    class="text-sm list-none rounded-lg bg-background/90 select-none backdrop-blur"
    :items="relationTypesHierarchy"
    :get-key="(item) => item.name"
    disabled
    :expanded="relationTypes.map((rt) => rt.name)"
  >
  <p class="font-medium tracking-wide my-1 ms-2 opacity-60">Relation Visibility</p>
    <Tooltip v-for="(item) in flattenItems" :key="item._id" :delay-duration="700">
      <TooltipTrigger as-child>
        <TreeItem
          :style="{ 'padding-left': getIndentation(item.level, 0.6) }"
          v-bind="item.bind"
          class="pr-3 rounded-lg flex gap-2 h-8 cursor-pointer items-center relative hover:bg-foreground/5"
          @click.stop="toggleEdgeType(item.value.name)"
        >
          <div class="flex gap-2 items-center w-full" :class="{ 'opacity-40': !isEdgeTypeVisible(item.value.name) }">
            <!-- Color indicator -->
            <div
              class="rounded-full shrink-0 h-1 w-3 transition-opacity"
              :style="{ backgroundColor: item.value.color }"
            />

            <!-- Label -->
            <span class="transition-opacity">{{ item.value.label }}</span>

            <div class="grow" />

            <!-- Visibility icon -->
            <i
              class="text-muted-foreground ml-auto size-3.5"
              :class="isEdgeTypeVisible(item.value.name) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            />
          </div>
        </TreeItem>
      </TooltipTrigger>
      <TooltipContent v-if="item.value.description" side="left" class="max-w-xs">
        {{ item.value.description }}
      </TooltipContent>
    </Tooltip>
  </TreeRoot>
</template>
