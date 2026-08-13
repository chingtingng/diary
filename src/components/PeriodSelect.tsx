import type { ExpenseFilter } from '../lib/expensePeriods'

interface PeriodOption {
  id: ExpenseFilter
  label: string
}

interface PeriodSelectProps {
  value: ExpenseFilter
  options: PeriodOption[]
  onChange: (next: ExpenseFilter) => void
  label?: string
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label = 'Period',
}: PeriodSelectProps) {
  const selected = options.find((option) => option.id === value)?.label ?? value

  return (
    <label className="period-select">
      <span className="period-select-kicker">{label}</span>
      <span className="period-select-control">
        <span className="period-select-value" aria-hidden>
          {selected}
        </span>
        <select
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value as ExpenseFilter)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="period-select-chevron" aria-hidden>
          ▾
        </span>
      </span>
    </label>
  )
}
