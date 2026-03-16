import { onMounted, onUnmounted } from 'vue'
import { useGraphSettingsStore } from '~/stores/graph-settings'

const HIGHLIGHT_MODES = ['HIGHLIGHT_SUCCESSORS', 'HIGHLIGHT_PREDECESSORS', 'HIGHLIGHT_NEIGHBOURS']
const MAX_RANGE = 5

/**
 * Composable to allow adjusting the highlight range via Shift + mouse wheel scroll.
 *
 * - Shift + Scroll Up: Increase range (1 → 2 → ... → 5 → ∞)
 * - Shift + Scroll Down: Decrease range (∞ → 5 → ... → 1)
 *
 * Only active when a highlighting interaction mode is selected.
 */
export function useHighlightRangeScroll() {
  const store = useGraphSettingsStore()

  function handleWheel(event: WheelEvent) {
    // Only act when Shift is held and a highlight mode is active
    if (!event.shiftKey)
      return
    if (!HIGHLIGHT_MODES.includes(store.interactionMode))
      return

    // Prevent default scroll and stop vue-flow from zooming
    event.preventDefault()
    event.stopPropagation()

    const current = store.highlightRange
    // deltaY > 0 = scroll down = decrease range, deltaY < 0 = scroll up = increase range
    if (event.deltaY < 0) {
      // Increase range
      if (current === null) {
        // Already unlimited, do nothing
        return
      }
      if (current >= MAX_RANGE)
        store.highlightRange = null // Go to unlimited
      else
        store.highlightRange = current + 1
    }
    else if (event.deltaY > 0) {
      // Decrease range
      if (current === null)
        store.highlightRange = MAX_RANGE // Come back from unlimited
      else if (current > 1)
        store.highlightRange = current - 1
      // At 1, do nothing (minimum)
    }
  }

  onMounted(() => {
    // Use capture phase so we intercept before vue-flow's zoom handler
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
  })

  onUnmounted(() => {
    window.removeEventListener('wheel', handleWheel, { capture: true })
  })
}
