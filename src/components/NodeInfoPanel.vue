<script setup lang="ts">
import type { Node } from '@vue-flow/core'
import type { ComponentAssignment } from '~/lib/io'
import { BoxIcon, ChevronDown, ChevronUp, CogIcon, FileIcon, GitBranchIcon, HashIcon, InfoIcon, TagIcon, XIcon } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useNodeInfoPanelStore } from '~/stores/node-info-panel'
import { Button } from './ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

// Type for component type definition
interface ComponentTypeDefinition {
  extends?: string
  description?: string | null
  metadata?: Record<string, string>
  properties?: Record<string, unknown>
  operations?: Record<string, unknown>
}

const props = defineProps<{
  node: Node | null
  component: ComponentAssignment | null
  componentTypes?: Record<string, ComponentTypeDefinition>
}>()

const emit = defineEmits<{
  close: []
}>()

// Collapsible states from store (persisted in localStorage)
const panelStore = useNodeInfoPanelStore()
const {
  descriptionOpen,
  typeHierarchyOpen,
  metadataOpen,
  propertiesOpen,
  operationsOpen,
  artifactsOpen,
} = storeToRefs(panelStore)

// Compute type inheritance hierarchy
const typeHierarchy = computed<string[]>(() => {
  if (!props.component?.type || !props.componentTypes)
    return []

  const hierarchy: string[] = [props.component.type]
  let currentType = props.component.type

  // Walk up the inheritance chain
  while (currentType && props.componentTypes[currentType]) {
    const typeDef = props.componentTypes[currentType]
    if (typeDef.extends) {
      hierarchy.push(typeDef.extends)
      currentType = typeDef.extends
    }
    else {
      break
    }
  }

  return hierarchy.reverse()
})

// Parse properties into a displayable format
const propertiesArray = computed(() => {
  if (!props.component?.properties)
    return []
  return Object.entries(props.component.properties).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    isComplex: typeof value === 'object',
  }))
})

// Parse operations into a displayable format
const operationsArray = computed(() => {
  if (!props.component?.operations)
    return []
  return Object.entries(props.component.operations).map(([name, def]) => {
    const operation = typeof def === 'string' || def === null
      ? { description: def, artifacts: [] }
      : def
    return {
      name,
      description: operation?.description || null,
      artifacts: operation?.artifacts || [],
    }
  })
})

// Parse artifacts into a displayable format
const artifactsArray = computed(() => {
  if (!props.component?.artifacts || !Array.isArray(props.component.artifacts))
    return []
  return props.component.artifacts.flatMap(artifact =>
    Object.entries(artifact).map(([type, data]) => ({
      type,
      name: typeof data === 'object' && data !== null && 'name' in data ? String(data.name) : '-',
      fileURI: typeof data === 'object' && data !== null && 'fileURI' in data ? String(data.fileURI) : '-',
    })),
  )
})

// Parse metadata
const metadataArray = computed(() => {
  if (!props.component?.metadata)
    return []
  return Object.entries(props.component.metadata).map(([key, value]) => ({
    key,
    value: String(value),
  }))
})
</script>

