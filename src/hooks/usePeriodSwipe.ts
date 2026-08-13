import { useEffect, useRef, type RefObject } from 'react'

const THRESHOLD = 48
const AXIS_LOCK = 10
const IGNORE = '.expense-swipe-row, .expense-form, .expense-add-toggle, .period-picker'

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function ignoredTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(IGNORE))
}

function applyPane(el: HTMLElement, x: number, animate: boolean, width: number) {
  el.style.transition = animate
    ? 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease'
    : 'none'
  el.style.transform = `translate3d(${x}px, 0, 0)`
  el.style.opacity = String(1 - Math.min(Math.abs(x) / Math.max(width, 1), 1) * 0.28)
}

export function usePeriodSwipe(
  hostRef: RefObject<HTMLElement | null>,
  paneRef: RefObject<HTMLElement | null>,
  {
    enabled,
    onShift,
  }: {
    enabled: boolean
    onShift: (direction: -1 | 1) => void
  }
) {
  const onShiftRef = useRef(onShift)
  onShiftRef.current = onShift

  useEffect(() => {
    const host = hostRef.current
    const pane = paneRef.current
    if (!host || !pane || !enabled) return

    let startX = 0
    let startY = 0
    let tracking = false
    let axis: 'x' | 'y' | null = null
    let animating = false
    let activePointer: 'touch' | 'mouse' | null = null
    let mouseId: number | null = null
    let clickBlock: ((event: MouseEvent) => void) | null = null
    let clickTimer = 0

    const armClickBlock = () => {
      if (clickBlock) host.removeEventListener('click', clickBlock, true)
      window.clearTimeout(clickTimer)
      clickBlock = (click) => {
        click.preventDefault()
        click.stopPropagation()
      }
      host.addEventListener('click', clickBlock, true)
      clickTimer = window.setTimeout(() => {
        if (clickBlock) host.removeEventListener('click', clickBlock, true)
        clickBlock = null
      }, 450)
    }

    const width = () => host.getBoundingClientRect().width

    const resetPane = () => {
      applyPane(pane, 0, false, width())
    }

    const commit = (direction: -1 | 1) => {
      if (animating) return
      if (prefersReducedMotion()) {
        resetPane()
        onShiftRef.current(direction)
        return
      }

      animating = true
      let settled = false
      const w = width()
      const outX = direction === 1 ? -w : w
      const inX = direction === 1 ? w * 0.38 : -w * 0.38
      applyPane(pane, outX, true, w)

      const finish = () => {
        if (settled) return
        settled = true
        pane.removeEventListener('transitionend', finish)
        onShiftRef.current(direction)
        applyPane(pane, inX, false, w)
        pane.getBoundingClientRect()
        requestAnimationFrame(() => {
          applyPane(pane, 0, true, w)
          window.setTimeout(() => {
            animating = false
            resetPane()
          }, 300)
        })
      }

      pane.addEventListener('transitionend', finish)
      window.setTimeout(finish, 320)
    }

    const onStart = (event: TouchEvent | PointerEvent, kind: 'touch' | 'mouse') => {
      if (animating) return
      if (kind === 'mouse' && 'pointerType' in event && event.pointerType !== 'mouse') return
      if (ignoredTarget(event.target)) return
      const x = 'changedTouches' in event ? (event.changedTouches[0]?.clientX ?? 0) : event.clientX
      const y = 'changedTouches' in event ? (event.changedTouches[0]?.clientY ?? 0) : event.clientY
      tracking = true
      axis = null
      activePointer = kind
      startX = x
      startY = y
      applyPane(pane, 0, false, width())
      if (kind === 'mouse' && 'pointerId' in event) {
        mouseId = event.pointerId
        host.setPointerCapture(event.pointerId)
      }
    }

    const onMove = (event: TouchEvent | PointerEvent, kind: 'touch' | 'mouse') => {
      if (!tracking || activePointer !== kind || animating) return
      const x =
        'changedTouches' in event
          ? (event.touches[0]?.clientX ?? startX)
          : event.clientX
      const y =
        'changedTouches' in event
          ? (event.touches[0]?.clientY ?? startY)
          : event.clientY
      const dx = x - startX
      const dy = y - startY

      if (axis == null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return
        axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'x' : 'y'
        if (axis === 'y') {
          tracking = false
          if (mouseId != null) {
            host.releasePointerCapture(mouseId)
            mouseId = null
          }
        }
      }
      if (axis !== 'x') return

      event.preventDefault()
      const w = width()
      const resisted = Math.max(-w, Math.min(w, dx * 0.88))
      applyPane(pane, resisted, false, w)
    }

    const onEnd = (event: TouchEvent | PointerEvent, kind: 'touch' | 'mouse') => {
      if (!tracking || activePointer !== kind) return
      tracking = false
      activePointer = null
      if (mouseId != null) {
        if (host.hasPointerCapture(mouseId)) host.releasePointerCapture(mouseId)
        mouseId = null
      }
      const x =
        'changedTouches' in event
          ? (event.changedTouches[0]?.clientX ?? startX)
          : event.clientX
      const dx = x - startX
      const locked = axis
      axis = null

      if (locked !== 'x') {
        resetPane()
        return
      }

      event.preventDefault()
      armClickBlock()
      if (Math.abs(dx) >= THRESHOLD) commit(dx < 0 ? 1 : -1)
      else applyPane(pane, 0, true, width())
    }

    const onTouchStart = (event: TouchEvent) => onStart(event, 'touch')
    const onTouchMove = (event: TouchEvent) => onMove(event, 'touch')
    const onTouchEnd = (event: TouchEvent) => onEnd(event, 'touch')
    const onPointerDown = (event: PointerEvent) => onStart(event, 'mouse')
    const onPointerMove = (event: PointerEvent) => onMove(event, 'mouse')
    const onPointerUp = (event: PointerEvent) => onEnd(event, 'mouse')

    host.addEventListener('touchstart', onTouchStart, { passive: true })
    host.addEventListener('touchmove', onTouchMove, { passive: false })
    host.addEventListener('touchend', onTouchEnd)
    host.addEventListener('touchcancel', onTouchEnd)
    host.addEventListener('pointerdown', onPointerDown)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerup', onPointerUp)
    host.addEventListener('pointercancel', onPointerUp)

    return () => {
      host.removeEventListener('touchstart', onTouchStart)
      host.removeEventListener('touchmove', onTouchMove)
      host.removeEventListener('touchend', onTouchEnd)
      host.removeEventListener('touchcancel', onTouchEnd)
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', onPointerUp)
      host.removeEventListener('pointercancel', onPointerUp)
      if (clickBlock) host.removeEventListener('click', clickBlock, true)
      window.clearTimeout(clickTimer)
      resetPane()
    }
  }, [enabled, hostRef, paneRef])
}
