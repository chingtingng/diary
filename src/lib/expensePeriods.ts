import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isSameYear,
  isToday,
  isYesterday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'
import type { Expense, ExpenseCategoryId } from '../types/expense'
import { getCategoryLabel } from '../types/expense'

export type ExpensePeriod = 'day' | 'week' | 'month' | 'year'
export type ExpenseFilter = ExpensePeriod | 'all'

export const EXPENSE_FILTERS: { id: ExpenseFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

export const INSIGHT_PERIODS: { id: ExpenseFilter; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
]

const WEEK_OPTIONS = { weekStartsOn: 1 as const }

export function getPeriodRange(anchor: Date, period: ExpensePeriod): { start: Date; end: Date } {
  switch (period) {
    case 'day':
      return { start: startOfDay(anchor), end: endOfDay(anchor) }
    case 'week':
      return {
        start: startOfWeek(anchor, WEEK_OPTIONS),
        end: endOfWeek(anchor, WEEK_OPTIONS),
      }
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
    case 'year':
      return { start: startOfYear(anchor), end: endOfYear(anchor) }
  }
}

export function shiftPeriod(anchor: Date, period: ExpensePeriod, direction: -1 | 1): Date {
  switch (period) {
    case 'day':
      return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1)
    case 'week':
      return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1)
    case 'month':
      return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1)
    case 'year':
      return direction === 1 ? addYears(anchor, 1) : subYears(anchor, 1)
  }
}

export function isCurrentPeriod(anchor: Date, period: ExpensePeriod, now = new Date()): boolean {
  switch (period) {
    case 'day':
      return isSameDay(anchor, now)
    case 'week':
      return isSameWeek(anchor, now, WEEK_OPTIONS)
    case 'month':
      return isSameMonth(anchor, now)
    case 'year':
      return isSameYear(anchor, now)
  }
}

export function formatPeriodLabel(anchor: Date, period: ExpensePeriod): string {
  const { start, end } = getPeriodRange(anchor, period)
  switch (period) {
    case 'day':
      return format(start, 'EEEE, MMMM d')
    case 'week': {
      const sameMonth = isSameMonth(start, end)
      const sameYear = isSameYear(start, end)
      if (sameMonth) return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
      if (sameYear) return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
      return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
    }
    case 'month':
      return format(start, 'MMMM yyyy')
    case 'year':
      return format(start, 'yyyy')
  }
}

export function periodEyebrow(filter: ExpenseFilter, isCurrent: boolean): string {
  if (filter === 'all') return 'Lifetime'
  if (!isCurrent) {
    switch (filter) {
      case 'day':
        return 'Day'
      case 'week':
        return 'Week'
      case 'month':
        return 'Month'
      case 'year':
        return 'Year'
    }
  }
  switch (filter) {
    case 'day':
      return 'Today'
    case 'week':
      return 'This week'
    case 'month':
      return 'This month'
    case 'year':
      return 'This year'
  }
}

export function filterExpenses(
  expenses: Expense[],
  filter: ExpenseFilter,
  anchor: Date
): Expense[] {
  if (filter === 'all') return expenses
  const range = getPeriodRange(anchor, filter)
  return expenses.filter((expense) =>
    isWithinInterval(new Date(expense.spentAt), range)
  )
}

export type ExpenseDayGroup = {
  key: string
  label: string
  items: Expense[]
}

export function groupExpensesByDay(expenses: Expense[]): ExpenseDayGroup[] {
  const groups = new Map<string, Expense[]>()

  for (const expense of expenses) {
    const key = format(startOfDay(new Date(expense.spentAt)), 'yyyy-MM-dd')
    const bucket = groups.get(key)
    if (bucket) bucket.push(expense)
    else groups.set(key, [expense])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => {
      const date = new Date(`${key}T12:00:00`)
      let label: string
      if (isToday(date)) label = 'Today'
      else if (isYesterday(date)) label = 'Yesterday'
      else label = format(date, 'd MMM yyyy')

      return {
        key,
        label,
        items: items.sort(
          (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
        ),
      }
    })
}

export type CategorySlice = {
  id: ExpenseCategoryId
  label: string
  total: number
  percent: number
  color: string
}

/** Soft palette aligned with the mist daybook theme (not purple-forward). */
export const CATEGORY_COLORS: Record<ExpenseCategoryId, string> = {
  food: '#2f6f8f',
  transport: '#3f8f6e',
  travel: '#4a8aa3',
  home: '#b07a3a',
  shopping: '#8a6a45',
  health: '#4f8a86',
  fun: '#b2654d',
  other: '#6d7684',
}

export function summarizeCategories(expenses: Expense[]): CategorySlice[] {
  const totals = new Map<ExpenseCategoryId, number>()
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount)
  }

  const grand = [...totals.values()].reduce((sum, n) => sum + n, 0)
  if (grand <= 0) return []

  return [...totals.entries()]
    .map(([id, total]) => ({
      id,
      label: getCategoryLabel(id),
      total,
      percent: (total / grand) * 100,
      color: CATEGORY_COLORS[id],
    }))
    .sort((a, b) => b.total - a.total)
}
