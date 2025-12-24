<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useGraphSettingsStore } from '~/stores/graph-settings'
import { Button } from './ui/button'
import { ButtonGroup } from './ui/button-group'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger } from './ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const store = useGraphSettingsStore()

const { layoutRelations, visibleRelations, searchQuery, layoutDirection, interactionMode } = storeToRefs(store)

function toggleLayoutDirection() {
  layoutDirection.value = layoutDirection.value === 'horizontal' ? 'vertical' : 'horizontal'
}
</script>

<template>
  <div class="p-1 border rounded-lg bg-background flex gap-1 items-stretch left-2 top-2 fixed">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon" @click="toggleLayoutDirection">
          <i v-if="layoutDirection === 'horizontal'" class="i-lucide-arrow-right-left size-5" />
          <i v-else class="i-lucide-arrow-up-down size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{{ layoutDirection === 'horizontal' ? 'Switch to Vertical Layout' : 'Switch to Horizontal Layout' }}</p>
      </TooltipContent>
    </Tooltip>
    <Select v-model="layoutRelations" multiple>
      <SelectTrigger as-child hide-icon>
        <Button variant="ghost" class="pe-2 border-transparent rounded-md cursor-default shadow-none" size="icon">
          <span>Layout</span>
          <i class="i-lucide-chevron-down size-4" />
        </Button>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectLabel>Layout relations</SelectLabel>
        <SelectItem value="HostedOn">
          HostedOn
        </SelectItem>
        <SelectItem value="ConnectsTo">
          ConnectsTo
        </SelectItem>
        <SelectItem value="AttachesTo">
          AttachesTo
        </SelectItem>
        <SelectItem value="DependsOn">
          DependsOn
        </SelectItem>
      </SelectContent>
    </Select>
    <Select v-model="visibleRelations" multiple>
      <SelectTrigger as-child hide-icon>
        <Button variant="ghost" size="icon" class="pe-2 border-transparent rounded-md cursor-default shadow-none">
          <span>Edges</span>
          <i class="i-lucide-chevron-down size-5" />
        </Button>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectLabel>Visible edge types</SelectLabel>
        <SelectItem value="HostedOn">
          <span class="inline-flex gap-2 items-center">
            <span class="rounded-full bg-[var(--chart-1)] size-2.5" />
            HostedOn
          </span>
        </SelectItem>
        <SelectItem value="ConnectsTo">
          <span class="inline-flex gap-2 items-center">
            <span class="rounded-full bg-[var(--chart-2)] size-2.5" />
            ConnectsTo
          </span>
        </SelectItem>
        <SelectItem value="AttachesTo">
          <span class="inline-flex gap-2 items-center">
            <span class="rounded-full bg-[var(--chart-3)] size-2.5" />
            AttachesTo
          </span>
        </SelectItem>
        <SelectItem value="DependsOn">
          <span class="inline-flex gap-2 items-center">
            <span class="rounded-full bg-[var(--chart-4)] size-2.5" />
            DependsOn
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
    <Select v-model="interactionMode">
      <SelectTrigger as-child hide-icon>
        <Button variant="ghost" size="icon" class="pe-2 border-transparent rounded-md cursor-default shadow-none">
          <span>Interaction</span>
          <i class="i-lucide-chevron-down size-4" />
        </Button>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectLabel>Interaction mode</SelectLabel>
        <SelectItem value="HIGHLIGHT_DIRECT_DEPENDENCIES">
          Direct Successors
        </SelectItem>
        <SelectItem value="HIGHLIGHT_ALL_DEPENDENCIES">
          All Successors
        </SelectItem>
        <SelectItem value="HIGHLIGHT_DIRECT_DESCENDANTS">
          Direct Predecessors
        </SelectItem>
        <SelectItem value="HIGHLIGHT_ALL_DESCENDANTS">
          All Predecessors
        </SelectItem>
        <SelectItem value="HIGHLIGHT_NEIGHBOURS">
          Neighbours
        </SelectItem>
      </SelectContent>
    </Select>
    <div class="flex items-center relative">
      <i
        class="i-lucide-search top-1/2 -translate-y-1/2 text-muted-foreground size-4 pointer-events-none left-2.5 absolute"
      />
      <Input v-model="searchQuery" placeholder="Search nodes..." class="pl-8 h-8 w-48" />
    </div>
  </div>
  <!-- <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" class="fixed top-2 left-2">
                <SettingsIcon class="size-5" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuLabel>Hosted on relations</DropdownMenuLabel>
            <DropdownMenuRadioGroup v-model="store.hostedOnRelationDisplay">
                <DropdownMenuRadioItem value="SHOW">
                    Show
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="HIDE">
                    Hide
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="GROUP">
                    Group
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Layout relations</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
                :model-value="store.isLayoutRelationEnabled(RelationType.HostedOn)"
                @update:model-value="store.toggleLayoutRelation(RelationType.HostedOn)"
            >
                HostedOn
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isLayoutRelationEnabled(RelationType.ConnectsTo)"
                @update:model-value="store.toggleLayoutRelation(RelationType.ConnectsTo)"
            >
                ConnectsTo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isLayoutRelationEnabled(RelationType.AttachesTo)"
                @update:model-value="store.toggleLayoutRelation(RelationType.AttachesTo)"
            >
                AttachesTo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isLayoutRelationEnabled(RelationType.DependsOn)"
                @update:model-value="store.toggleLayoutRelation(RelationType.DependsOn)"
            >
                DependsOn
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Visible relations</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
                :model-value="store.isVisibleRelationEnabled(RelationType.HostedOn)"
                @update:model-value="store.toggleVisibleRelation(RelationType.HostedOn)"
            >
                HostedOn
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isVisibleRelationEnabled(RelationType.ConnectsTo)"
                @update:model-value="store.toggleVisibleRelation(RelationType.ConnectsTo)"
            >
                ConnectsTo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isVisibleRelationEnabled(RelationType.AttachesTo)"
                @update:model-value="store.toggleVisibleRelation(RelationType.AttachesTo)"
            >
                AttachesTo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
                :model-value="store.isVisibleRelationEnabled(RelationType.DependsOn)"
                @update:model-value="store.toggleVisibleRelation(RelationType.DependsOn)"
            >
                DependsOn
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Interaction mode</DropdownMenuLabel>
            <DropdownMenuRadioGroup v-model="store.interactionMode">
                <DropdownMenuRadioItem value="HIGHLIGHT_DIRECT_DEPENDENCIES">
                    Highlight direct dependencies
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="HIGHLIGHT_ALL_DEPENDENCIES">
                    Highlight all dependencies
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="HIGHLIGHT_DIRECT_DESCENDANTS">
                    Highlight direct descendants
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="HIGHLIGHT_ALL_DESCENDANTS">
                    Highlight all descendants
                </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem v-model="store.showEdgeLabels">
                Show edge labels
            </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
    </DropdownMenu> -->
</template>
