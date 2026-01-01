<script setup lang="ts">
import type { ComponentTypeDefinition } from '~/lib/type-hierarchy'
import { onKeyStroke } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { isDark, toggleDark } from '~/composables/dark'
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

const { layoutRelations, searchQuery, layoutDirection, interactionMode, visibleNodeTypes, isSearchOpen, scaleWithDependencies } = storeToRefs(store)

function openSearch() {
  isSearchOpen.value = true
}

function closeSearch() {
  isSearchOpen.value = false
  searchQuery.value = ''
}

// Listen for Ctrl+F to open search, preventing default browser find
onKeyStroke('f', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    openSearch()
  }
})

function isLayoutRelationEnabled(relation: string): boolean {
  return layoutRelations.value.includes(relation as typeof layoutRelations.value[number])
}

function toggleLayoutRelation(relation: string): void {
  const typedRelation = relation as typeof layoutRelations.value[number]
  if (isLayoutRelationEnabled(relation)) {
    layoutRelations.value = layoutRelations.value.filter(r => r !== typedRelation)
  }
  else {
    layoutRelations.value = [...layoutRelations.value, typedRelation]
  }
}

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
  <div class="py-3 border-e bg-sidebar flex flex-col gap-3 h-full w-14 items-center justify-start">
    <div class="flex items-center">
      <img src="@/assets/images/edmm.png" alt="Logo" class="size-8">
    </div>
    <div class="flex flex-col gap-1 w-full items-center">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <div>
            <Tooltip :open="showTooltips">
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon">
                  <i class="i-lucide-layout-dashboard size-5" />
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
          <DropdownMenuLabel>Layout Relations</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            :model-value="isLayoutRelationEnabled('HostedOn')"
            @update:model-value="toggleLayoutRelation('HostedOn')"
            @select.prevent
          >
            <span class="inline-flex gap-2 items-center">
              <span class="rounded-full bg-[var(--chart-1)] size-2.5" />
              HostedOn
            </span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            :model-value="isLayoutRelationEnabled('ConnectsTo')"
            @update:model-value="toggleLayoutRelation('ConnectsTo')"
            @select.prevent
          >
            <span class="inline-flex gap-2 items-center">
              <span class="rounded-full bg-[var(--chart-2)] size-2.5" />
              ConnectsTo
            </span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            :model-value="isLayoutRelationEnabled('AttachesTo')"
            @update:model-value="toggleLayoutRelation('AttachesTo')"
            @select.prevent
          >
            <span class="inline-flex gap-2 items-center">
              <span class="rounded-full bg-[var(--chart-3)] size-2.5" />
              AttachesTo
            </span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            :model-value="isLayoutRelationEnabled('DependsOn')"
            @update:model-value="toggleLayoutRelation('DependsOn')"
            @select.prevent
          >
            <span class="inline-flex gap-2 items-center">
              <span class="rounded-full bg-[var(--chart-4)] size-2.5" />
              DependsOn
            </span>
          </DropdownMenuCheckboxItem>
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
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <div>
            <Tooltip :open="showTooltips">
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon">
                  <i class="i-lucide-filter size-5" />
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
      <Tooltip :open="showTooltips">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" @click="openSearch">
            <i class="i-lucide-search size-5" />
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
      <hr class="my-3 border-foreground/20 w-[50%]">
      <Tooltip :open="showTooltips">
        <TooltipTrigger as-child>
          <Button
            :variant="interactionMode === 'NORMAL' ? 'default' : 'ghost'"
            size="icon"
            @click="interactionMode = 'NORMAL'"
          >
            <i class="i-lucide-mouse-pointer-2 size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          Normal Mode
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <div>
            <Tooltip :open="showTooltips">
              <TooltipTrigger as-child>
                <Button :variant="interactionMode !== 'NORMAL' ? 'default' : 'ghost'" size="icon">
                  <i class="i-mingcute-finger-tap-line size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Highlight on Hover
              </TooltipContent>
            </Tooltip>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuLabel>Highlight on Hover</DropdownMenuLabel>
          <DropdownMenuRadioGroup v-model="interactionMode">
            <DropdownMenuRadioItem value="HIGHLIGHT_DIRECT_SUCCESSORS" @select.prevent>
              Successors
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="HIGHLIGHT_DIRECT_PREDECESSORS" @select.prevent>
              Predecessors
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="HIGHLIGHT_NEIGHBOURS" @select.prevent>
              Neighbours
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <GraphSearch v-if="isSearchOpen" v-model="searchQuery" @close="closeSearch" />
    </div>
    <div class="grow" />
    <div class="flex flex-col gap-1 items-center">
      <Tooltip :open="showTooltips">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" @click="emit('close')">
            <i class="i-solar-close-circle-linear size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Close Graph</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip :open="showTooltips">
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" @click="toggleDark()">
            <i v-if="isDark" class="i-lucide-sun size-5" />
            <i v-else class="i-lucide-moon size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{{ isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode' }}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
