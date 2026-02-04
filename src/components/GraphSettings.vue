<script setup lang="ts">
import type { ComponentTypeDefinition } from '~/lib/type-hierarchy'
import { onKeyStroke } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { isDark, toggleDark } from '~/composables/dark'
import { useInteractionModeKeybinds } from '~/composables/useInteractionModeKeybinds'
import { useGraphStore } from '~/stores/graph'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import GraphSearch from './GraphSearch.vue'
import NodeTypeFilter from './NodeTypeFilter.vue'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Kbd } from './ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const props = defineProps<{
  componentTypes?: Record<string, ComponentTypeDefinition>
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useGraphSettingsStore()
const graphStore = useGraphStore()

// Register interaction mode keyboard shortcuts
useInteractionModeKeybinds()

const { layoutDirection, layoutAlgorithm, interactionMode, isSearchOpen, scaleWithDependencies, typeDifferentiationMode, isSidebarExpanded: isExpanded } = storeToRefs(store)
const { visibleNodeTypes } = storeToRefs(graphStore)

function openSearch() {
  isSearchOpen.value = true
}

function closeSearch() {
  isSearchOpen.value = false
}

// Listen for Ctrl+F to open search, preventing default browser find
onKeyStroke('f', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    openSearch()
  }
})

const altKeyState = useKeyModifier('Alt')

const showTooltips = computed(() => {
  return altKeyState.value ?? false
})

// Prevent default behavior of Alt key (focuses the settings button)
onKeyStroke('Alt', (e) => {
  e.preventDefault()
})
</script>

