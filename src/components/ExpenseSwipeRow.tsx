import { useEffect, useRef, useState, type ReactNode } from 'react'
import { haptic } from '../lib/haptics'

const REVEAL = 40
const OPEN_AT = 20
const AXIS_LOCK = 12

interface ExpenseSwipeRowProps {
  revealed: boolean
  onRevealedChange: (open: boolean) => void
  onDelete: () => void | Promise<void>
  children: ReactNode
}

export function ExpenseSwipeRow({
  revealed,
  onRevealedChange,
  onDelete,
  children,
}: ExpenseSwipeRowProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const onRevealedChangeRef = useRef(onRevealedChange)
  onRevealedChangeRef.current = onRevealedChange
  const offsetRef = useRef(revealed ? -REVEAL : 0)
  const dragging = useRef(false)
  const axis = useRef<'x' | 'y' | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const crossed = useRef(false)
  const suppressClick = useRef(false)
  const mouseId = useRef<number | null>(null)
  const [busy, setBusy] = useState(false)

  const setOffset = (value: number, animate: boolean) => {
    const next = Math.max(-REVEAL, Math.min(0, value))
    offsetRef.current = next
    const front = frontRef.current
    if (!front) return
    front.style.transition = animate ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    front.style.transform = `translate3d(${next}px, 0, 0)`
  }

  useEffect(() => {
    if (dragging.current) return
    setOffset(revealed ? -REVEAL : 0, true)
  }, [revealed])

  useEffect(() => {
    const root = rootRef.current
    const front = frontRef.current
    if (!root || !front) return

    const coords = (event: TouchEvent | PointerEvent) => {
      if ('touches' in event && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY }
      }
      if ('changedTouches' in event) {
        const touch = event.changedTouches[0]
        return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 }
      }
      return { x: event.clientX, y: event.clientY }
    }

    const onStart = (event: TouchEvent | PointerEvent) => {
      if ('pointerType' in event && event.pointerType !== 'mouse') return
      const { x, y } = coords(event)
      dragging.current = true
      axis.current = null
      crossed.current = false
      suppressClick.current = false
      startX.current = x
      startY.current = y
      startOffset.current = offsetRef.current
      setOffset(offsetRef.current, false)
      if ('pointerId' in event && event.pointerType === 'mouse') {
        mouseId.current = event.pointerId
        root.setPointerCapture(event.pointerId)
      }
    }

    const onMove = (event: TouchEvent | PointerEvent) => {
      if (!dragging.current) return
      if ('pointerType' in event && event.pointerType !== 'mouse') return
      const { x, y } = coords(event)
      const dx = x - startX.current
      const dy = y - startY.current

      if (axis.current == null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return
        axis.current = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y'
        // Any drag past tap slop is a scroll/swipe, not a tap into the expense.
        suppressClick.current = true
        if (axis.current === 'y' && mouseId.current != null) {
          if (root.hasPointerCapture(mouseId.current)) root.releasePointerCapture(mouseId.current)
          mouseId.current = null
        }
      }
      if (axis.current !== 'x') return

      event.preventDefault()
      event.stopPropagation()
      const next = startOffset.current + dx
      if (!crossed.current && next <= -OPEN_AT) {
        crossed.current = true
        haptic('select')
      }
      setOffset(next, false)
    }

    const onEnd = (event: TouchEvent | PointerEvent) => {
      if (!dragging.current) return
      if ('pointerType' in event && event.pointerType !== 'mouse') return
      dragging.current = false
      if (mouseId.current != null) {
        if (root.hasPointerCapture(mouseId.current)) root.releasePointerCapture(mouseId.current)
        mouseId.current = null
      }
      if (axis.current === 'x') {
        event.preventDefault()
        event.stopPropagation()
        const open = offsetRef.current <= -OPEN_AT
        setOffset(open ? -REVEAL : 0, true)
        onRevealedChangeRef.current(open)
      } else if (suppressClick.current) {
        event.preventDefault()
      }
      axis.current = null
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick.current) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick.current = false
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd)
    root.addEventListener('touchcancel', onEnd)
    root.addEventListener('pointerdown', onStart)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onEnd)
    root.addEventListener('pointercancel', onEnd)
    front.addEventListener('click', onClickCapture, true)

    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
      root.removeEventListener('pointerdown', onStart)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onEnd)
      root.removeEventListener('pointercancel', onEnd)
      front.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  const handleDelete = async () => {
    if (busy) return
    setBusy(true)
    haptic('error')
    try {
      await onDelete()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="expense-swipe-row">
      <button
        type="button"
        className="expense-swipe-delete"
        aria-label="Delete expense"
        disabled={busy}
        onClick={handleDelete}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
          <path
            fill="currentColor"
            d="M9.5 3A1.5 1.5 0 0 0 8 4.5V6H5a1 1 0 1 0 0 2h1.05l.72 11.08A2.5 2.5 0 0 0 9.26 21.5h5.48a2.5 2.5 0 0 0 2.49-2.42L17.95 8H19a1 1 0 1 0 0-2h-3V4.5A1.5 1.5 0 0 0 14.5 3h-5Zm1 3h3V5h-3v1Zm-.25 4.25a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5a.75.75 0 0 1 .75-.75Z"
          />
        </svg>
      </button>
      <div ref={frontRef} className="expense-swipe-front">
        {children}
      </div>
    </div>
  )
}
