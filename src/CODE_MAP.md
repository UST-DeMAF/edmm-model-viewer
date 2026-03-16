# edmm-model-viewer/src — Code Map

> Goal: document what each file does and its key functions/logic, to identify duplication.

---

## Duplication Summary

| Pattern                                                                                                | Locations                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`displayNodes` / `displayEdges` logic** (highlight, filter, CSS classes)                             | `EdmmGraph.vue` (inline) + `use-display-nodes.ts` + `use-display-edges.ts` — all three contain the same pipeline                                 |
| **Interaction handlers** (onNodeClick, onEdgeClick, onPaneClick, edge hover, hideUnselectedNodes)      | `EdmmGraph.vue` (inline) + `use-graph-interaction.ts`                                                                                            |
| **`hasMetadata` check** (description/properties/operations)                                            | `EdmmGraph.vue`, `use-graph-interaction.ts`, `EdmmEdge.vue` — 4 copies                                                                           |
| **YAML load + parse + setModel**                                                                       | `pages/index.vue` (×3), `EdmmModelLoader.vue` (×2)                                                                                               |
| **`toHumanReadable(name)`**                                                                            | `stores/graph.ts`, `NodeLegend.vue`                                                                                                              |
| **`isRelationVisible`**                                                                                | `lib/graph-layout.ts` (exported fn), `stores/graph.ts` (store method), `EdgeLegend.vue` (local fn)                                               |
| **`toggleRelationVisibility`**                                                                         | `stores/graph.ts` (store method), `EdgeLegend.vue` (local `toggleEdgeType`)                                                                      |
| **`getAllDescendantTypes`**                                                                            | `lib/type-hierarchy.ts` (exported fn), `NodeTypeFilter.vue` (local `getAllDescendants`)                                                          |
| **`typeHierarchy` walk** (extends chain)                                                               | `lib/type-hierarchy.ts` (`getAllAncestorTypes`), `ElementInfoPanel.vue` (×2 — node and edge branches), `stores/graph.ts` (`getDirectParentType`) |
| **Tree-building from `extends`**                                                                       | `lib/type-hierarchy.ts` (`buildTypeHierarchy`), `stores/graph.ts` (`relationTypesHierarchy`)                                                     |
| **`InteractionMode` type alias**                                                                       | `lib/graph-highlighting.ts`, `stores/graph-settings.ts`                                                                                          |
| **Palette index + textured flag** (`index % palette.length`, `index >= palette.length`)                | `stores/graph.ts` — repeated for nodes and edges                                                                                                 |
| **Zod array-of-records `.transform` flatten**                                                          | `lib/io.ts` — repeated ~10 times                                                                                                                 |
| **Node building block** (position, style with baseFontSize/baseBorderRadius/basePaddingV/basePaddingH) | `lib/graph-layout.ts` — in both `runFlatDagreLayout` and `runElkLayout`                                                                          |
| **`applyNodeHighlights` / `applyEdgeHighlights`**                                                      | Structurally identical functions in `lib/graph-highlighting.ts`                                                                                  |
| **Collapsible section template** (trigger+icon+title+chevron+content)                                  | `ElementInfoPanel.vue` — 6 copies                                                                                                                |
| **Interaction mode button** (Tooltip+Button+icon+label+Kbd)                                            | `GraphSettings.vue` — 5 copies                                                                                                                   |
| **`isHighlightMode` array**                                                                            | `GraphSettings.vue`, `use-highlight-range-scroll.ts`                                                                                             |
| **NProgress router hooks**                                                                             | `main.ts`, `modules/nprogress.ts`                                                                                                                |
| **Pinia setup**                                                                                        | `main.ts`, `modules/pinia.ts`                                                                                                                    |
| **`ComponentTypeDefinition` / `RelationTypeDefinition` interfaces**                                    | `lib/type-hierarchy.ts`, `ElementInfoPanel.vue` (both identical shape)                                                                           |
| **`getColorStyle` / `getEdgeColorStyle`** (textured dot pattern)                                       | `NodeLegend.vue`, `EdgeLegend.vue`                                                                                                               |
| **`handleFileUpload` / `handleFolderUpload` size check pattern**                                       | `TransformDialog.vue`                                                                                                                            |

