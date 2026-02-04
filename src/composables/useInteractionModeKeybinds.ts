import { onKeyStroke } from '@vueuse/core'
import { useGraphSettingsStore } from '~/stores/graph-settings'

/**
 * Composable to register keyboard shortcuts for interaction mode switching.
 *
 * Keybinds:
 * - N: Normal mode
 * - S: Highlight Successors
 * - P: Highlight Predecessors
 * - B: Highlight Neighbours (Both directions)
 * - R: Shortest Path (Route)
 */
export function useInteractionModeKeybinds() {
    const store = useGraphSettingsStore()

    onKeyStroke('n', () => {
        store.interactionMode = 'NORMAL'
    })

    onKeyStroke('s', () => {
        store.interactionMode = 'HIGHLIGHT_DIRECT_SUCCESSORS'
    })

    onKeyStroke('p', () => {
        store.interactionMode = 'HIGHLIGHT_DIRECT_PREDECESSORS'
    })

    onKeyStroke('b', () => {
        store.interactionMode = 'HIGHLIGHT_NEIGHBOURS'
    })

    onKeyStroke('r', () => {
        store.interactionMode = 'SHORTEST_PATH'
    })
}
