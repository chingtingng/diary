import { useEffect, type RefObject } from 'react'

/** Finger movement beyond this is a scroll/drag, not a tap. Matches iOS tap slop. */
const TAP_SLOP = 12

/**
 * Within a form/card root, blur focused fields once the finger starts scrolling.
 * Click suppression for list rows / haptic overlays is handled app-wide by
 * `installScrollTapGuard` in main.tsx.
 */
export function useAllowFormScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const root = ref.current
    if (!root) return

    let startX = 0
    let startY = 0

    const onStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX ?? 0
      startY = event.touches[0]?.clientY ?? 0
    }

    const onMove = (event: TouchEvent) => {
      const x = event.touches[0]?.clientX ?? startX
      const y = event.touches[0]?.clientY ?? startY
      if (Math.max(Math.abs(x - startX), Math.abs(y - startY)) <= TAP_SLOP) return
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        root.contains(active) &&
        !active.hasAttribute('data-haptic-overlay')
      ) {
        active.blur()
      }
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: true })

    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
    }
  }, [ref, enabled])
}