---

## Files Processed

### `composables/dark.ts`

- Exports `isDark`, `toggleDark`, `preferredDark` from `@vueuse/core`. Pure re-export, no logic.

---

### `composables/use-highlight-range-scroll.ts`

- Composable `useHighlightRangeScroll()`. Adjusts `highlightRange` (1–5 or null=unlimited) via Shift+scroll.
- Registers `wheel` event listener in capture phase (to intercept before Vue Flow zoom).
- Only active in HIGHLIGHT\_\* modes.
- No duplication.

---

### `composables/use-interaction-mode-keybinds.ts`

- Composable `useInteractionModeKeybinds()`. Maps keyboard shortcuts (n/s/p/b/r) to interaction modes.
- `isInputFocused()` helper — prevents firing when user is typing in an input.
- **Duplication**: `isInputFocused()` check is repeated in every `onKeyStroke` callback (5 times). Could be extracted to a single wrapper.

---

### `composables/use-hovered-node.ts`

- Composable `useHoveredNode()`. Tracks hovered `GraphNode` via `onNodeMouseEnter`/`onNodeMouseLeave`.
- Returns a single `shallowRef<GraphNode | null>`.
- Minimal, no duplication.

---

### `pages/[...all].vue`

- Catch-all route. Redirects all unmatched paths to `/`.

### `layouts/default.vue`

- Default layout. Just renders `<RouterView />`.

### `modules/nprogress.ts`

- Vite-SSG module. Installs NProgress on router hooks. **Note**: NProgress is also wired in `main.ts` — duplication.

### `modules/pinia.ts`

- Vite-SSG module. Creates and installs Pinia, handles SSG state serialization. **Note**: Pinia is also created in `main.ts` — duplication (likely legacy SSG setup).

### `mocks/web-worker.ts`

- Empty mock export. Placeholder.

---

### `pages/index.vue`

- Main page. Manages `viewMode` ('welcome' | 'local' | 'transformation' | 'demo').
- `handleLocalFileChange(event)` — reads file, calls `parseAndValidateEdmm`, sets model. **Duplicates** the same logic in `EdmmModelLoader.vue` and `onMounted` below.
- `openDemoModel()` — loads demo YAML, **same** `parseAndValidateEdmm` + `graphStore.setModel` pattern.
- `onMounted` — loads test YAML in dev mode, **again** the same pattern (3rd copy in this file).
- `handleTransformationComplete` — adds to store, selects transformation.
- Template: 4 view states + welcome screen with recent transformations list + parse error dialog.
- **Duplication**: YAML loading + parse + setModel pattern appears 3 times in this file alone (handleLocalFileChange, openDemoModel, onMounted), and is also in `EdmmModelLoader.vue`.

---

### `components/TransformPanel.vue`

- Thin wrapper that renders `<TransformDialog>` and re-emits `transformationComplete`. No logic.

---

### `components/dialogs/TransformDialog.vue`

- Dialog for uploading a deployment model file and triggering a transformation.
- State: `sessionId`, `uploadedFiles`, `fileName`, `folderName`, `startFilePath`, `selectedTechnology`, `technologies`, `commands`, `options`, `isTransforming`, `error`, `success`.
- `handleFileUpload`/`handleFolderUpload` — both call `checkTotalSize`, set `uploadedFiles`. **Duplication**: identical size check + error message pattern.
- `startTransformation()` — dispatches to `handleSingleFileTransformation` or `handleMultipleFilesTransformation`, then `startTransformationProcess`, then optionally `moveToTADMS`.
- Polls `getRegisteredPlugins` every 30s via `setInterval`.
- **Duplication**: `handleFileUpload` and `handleFolderUpload` share the same `checkTotalSize` guard pattern.

---

### `components/graph/EdmmNode.vue`

- Vue Flow custom node component.
- Props: `id`, `data` (label, type, isGroupNode, highlighted, dimmed, searchQuery, scale, dependentCount, shape, distance).
- `targetPosition`/`sourcePosition` — computed from `layoutDirection`.
- `highlightedLabel` — wraps search match in `<mark>` tag.
- Renders: distance badge, group header or regular label+badge, two `<Handle>` elements.
- No significant duplication.

