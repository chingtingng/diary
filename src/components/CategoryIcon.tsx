import type { ExpenseCategoryId } from '../types/expense'
import { CATEGORY_COLORS } from '../lib/expensePeriods'

interface CategoryIconProps {
  category: ExpenseCategoryId
  size?: number
}

function Glyph({ category }: { category: ExpenseCategoryId }) {
  switch (category) {
    case 'food':
      return (
        <path
          d="M8 4v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V4M10 13v7M14 4c0 2.5 1.5 4 1.5 6.5V20M15.5 4c1 0 2.5 1 2.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'transport':
      return (
        <path
          d="M5 11h14l-1.2-4.2A2 2 0 0 0 15.9 5H8.1a2 2 0 0 0-1.9 1.8L5 11Zm0 0v5h1.5a1.5 1.5 0 0 0 3 0h5a1.5 1.5 0 0 0 3 0H19v-5M7.5 14.5h.01M16.5 14.5h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'travel':
      return (
        <path
          d="M3.5 13.5 10 12l3.5-7.5L15 9l5.5 1.5L15 12l-1.5 5.5L10 14l-6.5 2 1.5-2.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'home':
      return (
        <path
          d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-7.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'shopping':
      return (
        <path
          d="M6 8h12l-1 11H7L6 8Zm2-3h8l1 3H7l1-3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    case 'health':
      return (
        <path
          d="M12 5v14M5 12h14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )
    case 'fun':
      return (
        <path
          d="M7 10c0-1.5 1.2-3 3-3 .8 0 1.5.3 2 1 .5-.7 1.2-1 2-1 1.8 0 3 1.5 3 3 0 3.5-5 6.5-5 6.5S7 13.5 7 10Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    default:
      return (
        <path
          d="M12 7v10M7 12h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
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
