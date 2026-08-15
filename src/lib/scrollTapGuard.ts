/** Finger movement beyond this is a scroll/drag, not a tap. Slightly above iOS tap slop. */
const TAP_SLOP = 12

/**
 * Controls that should not activate after the finger has started scrolling.
 * Includes iOS haptic switch overlays injected by @haptics/core.
 */
const INTERACTIVE =
  'input, textarea, select, button, a, [data-haptic], [data-haptic-overlay], [contenteditable="true"], [role="button"]'

const CLICK_BLOCK_MS = 80

/**
 * App-wide: let a finger-drag scroll instead of activating the control it started on.
 *
 * Large list rows (policies, expenses, journal pages, …) use `[data-haptic]`, and on iOS
 * @haptics/core covers them with an invisible checkbox-switch overlay. Touches land on that
 * overlay, so a scroll that begins on a row is treated as a tap and opens the item.
 *
 * This guard:
 * 1. Treats movement past tap slop as a scroll
 * 2. Releases the haptic overlay (`pointer-events: none`) so the page can keep scrolling
 * 3. Suppresses the synthetic click / haptic re-dispatch that would otherwise fire on touchend
 */
export function installScrollTapGuard() {
  if (typeof document === 'undefined') return () => {}

  let startX = 0
  let startY = 0
  let moved = false
  let activeOverlay: HTMLElement | null = null
  let clickBlock: ((event: MouseEvent) => void) | null = null
  let clickTimer = 0

  const disarmClickBlock = () => {
    if (clickBlock) document.removeEventListener('click', clickBlock, true)
    clickBlock = null
    window.clearTimeout(clickTimer)
    clickTimer = 0
  }

  const armClickBlock = () => {
    disarmClickBlock()
    clickBlock = (click) => {
      click.preventDefault()
      click.stopPropagation()
      // Beat the haptic overlay's bubble handler that re-dispatches click onto the host.
      click.stopImmediatePropagation()
      disarmClickBlock()
    }
    document.addEventListener('click', clickBlock, true)
    // Only swallow the synthetic click from this scroll gesture — keep the
    // window short so the next real tap still gets haptics + activation.
    clickTimer = window.setTimeout(disarmClickBlock, CLICK_BLOCK_MS)
  }

  const restoreOverlay = (overlay: HTMLElement | null) => {
    if (!overlay) return
    if (overlay.style.pointerEvents === 'none') overlay.style.pointerEvents = ''
  }

  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    startX = touch.clientX
    startY = touch.clientY
    moved = false
    restoreOverlay(activeOverlay)
    activeOverlay = null

    const target = event.target
    if (!(target instanceof Element)) return
    const overlay = target.closest('[data-haptic-overlay]')
    if (overlay instanceof HTMLElement) activeOverlay = overlay
  }

  const onMove = (event: TouchEvent) => {
    if (moved) return
    const touch = event.touches[0]
    if (!touch) return
    if (Math.max(Math.abs(touch.clientX - startX), Math.abs(touch.clientY - startY)) <= TAP_SLOP) {
      return
    }
    moved = true

    // Drop the overlay from hit-testing so iOS continues the scroll gesture
    // instead of committing a switch toggle / host click.
    if (activeOverlay) activeOverlay.style.pointerEvents = 'none'

    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      active.matches('input:not([data-haptic-overlay]), textarea, select, [contenteditable="true"]')
    ) {
      active.blur()
    }
  }

  const onEnd = (event: TouchEvent) => {
    const wasMoved = moved
    const overlay = activeOverlay
    moved = false
    activeOverlay = null

    // Restore after this gesture's click (if any) has been decided.
    window.setTimeout(() => restoreOverlay(overlay), 0)

    if (!wasMoved) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.date-field-calendar')) return
    if (!target.closest(INTERACTIVE)) return

    // Suppress the click without stopPropagation — swipe rows and other
    // gesture handlers still need to see touchend.
    event.preventDefault()
    armClickBlock()
  }

  document.addEventListener('touchstart', onStart, { passive: true, capture: true })
  document.addEventListener('touchmove', onMove, { passive: true, capture: true })
  document.addEventListener('touchend', onEnd, { capture: true, passive: false })
  document.addEventListener('touchcancel', onEnd, { capture: true, passive: false })

  return () => {
    disarmClickBlock()
    restoreOverlay(activeOverlay)
    activeOverlay = null
    document.removeEventListener('touchstart', onStart, true)
    document.removeEventListener('touchmove', onMove, true)
    document.removeEventListener('touchend', onEnd, true)
    document.removeEventListener('touchcancel', onEnd, true)
  }
}
