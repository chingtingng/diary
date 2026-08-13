import { useEffect, type RefObject } from 'react'

const INTERACTIVE =
  'input, textarea, select, button, [data-haptic], [contenteditable="true"]'

/** Finger movement beyond this is a scroll/drag, not a tap. Matches iOS tap slop. */
const TAP_SLOP = 10

/**
 * Let a finger-drag scroll instead of activating the control it started on.
 * iOS otherwise treats any touch that begins on an input/button as a tap —
 * including after a vertical scroll that ends on a transaction row.
 */
export function useAllowFormScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const root = ref.current
    if (!root) return

    let startX = 0
    let startY = 0
    let moved = false
    let clickBlock: ((event: MouseEvent) => void) | null = null
    let clickTimer = 0

    const disarmClickBlock = () => {
      if (clickBlock) root.removeEventListener('click', clickBlock, true)
      clickBlock = null
      window.clearTimeout(clickTimer)
      clickTimer = 0
    }

    const armClickBlock = () => {
      disarmClickBlock()
      clickBlock = (click) => {
        click.preventDefault()
        click.stopPropagation()
        disarmClickBlock()
      }
      root.addEventListener('click', clickBlock, true)
      // Only swallow the synthetic click from this gesture, not the next tap.
      clickTimer = window.setTimeout(disarmClickBlock, 80)
    }

    const onStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX ?? 0
      startY = event.touches[0]?.clientY ?? 0
      moved = false
    }

    const onMove = (event: TouchEvent) => {
      const x = event.touches[0]?.clientX ?? startX
      const y = event.touches[0]?.clientY ?? startY
      if (Math.max(Math.abs(x - startX), Math.abs(y - startY)) <= TAP_SLOP) return
      moved = true
      const active = document.activeElement
      if (active instanceof HTMLElement && root.contains(active)) active.blur()
    }

    const onEnd = (event: TouchEvent) => {
      if (!moved) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('.date-field-calendar')) return
      if (!target.closest(INTERACTIVE)) return
      event.preventDefault()
      armClickBlock()
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: true })
    root.addEventListener('touchend', onEnd, { capture: true, passive: false })

    return () => {
      disarmClickBlock()
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd, true)
    }
  }, [ref, enabled])
}