---

### `components/graph/EdmmEdge.vue`

- Vue Flow custom edge component.
- `hasMetadata` computed — **same check** as in `use-graph-interaction.ts` and `EdmmGraph.vue` (description/properties/operations check).
- `edgeColor` — from `graphStore.getRelationColor`.
- `edgeStyle` — stroke width, opacity, glow filter on hover.
- Renders: `<EdmmMarker>`, invisible hover zone path, `<BaseEdge>`, animated flow path (when highlighted), `<EdgeLabelRenderer>`.
- **Duplication**: `hasMetadata` logic is a 4th copy of the same check.

---

### `components/GraphSearch.vue`

- Floating search bar (fixed bottom-center). Binds to `settingsStore.searchQuery`.
- `handleClose()` — clears query and emits `close`.
- Keyboard: Escape → close, `f` → refocus input.
- Auto-focuses on mount.
- No significant duplication.

---

### `components/InteractionModeHelper.vue`

- Floating tooltip at top of graph showing contextual hint for current interaction mode.
- `rangeLabel` — formats `highlightRange` as "direct" / "within N steps" / "all".
- `helperMessages` — map of mode → message string.
- No duplication.

---

### `components/NodeTypeFilter.vue`

- Dropdown content for filtering visible node types by type hierarchy.
- `typeTree` — calls `buildTypeHierarchy` from `lib/type-hierarchy.ts`.
- `descendantsMap` — **re-implements** descendant lookup locally (similar to `getAllDescendantTypes` in `lib/type-hierarchy.ts`).
- `selectionStates` — computed map of 'all'/'some'/'none' per type.
- `toggleSelection(typeName)` — selects/deselects type + all descendants.
- `flattenVisibleNodes` — DFS flatten respecting `expandedTypes`.
- `filterSummary` — text summary of filter state.
- **Duplication**: `getAllDescendants` local function duplicates `getAllDescendantTypes` from `lib/type-hierarchy.ts`.

---

### `components/NodeLegend.vue`

- Shows legend for node color or shape differentiation.
- `legendItems` computed — maps `uniqueParentTypes` to color/shape info based on `typeDifferentiationMode`.
- `toHumanReadable(name)` — **duplicated** from `stores/graph.ts` (identical function body).
- `getColorStyle(item)` — builds CSS for color swatch (with textured dot pattern).
- **Duplication**: `toHumanReadable` is copy-pasted from `stores/graph.ts`. `getColorStyle` textured pattern is similar to `EdgeLegend.vue`'s `getEdgeColorStyle`.

---

### `components/EdgeLegend.vue`

- Shows relation type visibility toggles in a tree (using Reka UI `TreeRoot`).
- `isEdgeTypeVisible(edgeType)` — checks `hiddenRelations` (duplicates `graphStore.isRelationVisible`).
- `toggleEdgeType(edgeType)` — toggles visibility (duplicates `graphStore.toggleRelationVisibility`).
- `getEdgeColorStyle(item)` — similar to `NodeLegend.vue`'s `getColorStyle` (textured dot pattern).
- **Duplication**: `isEdgeTypeVisible` and `toggleEdgeType` are local reimplementations of store methods.

---

### `components/EdmmModelLoader.vue`

- Handles loading an EDMM model from a file or from the backend.
- State: `model`, `errorMessage`, `loading`, `fileInputRef`.
- `handleFileChange(event)` — reads file, calls `parseAndValidateEdmm`, sets model in store.
- `loadFromBackend(transformationId)` — fetches YAML via `fetchTADM`, validates, sets model.
- `onMounted` — loads test YAML in dev mode if `VITE_APP_USE_TEST_YAML` is set.
- Template: 4 states (loading, error, loaded slot, file picker).
- **Duplication**: `handleFileChange` and `loadFromBackend` share identical try/catch/finally structure and `parseAndValidateEdmm` + `graphStore.setModel` logic. Also in `onMounted`.

---

### `components/GraphSettings.vue`

