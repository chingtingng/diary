import { PRESETS, attachHaptics, schedulePattern, type HapticPattern } from '@haptics/core'

export type HapticKind = 'light' | 'select' | 'success' | 'error'

const KIND_TO_PRESET: Record<HapticKind, keyof typeof PRESETS> = {
  light: 'impact-light',
  select: 'selection',
  success: 'success',
  error: 'error',
}

function patternFor(name: string): HapticPattern | undefined {
  if (name in PRESETS) return PRESETS[name as keyof typeof PRESETS]
  if (name in KIND_TO_PRESET) return PRESETS[KIND_TO_PRESET[name as HapticKind]]
  return PRESETS.selection
}

/** Imperative haptic for gestures (swipe, etc.). Best-effort on iOS 26.5+. */
export function haptic(kind: HapticKind = 'light') {
  if (typeof window === 'undefined') return
  const pattern = patternFor(kind)
  if (!pattern) return
  schedulePattern(pattern)
}

/**
 * Wire native haptics for every `[data-haptic]` control.
 * On iPhone Safari, overlays a real checkbox-switch so the user's tap
 * produces a Taptic tick (works through iOS 26.5+).
 */
export function installHapticClicks() {
  if (typeof document === 'undefined') return
  attachHaptics({ getPattern: patternFor })
}
