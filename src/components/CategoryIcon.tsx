import type { ExpenseCategoryId } from '../types/expense'
import { CATEGORY_COLORS } from '../lib/expensePeriods'

interface CategoryIconProps {
  category: ExpenseCategoryId
  size?: number
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Glyph({ category }: { category: ExpenseCategoryId }) {
  switch (category) {
    case 'food':
      // Burger — Restaurants & Bars
      return (
        <>
          <path d="M5 10.5c0-3.2 3.1-5.5 7-5.5s7 2.3 7 5.5H5Z" {...stroke} />
          <path d="M5 12.5h14" {...stroke} />
          <path d="M5.5 14.5h13" {...stroke} />
          <path d="M5 16.5c1.2 2.8 3.8 4 7 4s5.8-1.2 7-4H5Z" {...stroke} />
        </>
      )
    case 'transport':
      // Car / taxi
      return (
        <path
          d="M5 12h14l-1.1-3.9A2 2 0 0 0 16 6.5H8a2 2 0 0 0-1.9 1.6L5 12Zm0 0v4.5h1.6a1.6 1.6 0 0 0 3.2 0h4.4a1.6 1.6 0 0 0 3.2 0H19V12M7.8 15.2h.01M16.2 15.2h.01M7 9.2h10"
          {...stroke}
        />
      )
    case 'travel':
      // Airplane
      return (
        <path
          d="M10.2 12.8 4.5 14.2l.8-2.1 4.2-1.2L7.2 5.8l2-.5 3.3 5.2 5.4-1.5a1.6 1.6 0 1 1 .8 3.1l-5.4 1.5 1.5 5.8-2 .5-2.6-5.1Z"
          {...stroke}
        />
      )
    case 'hobbies':
      // Microphone — Entertainment
      return (
        <>
          <path d="M12 3.8a2.6 2.6 0 0 0-2.6 2.6v5a2.6 2.6 0 1 0 5.2 0v-5A2.6 2.6 0 0 0 12 3.8Z" {...stroke} />
          <path d="M7.2 11.2a4.8 4.8 0 0 0 9.6 0M12 16v3.2M9 19.2h6" {...stroke} />
        </>
      )
    case 'shopping':
      // Shopping bags
      return (
        <>
          <path
            d="M7.2 8.5h7.6l-.7 10.2a1.4 1.4 0 0 1-1.4 1.3H9.3a1.4 1.4 0 0 1-1.4-1.3L7.2 8.5Z"
            {...stroke}
          />
          <path d="M9.4 8.5V7.2a2.2 2.2 0 0 1 4.4 0v1.3" {...stroke} />
          <path
            d="M11.5 7.8h5.8l1.1 9.4a1.3 1.3 0 0 1-1.3 1.5h-2.2"
            {...stroke}
          />
          <path d="M13.6 7.8V6.8a1.8 1.8 0 0 1 3.2-1.1" {...stroke} />
        </>
      )
    case 'health':
      // Tooth — Healthcare
      return (
        <path
          d="M8.2 4.8c1.1-.7 2.3-1 3.8-1s2.7.3 3.8 1c1 .7 1.5 1.8 1.4 3.1-.1 1.6-.8 2.7-1.4 4.2-.5 1.2-.8 2.4-1.1 3.7-.3 1.3-1.1 2.6-2.7 2.6s-2.4-1.3-2.7-2.6c-.3-1.3-.6-2.5-1.1-3.7-.6-1.5-1.3-2.6-1.4-4.2-.1-1.3.4-2.4 1.4-3.1Z"
          {...stroke}
        />
      )
    default:
      // Waving hand — Other
      return (
        <path
          d="M8.2 11.2V7.4a1.1 1.1 0 0 1 2.2 0v2.6m0-1.4V5.6a1.1 1.1 0 0 1 2.2 0v5.2m0-3.8V6.2a1.1 1.1 0 1 1 2.2 0v5.4m0-2.6c0-.6.5-1.1 1.1-1.1s1.1.5 1.1 1.1v4.2c0 2.8-1.8 5.2-4.8 5.2-2.2 0-3.7-1-4.7-2.5L6 13.4a1.3 1.3 0 0 1 1.9-1.8l.3.3"
          {...stroke}
        />
      )
  }
}

export function CategoryIcon({ category, size = 40 }: CategoryIconProps) {
  const color = CATEGORY_COLORS[category]
  return (
    <span
      className="category-icon"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 16%, white)`,
        color,
      }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        <Glyph category={category} />
      </svg>
    </span>
  )
}