- Left sidebar with all graph controls. Collapsible (icon-only ↔ expanded).
- Registers `useInteractionModeKeybinds()` and `useHighlightRangeScroll()`.
- Sections: Layout dropdown (direction, algorithm, type differentiation, edge labels), Filter dropdown (NodeTypeFilter), Search button, Interaction mode buttons (Normal/Successors/Predecessors/Neighbours/ShortestPath), Highlight range selector, Close/Dark mode buttons.
- **Duplication**: Each interaction mode button is a `<Tooltip><TooltipTrigger><Button>` block — 5 nearly identical blocks. Could be a loop/component.
- `isHighlightMode` computed — checks same array `['HIGHLIGHT_SUCCESSORS', 'HIGHLIGHT_PREDECESSORS', 'HIGHLIGHT_NEIGHBOURS']` as `use-highlight-range-scroll.ts`.

---

### `components/ElementInfoPanel.vue`

- Sidebar panel showing details for selected node (component) or edge (relation).
- Detects element type from props (`node`+`component` → 'node', `edge`+`relation` → 'edge').
- Sections (all collapsible, state persisted via `useElementInfoPanelStore`): Description, Type Hierarchy, Metadata, Properties, Operations, Artifacts (nodes only).
- **Duplication**: `typeHierarchy` computed walks `extends` chain for both node and edge types — identical loop logic, duplicated for each branch. Same pattern as `getAllAncestorTypes` in `lib/type-hierarchy.ts`.
- **Duplication**: `ComponentTypeDefinition` and `RelationTypeDefinition` interfaces are structurally identical (same fields).
- Collapsible section template pattern (trigger button with icon + title + chevron + content) is repeated 6 times.

---

### `components/EdmmGraph.vue`

- **Main graph component**. Orchestrates VueFlow with all EDMM-specific logic.
- **CRITICAL DUPLICATION**: This file contains almost the entire logic of `use-display-nodes.ts`, `use-display-edges.ts`, and `use-graph-interaction.ts` — all inline. The composables were apparently extracted from this file but the original code was NOT removed. Specifically duplicated:
  - `onNodeClick`, `onEdgeClick`, `onPaneClick` handlers (identical to `use-graph-interaction.ts`)
  - `hideUnselectedNodes`, `hasSelectedNodes`, `isNodeFilterActive`, `selectedComponent`, `selectedRelation` (identical)
  - `forwardPaths`, `reversePaths`, `effectiveHighlightNodeId`, `highlights` computeds (identical to `use-display-nodes.ts`)
  - `displayNodes` computed (identical to `use-display-nodes.ts`)
  - `displayEdges` computed (identical to `use-display-edges.ts`)
  - `onEdgeMouseEnter`/`onEdgeMouseLeave` with `hasMetadata` check (identical to `use-graph-interaction.ts`)
  - `closeInfoPanel` (identical)
- Template: renders `<VueFlow>` with `<Background>`, `<GraphSettings>`, `<InteractionModeHelper>`, `<NodeLegend>`, `<EdgeLegend>`, `<ElementInfoPanel>`, context menu for node visibility.
- Styles: ~180 lines of CSS for node states (dimmed, highlighted, type-colored, shapes).

---

### `composables/use-graph-interaction.ts`

- Composable `useGraphInteraction(vueFlowRef, model)`.
- Handles all click/hover/selection events on the graph.
- State: `selectedNode`, `selectedEdge`, `hoveredEdgeId`.
- Event handlers: `onNodeClick` (sets anchor in SHORTEST_PATH mode), `onEdgeClick` (selects edge if it has metadata), `onPaneClick` (clears selection).
- `onEdgeMouseEnter`/`onEdgeMouseLeave` — hover glow effect.
- `hideUnselectedNodes()` — filters visible nodes to current selection.
- Computed: `hasSelectedNodes`, `isNodeFilterActive`, `selectedComponent`, `selectedRelation`.
- **Duplication**: `hasMetadata` check (description/properties/operations) is copy-pasted in both `onEdgeClick` and `onEdgeMouseEnter`.

---

### `composables/use-display-edges.ts`

