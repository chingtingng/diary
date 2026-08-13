export type HapticKind = 'light' | 'select' | 'success' | 'error'

function vibratePattern(kind: HapticKind): number | number[] {
  switch (kind) {
    case 'select':
    case 'light':
      return 12
    case 'success':
      return [12, 40, 18]
    case 'error':
      return [16, 40, 16, 40, 24]
  }
}

function tapIosSwitch() {
  const label = document.createElement('label')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;'
  label.appendChild(input)
  document.body.appendChild(label)
  label.click()
  label.remove()
}

function iosBurst(kind: HapticKind) {
  const times = kind === 'error' ? 3 : kind === 'success' ? 2 : 1
  for (let i = 0; i < times; i++) {
    window.setTimeout(tapIosSwitch, i * 55)
  }
}

export function haptic(kind: HapticKind = 'light') {
  if (typeof window === 'undefined') return

  try {
    if (typeof navigator.vibrate === 'function') {
      const pulsed = navigator.vibrate(vibratePattern(kind))
      if (pulsed) return
    }
  } catch {
    /* ignore */
  }

  iosBurst(kind)
}

export function installHapticClicks() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return
      const target = (event.target as HTMLElement | null)?.closest?.('[data-haptic]')
      if (!(target instanceof HTMLElement)) return
      const kind = (target.getAttribute('data-haptic') || 'light') as HapticKind
      haptic(kind)
    },
    { capture: true, passive: true }
  )
}
