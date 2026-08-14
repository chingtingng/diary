import type { AppView } from './navigation'
import { EXPENSE_FILTERS, type ExpenseFilter } from './expensePeriods'

const VIEW_KEY = 'daybook-view'
const EXPENSE_FILTER_KEY = 'daybook-expense-filter'

export function readLastView(): AppView | null {
  try {
    const value = localStorage.getItem(VIEW_KEY)
    if (
      value === 'journal' ||
      value === 'calendar' ||
      value === 'expenses' ||
      value === 'insurance'
    ) {
      return value
    }
  } catch {
    /* ignore */
  }
  return null
}

export function writeLastView(view: AppView) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* ignore */
  }
}

export function readExpenseFilter(): ExpenseFilter {
  try {
    const value = localStorage.getItem(EXPENSE_FILTER_KEY)
    if (value && EXPENSE_FILTERS.some((option) => option.id === value)) {
      // Overview tabs no longer include All — fall back to Day.
      if (value === 'all') return 'day'
      return value as ExpenseFilter
    }
  } catch {
    /* ignore */
  }
  return 'day'
}

export function writeExpenseFilter(filter: ExpenseFilter) {
  try {
    localStorage.setItem(EXPENSE_FILTER_KEY, filter)
  } catch {
    /* ignore */
  }
}