- Composable `useDisplayEdges(layoutedNodes, rawEdges, hoveredNode, hoveredEdgeId, effectiveHighlightNodeId, highlights, model)`.
- Computes final Vue Flow `Edge[]` pipeline (6 steps): visible-node filter → relation-type filter → node-type dimming setup → enrich edge data → apply highlights → merge filter dimming.
- Returns `{ displayEdges }`.
- **Duplication with `use-display-nodes.ts`**:
  - `visibleNodeIdsFilter` / `visibleNodeSet` construction is identical.
  - `isNormalMode`, `isShortestPathMode`, `shortestPathActive`, `hasSelection` logic is copy-pasted.
  - `isSearchActive`, `isHoverInteractionActive`, `visibleTypes`, `componentTypes` setup is copy-pasted.

---

### `composables/use-display-nodes.ts`

- Composable `useDisplayNodes(layoutedNodes, hoveredNode, selectedNode, model)`.
- Computes final Vue Flow `Node[]` from layout output, applying: shortest-path BFS, highlights, visibility filter, type-filter dimming, search dimming, CSS class/style assembly.
- Key computed refs: `effectiveHighlightNodeId`, `forwardPaths`, `reversePaths`, `highlights`, `displayNodes`.
- `displayNodes` pipeline (6 steps): visible-node filter → highlight → BFS distance injection → type-filter dimming → search dimming → CSS class/style.
- Returns `{ effectiveHighlightNodeId, highlights, displayNodes }`.
- **Note**: `highlights` is shared with `use-display-edges.ts` (passed out so edges can reuse it).

---

### `services/transformation-service.ts`

- All HTTP calls to the DeMAF backend. Reads URLs from `VITE_*` env vars with fallback defaults.
- Types: `TechnologySpecificDeploymentModel`, `TransformationResult`.
- Functions:
  - `generateSessionId()` — returns `uuidv4()`.
  - `checkTotalSize(files)` — checks total ≤ 50 MB.
  - `getRegisteredPlugins()` — GET `/demaf/plugins`; filters out `docker`, renames `visualization-service`→`TADM`.
  - `saveUploadedFileForTransformation(file, sessionId)` — POST single file.
  - `saveUploadedFilesForTransformation(files, sessionId)` — POST multiple files; uses different endpoint based on count.
  - `callAnalysisManagerTransformation(tsdm)` — POST to `/demaf/transform`.
  - `pollTransformationProcessStatusForResult(id, delay)` — recursive polling until `isFinished`.
  - `handleSingleFileTransformation(...)` — uploads + builds TSDM for single file.
  - `handleMultipleFilesTransformation(...)` — uploads + builds TSDM for folder.
  - `startTransformationProcess(tsdm)` — calls analysis manager + polls result.
  - `existsTADM(tadmId)` — POST `/tadms/exists`.
  - `fetchTADM(tadmId)` — GET `/tadms/{id}.yaml`.
  - `moveToTADMS(fileName, sessionId, taskId)` — POST `/move-to-tadms`.
- **Duplication**: `handleSingleFileTransformation` and `handleMultipleFilesTransformation` both call `createTSDM` with the same `file:/usr/share/uploads/${session}/...` path pattern. `response.ok` error-throw pattern repeated in every fetch call.

---

### `stores/transformations.ts`

- Pinia store `useTransformationStore`. Manages list of TADM transformations.
- State: `sessionId`, `transformations[]`, `activeTransformationId`.
- Loads from `localStorage` on init (manual JSON.parse, unlike the other stores that use `useLocalStorage`).
- Computed: `activeTransformation`, `hasTransformations`.
- Actions: `addTransformation`, `removeTransformation`, `setActiveTransformation`, `saveToLocalStorage`, `validateTransformations` (async, calls `existsTADM` per entry), `resetSessionId`.
- **Note**: uses raw `localStorage.getItem/setItem` instead of `useLocalStorage` — inconsistent with other stores.

---

### `stores/element-info-panel.ts`

- Pinia store `useElementInfoPanelStore`. Persists collapsible-section open/closed state to `localStorage`.
- State: `descriptionOpen`, `typeHierarchyOpen`, `metadataOpen`, `propertiesOpen`, `operationsOpen`, `artifactsOpen` (all booleans, default `true`).
- Same writable-computed pattern as `graph-settings.ts` for each field.
- `resetToDefaults()` — restores all to `true`.
- **Duplication**: identical store structure (useLocalStorage + writable computed per field + resetToDefaults) as `graph-settings.ts`.

