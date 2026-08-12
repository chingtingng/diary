/** Crisp overflow-menu glyph — SVG circles avoid squashed CSS/unicode dots. */
export function MenuDots() {
  return (
    <svg
      className="menu-dots"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      focusable="false"
    >
      <circle cx="2.5" cy="7" r="1.5" fill="currentColor" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      <circle cx="11.5" cy="7" r="1.5" fill="currentColor" />
    </svg>
  )
}
