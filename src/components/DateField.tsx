import { format } from 'date-fns'
import { atLocalNoon } from '../lib/dates'

interface DateFieldProps {
  value: Date
  onChange: (next: Date) => void
  label?: string
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function DateField({ value, onChange, label = 'Date' }: DateFieldProps) {
  return (
    <label>
      {label}
      <span className="native-select native-date">
        <span className="native-date-value">{format(value, 'EEE, MMM d')}</span>
        <input
          type="date"
          value={toDateInputValue(value)}
          aria-label={label}
          onChange={(event) => {
            const raw = event.target.value
            if (!raw) return
            const [year, month, day] = raw.split('-').map(Number)
            onChange(atLocalNoon(new Date(year, month - 1, day)))
          }}
        />
        <svg
          className="native-select-chevron"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M2.5 4.25 6 7.75l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  )
}