---

### `stores/graph-settings.ts`

- Pinia store `useGraphSettingsStore`. Persists all graph settings to `localStorage` via `useLocalStorage`.
- State (all persisted): `interactionMode`, `showEdgeLabels`, `layoutDirection`, `layoutAlgorithm`, `scaleWithDependencies`, `typeDifferentiationMode`, `isSidebarExpanded`, `highlightRange`.
- Non-persisted: `searchQuery`, `isSearchOpen`.
- Each state field exposed as a writable `computed` (get/set pattern).
- `config` computed — assembles `LayoutConfig` from individual settings.
- `resetToDefaults()` — restores `DEFAULT_STATE`.
- **Duplication**: `InteractionMode` type alias is re-declared here; it's also declared in `lib/graph-highlighting.ts`.

---

### `stores/graph.ts`

- Pinia store `useGraphStore`. Central state for the deployment model and visual mappings.
- State: `model`, `visibleNodeTypes`, `hiddenRelations`, `shortestPathAnchorNode`, `visibleNodeIds`.
- Palettes: `NODE_COLORBLIND_PALETTE` (5 colors), `EDGE_COLORBLIND_PALETTE` (5 colors), `AVAILABLE_SHAPES` (4 shapes).
- Computed:
  - `relationTypes` — maps relation type names to color + label.
  - `relationTypesHierarchy` — builds tree from `extends` (similar logic to `lib/type-hierarchy.ts`).
  - `relationTypeColorMap` — name→color lookup.
  - `uniqueParentTypes` — sorted list of direct parent types of used component types.
  - `parentTypeColorMap` — parent type → `NodeColorInfo` (palette index + textured flag).
  - `componentTypeColorMap` — component type → color via parent type.
  - `isShapeModeAvailable` — true if ≤4 parent types.
  - `parentTypeShapeMap` / `componentTypeShapeMap` — shape assignment per parent/component type.
- Methods: `setModel`, `clearModel`, `getRelationColor`, `getComponentTypeColor`, `getComponentTypeShape`, `isRelationVisible`, `toggleRelationVisibility`, `setVisibleNodeIds`, `showAllNodes`.
- **Duplication**:
  - `toHumanReadable(name)` — local helper; could be shared.
  - `getDirectParentType` — walks `extends` chain (similar to `getAllAncestorTypes` in `lib/type-hierarchy.ts`).
  - `relationTypesHierarchy` tree-building logic is very similar to `buildTypeHierarchy` in `lib/type-hierarchy.ts`.
  - `isRelationVisible` here is a store method that duplicates `isRelationVisible` from `lib/graph-layout.ts`.
  - Palette-index + textured pattern (`index % palette.length`, `index >= palette.length`) is repeated for both nodes and edges.

---

### `lib/graph-highlighting.ts`

- Graph traversal and highlight computation for interactive modes.
- Types: `InteractionMode` (alias for `LayoutConfig['interactionMode']`), `HighlightResult`.
- Functions:
  - `buildDependencyGraph(model, hiddenRelations)` — builds `dependencies`, `dependents`, `edgeMap` maps from model relations.
  - `computeDependentCounts(model, hiddenRelations)` — transitive dependent count per node (cached DFS); used for node scaling.
  - `collectNodesWithinRange(startNodeId, adjacency, range)` — BFS up to `range` hops; returns nodes, edges, distances.
  - `buildEdgeAwareAdjacency(edgeMap)` — builds successor/predecessor adjacency maps.
  - `computeHighlights(model, selectedNodeId, interactionMode, hiddenRelations, range)` — main highlight entry; dispatches BFS by mode (SUCCESSORS/PREDECESSORS/NEIGHBOURS).
  - `applyNodeHighlights(nodes, highlightedNodeIds, hasSelection)` — maps `highlighted`/`dimmed` onto node data.
  - `applyEdgeHighlights(edges, highlightedEdgeIds, hasSelection)` — same for edges.
  - `computeShortestPaths(model, anchorNodeId, hiddenRelations)` — BFS from anchor, returns path+edges to all reachable nodes.
  - `computeShortestPathHighlights(forwardPaths, reversePaths, hoveredNodeId, anchorNodeId)` — picks shorter of forward/reverse path.
