import { useEffect, type RefObject } from 'react'

const INTERACTIVE =
  'input, textarea, select, button, [data-haptic], [contenteditable="true"]'

/**
 * Let a finger-drag scroll the form instead of focusing the control it started on.
 * iOS otherwise treats any touch that begins on an input/button as a tap.
 */
export function useAllowFormScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const root = ref.current
    if (!root) return

    let startY = 0
    let moved = false

    const onStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0
      moved = false
    }

    const onMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? startY
      if (Math.abs(y - startY) <= 10) return
      moved = true
      const active = document.activeElement
      if (active instanceof HTMLElement && root.contains(active)) active.blur()
    }

    const onEnd = (event: TouchEvent) => {
      if (!moved) return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (target.closest('.date-field-calendar')) return
      if (target.closest(INTERACTIVE)) event.preventDefault()
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: true })
    root.addEventListener('touchend', onEnd, { capture: true, passive: false })

    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd, true)
    }
  }, [ref, enabled])
}