<template>
  <div class="py-3 border-e bg-sidebar flex flex-col gap-3 h-full items-start justify-start relative transition-all duration-300 ease-in-out" :class="isExpanded ? 'w-50' : 'w-14'">
    <Button @click="isExpanded = !isExpanded" class="absolute top-3 right-0 size-9 bg-sidebar border border-s-0 translate-x-[100%] rounded-s-none z-2 text-foreground p-0 hover:bg-sidebar-accent">
      <i :class="isExpanded ? 'i-tabler:layout-sidebar-left-collapse' : 'i-tabler:layout-sidebar-left-expand'" class="size-5" />
    </Button>
    <div class="flex items-center">
      <img src="@/assets/images/edmm.png" alt="Logo" class="size-8 mx-3">
    </div>
    <div class="flex flex-col gap-1 w-full items-start px-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <div class="w-full">
            <Tooltip :open="showTooltips && !isExpanded">
              <TooltipTrigger as-child>
                <Button variant="ghost" class="p-2 w-full justify-start gap-2">
                  <i class="i-lucide-layout-dashboard size-5 shrink-0" />
                  <span v-if="isExpanded" class="truncate">Layout</span>
                  <i v-if="isExpanded" class="i-lucide-chevron-right size-4 shrink-0 ml-auto opacity-60" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Layout
              </TooltipContent>
            </Tooltip>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuLabel>Layout Direction</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="layoutDirection">
            <DropdownMenuRadioItem value="horizontal" @select.prevent>
              Horizontal
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="vertical" @select.prevent>
              Vertical
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Layout Algorithm</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="layoutAlgorithm">
            <DropdownMenuRadioItem value="default" @select.prevent>
              Default
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="layered" @select.prevent>
              Layered
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="force" @select.prevent>
              Force
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mrtree" @select.prevent>
              Tree
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            v-model="scaleWithDependencies"
            @select.prevent
          >
            <span class="inline-flex gap-2 items-center">
              <i class="i-lucide-scaling size-3.5" />
              Scale with Dependencies
            </span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Type Differentiation</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="typeDifferentiationMode">
            <DropdownMenuRadioItem value="DISABLED" @select.prevent>
              Disabled
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="COLOR" @select.prevent>
              <span class="inline-flex gap-2 items-center">
                Color
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="SHAPE" :disabled="!graphStore.isShapeModeAvailable" @select.prevent>
              <span class="inline-flex gap-2 items-center">
                Shape
                <span v-if="!graphStore.isShapeModeAvailable" class="text-xs text-muted-foreground">
                  (max 4 types)
                </span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <div class="w-full">
            <Tooltip :open="showTooltips && !isExpanded">
              <TooltipTrigger as-child>
                <Button variant="ghost" class="p-2 w-full justify-start gap-2">
                  <i class="i-lucide-filter size-5 shrink-0" />
                  <span v-if="isExpanded" class="truncate">Filter</span>
                  <i v-if="isExpanded" class="i-lucide-chevron-right size-4 shrink-0 ml-auto opacity-60" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Filter
              </TooltipContent>
            </Tooltip>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <NodeTypeFilter
            v-model="visibleNodeTypes"
            :component-types="props.componentTypes"
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button variant="ghost" class="p-2 w-full justify-start gap-2" @click="openSearch">
            <i class="i-lucide-search size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Search</span>
              <div class="grow" />
              <Kbd>Ctrl + F</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" class="flex gap-2 items-center">
          <span>Search Nodes</span>
          <span class="flex gap-0.5 items-center">
            <Kbd>Ctrl</Kbd>
            <span>+</span>
            <Kbd>F</Kbd>
          </span>
        </TooltipContent>
      </Tooltip>
      <hr class="my-2">
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'NORMAL' ? 'default' : 'ghost'"
            class="p-2 w-full justify-start gap-2"
            @click="interactionMode = 'NORMAL'"
          >
            <i class="i-lucide-mouse-pointer-2 size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Normal</span>
              <div class="grow" />
              <Kbd>N</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Normal Mode
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'HIGHLIGHT_DIRECT_SUCCESSORS' ? 'default' : 'ghost'"
            class="p-2 w-full justify-start gap-2"
            @click="interactionMode = 'HIGHLIGHT_DIRECT_SUCCESSORS'"
          >
            <i class="i-lucide-arrow-right-to-line size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Successors</span>
              <div class="grow" />
              <Kbd>S</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Highlight Successors
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'HIGHLIGHT_DIRECT_PREDECESSORS' ? 'default' : 'ghost'"
            class="p-2 w-full justify-start gap-2"
            @click="interactionMode = 'HIGHLIGHT_DIRECT_PREDECESSORS'"
          >
            <i class="i-lucide-arrow-left-to-line size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Predecessors</span>
              <div class="grow" />
              <Kbd>P</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Highlight Predecessors
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'HIGHLIGHT_NEIGHBOURS' ? 'default' : 'ghost'"
            class="p-2 w-full justify-start gap-2"
            @click="interactionMode = 'HIGHLIGHT_NEIGHBOURS'"
          >
            <i class="i-lucide-git-branch size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Neighbours</span>
              <div class="grow" />
              <Kbd>B</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Highlight Neighbours
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'SHORTEST_PATH' ? 'default' : 'ghost'"
            class="p-2 w-full justify-start gap-2"
            @click="interactionMode = 'SHORTEST_PATH'"
          >
            <i class="i-lucide-route size-5 shrink-0" />
            <template v-if="isExpanded">
              <span class="truncate">Shortest Path</span>
              <div class="grow" />
              <Kbd>R</Kbd>
            </template>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Shortest Path Mode
        </TooltipContent>
      </Tooltip>
      <GraphSearch v-if="isSearchOpen" @close="closeSearch" />
    </div>
    <div class="grow" />
    <div class="flex flex-col gap-1 w-full items-start px-2.5">
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button variant="ghost" class="p-2 w-full justify-start gap-2" @click="emit('close')">
            <i class="i-solar-close-circle-linear size-5 shrink-0" />
            <span v-if="isExpanded" class="truncate">Close Graph</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Close Graph</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips && !isExpanded">
        <TooltipTrigger as-child>
          <Button variant="ghost" class="p-2 w-full justify-start gap-2" @click="toggleDark()">
            <i v-if="isDark" class="i-lucide-sun size-5 shrink-0" />
            <i v-else class="i-lucide-moon size-5 shrink-0" />
            <span v-if="isExpanded" class="truncate">{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{{ isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
