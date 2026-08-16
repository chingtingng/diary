/**
 * Keep journal caret clear of iOS Safari keyboard chrome / floating URL pill.
 *
 * Safari often scrolls the visual viewport so layout-occlusion math is ~0 while
 * the caret still sits under the floating URL bar. Measure the textarea’s
 * overlap with the safe visual area and apply that as padding-bottom so the
 * caret can scroll above it.
 */

export const CARET_SAFE_BOTTOM_GAP_PX = 120

function isCoarsePointer(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

function safeBottomY(): number {
  const gap = isCoarsePointer() ? CARET_SAFE_BOTTOM_GAP_PX : 12
  const vv = window.visualViewport
  if (vv) return vv.offsetTop + vv.height - gap
  return window.innerHeight - gap
}

/** Pixels of the textarea that sit below the safe caret line. */
export function measureTextareaBottomInset(el: HTMLTextAreaElement): number {
  const vv = window.visualViewport
  const overlap = Math.max(0, Math.ceil(el.getBoundingClientRect().bottom - safeBottomY()))

  if (!isCoarsePointer()) return overlap

  // When the keyboard is up, always keep enough padding to scroll above the
  // floating URL pill — even if Safari’s VV scroll makes layout-occlusion ~0.
  const keyboardLikelyOpen = Boolean(vv && vv.height < window.innerHeight * 0.85)
  return Math.max(overlap, keyboardLikelyOpen ? CARET_SAFE_BOTTOM_GAP_PX : 0)
}

function caretOffsetTop(el: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(el)
  const mirror = document.createElement('div')
  const props = [
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'boxSizing',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'paddingTop',
    'paddingRight',
    'paddingLeft',
    'textIndent',
    'textTransform',
    'whiteSpace',
    'wordSpacing',
    'wordBreak',
    'overflowWrap',
  ] as const

  for (const prop of props) {
    mirror.style[prop] = style[prop]
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.width = `${el.clientWidth}px`
  mirror.style.height = 'auto'
  mirror.style.paddingBottom = '0px'
  mirror.textContent = el.value.slice(0, el.selectionEnd)

  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop + (Number.parseFloat(style.paddingTop) || 0)
  document.body.removeChild(mirror)
  return top
}

/**
 * Apply bottom padding for the current visual overlap, then scroll so the caret
 * sits above Safari’s floating chrome.
 */
export function syncJournalCaret(el: HTMLTextAreaElement): void {
  const inset = measureTextareaBottomInset(el)
  const nextPadding = inset > 0 ? `${inset}px` : ''
  if (el.style.paddingBottom !== nextPadding) {
    el.style.paddingBottom = nextPadding
  }

  const style = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight) || 28
  const atEnd = el.selectionEnd >= el.value.length

  if (atEnd) {
    // With paddingBottom === overlap, max scroll parks the last line on the safe line.
    el.scrollTop = el.scrollHeight
    return
  }

  const caretTop = caretOffsetTop(el)
  const caretBottomInViewport =
    el.getBoundingClientRect().top + (caretTop - el.scrollTop) + lineHeight
  const safeBottom = safeBottomY()
  if (caretBottomInViewport > safeBottom) {
    el.scrollTop += caretBottomInViewport - safeBottom
  }
}

export function clearJournalCaretInset(el: HTMLTextAreaElement | null): void {
  if (el) el.style.paddingBottom = ''
}