<template>
  <Transition name="slide">
    <aside
      v-if="node && component"
      class="border border-border rounded-lg bg-sidebar flex flex-col h-[calc(100%-2rem)] w-[380px] right-[1rem] top-[1rem] absolute z-10 overflow-hidden"
    >
      <!-- Header -->
      <header class="text-accent-foreground px-4 pb-3 pt-4 border-b border-border bg-foreground/5 flex items-center justify-between">
        <div class="flex gap-3 items-center">
          <div class="rounded-md flex size-5 items-center justify-center">
            <BoxIcon class="size-5" />
          </div>
          <div class="flex flex-col">
            <h2 class="text-base font-semibold leading-tight m-0">
              {{ node.id }}
            </h2>
            <span class="text-xs font-mono">{{ component.type }}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" class="opacity-80 hover:opacity-100 hover:bg-white/10!" @click="emit('close')">
          <XIcon class="size-4" />
        </Button>
      </header>

      <!-- Content -->
      <div class="p-2 flex flex-1 flex-col gap-2 overflow-y-auto">
        <!-- Description -->
        <Collapsible v-if="component.description" v-model:open="descriptionOpen" class="flex flex-col gap-1">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <InfoIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Description
                </h3>
              </div>
              <ChevronUp v-if="descriptionOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p class="text-sm text-muted-foreground leading-relaxed m-0">
              {{ component.description }}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <!-- Type Hierarchy -->
        <Collapsible v-if="typeHierarchy.length > 1" v-model:open="typeHierarchyOpen" class="flex flex-col gap-1">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <GitBranchIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Type Hierarchy
                </h3>
              </div>
              <ChevronUp v-if="typeHierarchyOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="px-2.5 flex flex-col gap-1">
              <div v-for="(typeName, index) in typeHierarchy" :key="typeName" class="flex h-6 items-stretch">
                <div :style="`width: ${index * 10}px`" class="h-full relative overflow-hidden">
                  <div class="border border-foreground rounded-md h-full w-[10px] right-0 absolute -translate-x-[50%] -translate-y-[50%]" />
                </div>
                <span
                  class="text-xs text-foreground font-mono px-2 py-1 rounded bg-muted" :class="[
                    index !== typeHierarchy.length - 1 || 'font-semibold',
                  ]"
                >{{ typeName }}</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Metadata -->
        <Collapsible v-if="metadataArray.length > 0" v-model:open="metadataOpen" class="flex flex-col gap-1">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <TagIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Metadata
                </h3>
                <span class="leading-none text-xs text-foreground">({{ metadataArray.length }})</span>
              </div>
              <ChevronUp v-if="metadataOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-1">
            <div v-for="meta in metadataArray" :key="meta.key" class="px-2.5 py-2 rounded-md bg-muted gap-3 grid grid-cols-[minmax(120px,auto)_1fr] overflow-hidden">
              <span class="text-xs text-muted-foreground font-medium break-words">{{ meta.key }}</span>
              <span class="text-xs text-foreground font-mono break-all">{{ meta.value }}</span>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Properties -->
        <Collapsible v-if="propertiesArray.length > 0" v-model:open="propertiesOpen" class="flex flex-col gap-1">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <HashIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Properties
                </h3>
                <span class="leading-none text-xs text-foreground">({{ propertiesArray.length }})</span>
              </div>
              <ChevronUp v-if="propertiesOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-1">
            <div
              v-for="prop in propertiesArray"
              :key="prop.key"
              class="px-2.5 py-2 rounded-md bg-foreground/3 flex flex-col overflow-hidden"
            >
              <Tooltip :delay-duration="1000">
                <TooltipTrigger as-child>
                  <span class="text-xs text-muted-foreground font-medium cursor-default truncate">{{ prop.key }}</span>
                </TooltipTrigger>
                <TooltipContent side="top" align="start">
                  <p class="text-xs">
                    {{ prop.key }}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip v-if="!prop.isComplex" :delay-duration="1000">
                <TooltipTrigger as-child>
                  <span class="text-xs text-foreground font-mono cursor-default truncate">{{ prop.value }}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" class="max-w-[350px]">
                  <p class="text-xs font-mono whitespace-pre-wrap break-all">
                    {{ prop.value }}
                  </p>
                </TooltipContent>
              </Tooltip>
              <span
                v-else
                class="text-xs text-foreground font-mono p-2 rounded bg-background whitespace-pre-wrap overflow-x-auto"
              >{{ prop.value }}</span>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Operations -->
        <Collapsible v-if="operationsArray.length > 0" v-model:open="operationsOpen" class="flex flex-col gap-1">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <CogIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Operations
                </h3>
                <span class="leading-none text-xs text-foreground">({{ operationsArray.length }})</span>
              </div>
              <ChevronUp v-if="operationsOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-1">
            <details v-for="op in operationsArray" :key="op.name" class="rounded-md bg-muted overflow-hidden">
              <summary class="text-sm text-foreground font-medium px-3 py-2 cursor-pointer select-none transition-colors hover:bg-accent">
                {{ op.name }}
              </summary>
              <div class="text-xs text-muted-foreground px-3 pb-2.5">
                <p v-if="op.description" class="m-0 mb-2">
                  {{ op.description }}
                </p>
                <div v-if="op.artifacts && op.artifacts.length > 0" class="flex flex-col gap-1">
                  <span class="text-foreground font-medium mb-1">Artifacts:</span>
                  <ul class="m-0 pl-3 list-none">
                    <li v-for="(artifact, idx) in op.artifacts" :key="idx" class="mb-1 flex gap-2">
                      <template v-for="(artData, artType) in artifact" :key="artType">
                        <span class="text-chart-2 font-medium">{{ artType }}:</span>
                        <span class="font-mono break-all">{{ typeof artData === 'object' && artData && 'name' in artData ? artData.name : artData }}</span>
                      </template>
                    </li>
                  </ul>
                </div>
                <p v-else class="m-0 italic">
                  No artifacts defined
                </p>
              </div>
            </details>
          </CollapsibleContent>
        </Collapsible>

        <!-- Artifacts -->
        <Collapsible v-if="artifactsArray.length > 0" v-model:open="artifactsOpen" class="flex flex-col gap-2">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="flex h-9 items-center justify-between ps-2!">
              <div class="flex gap-2 items-center">
                <FileIcon class="text-muted-foreground size-4" />
                <h3 class="text-xs text-foreground font-semibold tracking-wide m-0 uppercase">
                  Artifacts
                </h3>
                <span class="leading-none text-xs text-foreground">({{ artifactsArray.length }})</span>
              </div>
              <ChevronUp v-if="artifactsOpen" class="text-muted-foreground size-3" />
              <ChevronDown v-else class="text-muted-foreground size-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-1">
            <div v-for="(artifact, idx) in artifactsArray" :key="idx" class="px-2.5 py-2 rounded-md bg-muted flex gap-2.5 items-start">
              <span class="text-[0.65rem] text-white font-semibold tracking-tight px-2 py-1 rounded bg-chart-2 shrink-0 uppercase">{{ artifact.type }}</span>
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="text-xs text-foreground font-medium break-words">{{ artifact.name }}</span>
                <span class="text-[0.7rem] text-muted-foreground font-mono break-all">{{ artifact.fileURI }}</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Empty state -->
        <div v-if="propertiesArray.length === 0 && operationsArray.length === 0 && artifactsArray.length === 0 && !component.description" class="text-muted-foreground px-4 py-8 text-center flex flex-col gap-2 items-center justify-center">
          <InfoIcon class="opacity-50 size-8" />
          <p class="text-sm m-0">
            No additional information available for this component.
          </p>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
