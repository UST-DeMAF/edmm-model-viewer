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
/**
 * Check if the currently focused element is an input field.
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement
  if (!activeElement)
    return false

  const tagName = activeElement.tagName.toLowerCase()
  return (
    tagName === 'input'
    || tagName === 'textarea'
    || activeElement.hasAttribute('contenteditable')
  )
}

export function useInteractionModeKeybinds() {
  const store = useGraphSettingsStore()

  onKeyStroke('n', () => {
    if (isInputFocused())
      return
    store.interactionMode = 'NORMAL'
  })

  onKeyStroke('s', () => {
    if (isInputFocused())
      return
    store.interactionMode = 'HIGHLIGHT_SUCCESSORS'
  })

  onKeyStroke('p', () => {
    if (isInputFocused())
      return
    store.interactionMode = 'HIGHLIGHT_PREDECESSORS'
  })

  onKeyStroke('b', () => {
    if (isInputFocused())
      return
    store.interactionMode = 'HIGHLIGHT_NEIGHBOURS'
  })

  onKeyStroke('r', () => {
    if (isInputFocused())
      return
    store.interactionMode = 'SHORTEST_PATH'
  })
}
