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

/** Primary overview tabs matching the expense mockup (no All). */
export const EXPENSE_PERIODS: { id: ExpensePeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

export const EXPENSE_FILTERS: { id: ExpenseFilter; label: string }[] = [
  ...EXPENSE_PERIODS,
  { id: 'all', label: 'All' },
]

export const INSIGHT_PERIODS: { id: ExpenseFilter; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All' },
]

/** Week ranges match the iOS redesign (Mon–Sun), e.g. Aug 10 - Aug 16. */
const WEEK_OPTIONS = { weekStartsOn: 1 as const }

export type SpendingBar = {
  key: string
  label: string
  total: number
  active: boolean
}

export type MonthSpendRow = {
  key: string
  label: string
  total: number
  date: Date
}

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
      return format(start, 'EEEE, MMM d')
    case 'week': {
      const sameMonth = isSameMonth(start, end)
      if (sameMonth) return `${format(start, 'MMM d')} - ${format(end, 'd')}`
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
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
      return 'This Week'
    case 'month':
      return 'This Month'
    case 'year':
      return 'This Year'
  }
}

export function currentPeriodBadge(period: ExpensePeriod): string {
  switch (period) {
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

export function swipeHint(period: ExpensePeriod): string {
  switch (period) {
    case 'day':
      return 'Swipe left or right to change day'
    case 'week':
      return 'Swipe left or right to change week'
    case 'month':
      return 'Swipe left or right to change month'
    case 'year':
      return 'Swipe left or right to change year'
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

export type ExpenseDayGroupWithTotal = ExpenseDayGroup & {
  total: number
  date: Date
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
      else label = format(date, 'EEE, MMM d')

      return {
        key,
        label,
        items: items.sort(
          (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
        ),
      }
    })
}

export function groupExpensesByDayWithTotals(expenses: Expense[]): ExpenseDayGroupWithTotal[] {
  return groupExpensesByDay(expenses).map((group) => {
    const date = new Date(`${group.key}T12:00:00`)
    return {
      ...group,
      date,
      total: group.items.reduce((sum, item) => sum + item.amount, 0),
      label: format(date, 'EEE, MMM d'),
    }
  })
}

export function buildSpendingBars(
  expenses: Expense[],
  anchor: Date,
  period: ExpensePeriod
): SpendingBar[] {
  const { start, end } = getPeriodRange(anchor, period)
  const now = new Date()

  if (period === 'week') {
    const weekBars = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(start, index)
      const total = expenses
        .filter((expense) => isSameDay(new Date(expense.spentAt), day))
        .reduce((sum, expense) => sum + expense.amount, 0)
      return {
        key: format(day, 'yyyy-MM-dd'),
        label: format(day, 'EEE').slice(0, 3),
        total,
        day,
      }
    })
    const highlightDay = isCurrentPeriod(anchor, 'week', now)
      ? now
      : weekBars.reduce((best, bar) => (bar.total > best.total ? bar : best), weekBars[0]).day
    return weekBars.map(({ day, ...bar }) => ({
      ...bar,
      active: isSameDay(day, highlightDay),
    }))
  }

  if (period === 'month') {
    const days = end.getDate()
    return Array.from({ length: days }, (_, index) => {
      const day = addDays(start, index)
      const total = expenses
        .filter((expense) => isSameDay(new Date(expense.spentAt), day))
        .reduce((sum, expense) => sum + expense.amount, 0)
      return {
        key: format(day, 'yyyy-MM-dd'),
        label: String(index + 1),
        total,
        active: isSameDay(day, now),
      }
    })
  }

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(startOfYear(anchor), index)
      const total = expenses
        .filter((expense) => isSameMonth(new Date(expense.spentAt), month))
        .reduce((sum, expense) => sum + expense.amount, 0)
      return {
        key: format(month, 'yyyy-MM'),
        label: format(month, 'MMM').slice(0, 3),
        total,
        active: isSameMonth(month, now),
      }
    })
  }

  return []
}

export function groupExpensesByMonth(expenses: Expense[], anchor: Date): MonthSpendRow[] {
  const now = new Date()
  const rows: MonthSpendRow[] = []

  for (let index = 11; index >= 0; index -= 1) {
    const month = addMonths(startOfYear(anchor), index)
    const total = expenses
      .filter((expense) => isSameMonth(new Date(expense.spentAt), month))
      .reduce((sum, expense) => sum + expense.amount, 0)

    // Hide empty future months; keep past/current months for a full year list.
    if (total <= 0 && month > now) continue

    rows.push({
      key: format(month, 'yyyy-MM'),
      label: format(month, 'MMMM'),
      total,
      date: month,
    })
  }

  return rows
}

export type CategorySlice = {
  id: ExpenseCategoryId
  label: string
  total: number
  percent: number
  color: string
  items: Expense[]
}

/** Category palette keyed off the journal accent (#2f6f8f). */
export const CATEGORY_COLORS: Record<ExpenseCategoryId, string> = {
  food: '#2f6f8f',
  transport: '#4a8fa8',
  travel: '#3d7a6e',
  hobbies: '#7a6b9a',
  shopping: '#6d8b9c',
  health: '#3f8f6e',
  other: '#6d7684',
}

export function summarizeCategories(expenses: Expense[]): CategorySlice[] {
  const groups = new Map<ExpenseCategoryId, Expense[]>()
  for (const expense of expenses) {
    const items = groups.get(expense.category)
    if (items) items.push(expense)
    else groups.set(expense.category, [expense])
  }

  const grand = [...groups.values()].reduce(
    (sum, items) => sum + items.reduce((inner, item) => inner + item.amount, 0),
    0
  )
  if (grand <= 0) return []

  return [...groups.entries()]
    .map(([id, items]) => {
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      return {
        id,
        label: getCategoryLabel(id),
        total,
        percent: (total / grand) * 100,
        color: CATEGORY_COLORS[id],
        items: items.sort(
          (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
        ),
      }
    })
    .sort((a, b) => b.total - a.total)
}