- **Duplication**: `applyNodeHighlights` and `applyEdgeHighlights` are structurally identical (map + spread + `highlighted`/`dimmed` flags). BFS adjacency building in `computeShortestPaths` is similar to `buildEdgeAwareAdjacency`.

---

### `lib/graph-layout.ts`

- Computes Vue Flow node positions and edge data from an EDMM model.
- Constants: `NODE_WIDTH=180`, `NODE_HEIGHT=60`.
- Types: `LayoutDirection`, `LayoutAlgorithm`, `LayoutConfig`, `EdgeData`, `LayoutResult`.
- Functions:
  - `isRelationVisible(relationType, hiddenRelations)` — checks if relation is NOT in hidden list.
  - `computeEdges(model, hiddenRelations)` — maps visible relations to `EdgeData[]`.
  - `runDagreLayout(model, config, hiddenRelations)` — synchronous layout via dagre.
  - `runElkLayout(model, config, nodeScales, hiddenRelations)` — async layout via ELK (layered/force/mrtree).
  - `computeNodeScales(model, config, hiddenRelations)` — scales nodes 1.0–1.5 based on dependent counts.
  - `computeGraphLayout(model, config, hiddenRelations)` — entry point; picks dagre or ELK, returns `LayoutResult`.
- **Duplication**: node-building block (position, data, style with `baseFontSize/baseBorderRadius/basePaddingV/basePaddingH`) is copy-pasted identically in both `runFlatDagreLayout` and `runElkLayout`. `isRelationVisible` call is also repeated inline in both layout functions.

---

### `lib/type-hierarchy.ts`

- Utilities for EDMM component type inheritance trees.
- Interfaces: `ComponentTypeDefinition`, `TypeNode` (name + children).
- Functions:
  - `buildTypeHierarchy(componentTypes)` — builds tree from flat map using `extends` field; treats `'-'` as null.
  - `getAllDescendantTypes(typeName, componentTypes)` — recursive DFS for all subtypes.
  - `getAllAncestorTypes(typeName, componentTypes)` — walks up `extends` chain.
  - `flattenTypeHierarchy(nodes)` — DFS flatten tree to string array.
  - `isTypeVisible(nodeType, visibleTypes, _componentTypes)` — returns true if `visibleTypes` is empty or contains exact match.
- **Note**: `'-'` null-guard is repeated in 3 functions.

---

### `lib/io.ts`

- Defines Zod schemas for the EDMM YAML format and exports parsed TypeScript types.
- **Repeated pattern**: every array-of-records field uses the same `.transform(list => list.reduce(...))` to flatten `Array<Record<K,V>>` into `Record<K,V>`. This transform is copy-pasted ~10 times across `PropertiesSchema`, `RelationTypeSchema`, `ComponentTypeSchema`, `ComponentAssignmentSchema`, `RootRelationAssignmentSchema`, `EdmmSchema`.
- Key exports:
  - `EdmmSchema` — root Zod schema
  - `EdmmDeploymentModel`, `ComponentAssignment`, `RelationAssignment` — inferred types
  - `validateEdmmModel(rawJson)` — parses with Zod, returns `ValidationResult`
  - `parseAndValidateEdmm(yamlContent)` — parses YAML string then validates

---

### `lib/utils.ts`

- Single utility: `cn(...inputs)` — combines `clsx` + `tailwind-merge` for conditional class merging.
- Used throughout UI components for className composition.

---

### `App.vue`

- Root component. Wraps `<RouterView>` in `<TooltipProvider>`.
- Sets document `<head>` (title, description, theme-color, favicon) via `useHead`.
- No custom logic.

---

### `main.ts`

- App entry point. Creates Vue app, sets up: Router (vue-router/auto-routes + layouts), Pinia, i18n, unhead.
- Wires NProgress to router `beforeEach`/`afterEach`.
- No custom logic — pure bootstrap.

---

### `types.ts`

- Minimal: exports only `UserModule` type alias (`(ctx: ViteSSGContext) => void`).
- Used by module setup files (pinia, nprogress).

---
