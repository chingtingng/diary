import type { ExpenseFilter } from '../lib/expensePeriods'
import { MenuSelect } from './MenuSelect'

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
  return (
    <MenuSelect
      value={value}
      options={options}
      onChange={onChange}
      label={label}
      variant="compact"
    />
  )
}
