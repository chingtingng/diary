import { useEffect, useState } from 'react'

/**
 * Extra room for mobile browser chrome that sits inside the visual viewport
 * while typing (notably Safari’s floating URL pill above the keyboard).
 */
export const FLOATING_CHROME_BUFFER_PX = 80

/** How long to keep polling after focus while iOS finishes keyboard + VV settle. */
const FOCUS_SETTLE_MS = 800
const FOCUS_POLL_MS = 50

function readBottomInset(active: boolean): number {
  if (!active) return 0

  const vv = window.visualViewport
  const occluded = vv
    ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    : 0

  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches

  // Touch editing: always leave a cushion for floating browser UI.
  // When the keyboard occludes the layout viewport, include that too.
  const chromeBuffer = coarsePointer ? FLOATING_CHROME_BUFFER_PX : 0
  return Math.round(occluded + chromeBuffer)
}

/**
 * Bottom inset (px) to keep focused journal text above the on-screen keyboard
 * and floating mobile browser chrome.
 */
export function useKeyboardBottomInset(active: boolean): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (!active) {
      setInset(0)
      return
    }

    const update = () => setInset(readBottomInset(true))
    update()

    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    // Safari often moves the visual viewport after focus without a reliable
    // single event; poll briefly while the keyboard animation settles.
    const poll = window.setInterval(update, FOCUS_POLL_MS)
    const stopPoll = window.setTimeout(() => window.clearInterval(poll), FOCUS_SETTLE_MS)

    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.clearInterval(poll)
      window.clearTimeout(stopPoll)
    }
  }, [active])

  return inset
}
