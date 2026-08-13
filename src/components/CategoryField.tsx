import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from '../types/expense'

interface CategoryFieldProps {
  value: ExpenseCategoryId
  onChange: (next: ExpenseCategoryId) => void
}

export function CategoryField({ value, onChange }: CategoryFieldProps) {
  return (
    <label>
      Category
      <span className="native-select">
        <select
          value={value}
          aria-label="Category"
          onChange={(event) => onChange(event.target.value as ExpenseCategoryId)}
        >
          {EXPENSE_CATEGORIES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
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
