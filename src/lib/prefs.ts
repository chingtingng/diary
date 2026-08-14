import type { AppView } from './navigation'
import { EXPENSE_FILTERS, type ExpenseFilter } from './expensePeriods'

const VIEW_KEY = 'daybook-view'
const EXPENSE_FILTER_KEY = 'daybook-expense-filter'
const PLUGINS_KEY = 'daybook-plugins'

export type PluginId = 'diary' | 'expenses'

export interface PluginPrefs {
  diary: boolean
  expenses: boolean
}

export const DEFAULT_PLUGINS: PluginPrefs = {
  diary: true,
  expenses: true,
}

export function readLastView(): AppView | null {
  try {
    const value = localStorage.getItem(VIEW_KEY)
    if (value === 'journal' || value === 'calendar' || value === 'expenses') return value
  } catch {
    /* ignore */
  }
  return null
}

export function writeLastView(view: AppView) {
  if (view === 'settings') return
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

export function readPlugins(): PluginPrefs {
  try {
    const raw = localStorage.getItem(PLUGINS_KEY)
    if (!raw) return { ...DEFAULT_PLUGINS }
    const parsed = JSON.parse(raw) as Partial<PluginPrefs>
    return {
      diary: parsed.diary !== false,
      expenses: parsed.expenses !== false,
    }
  } catch {
    return { ...DEFAULT_PLUGINS }
  }
}

export function writePlugins(plugins: PluginPrefs) {
  try {
    localStorage.setItem(PLUGINS_KEY, JSON.stringify(plugins))
  } catch {
    /* ignore */
  }
}

/** First main view still allowed by the current plugin prefs. */
export function firstEnabledView(plugins: PluginPrefs): AppView {
  if (plugins.diary) return 'journal'
  if (plugins.expenses) return 'expenses'
  return 'settings'
}

export function isViewEnabled(view: AppView, plugins: PluginPrefs): boolean {
  if (view === 'settings') return true
  if (view === 'journal' || view === 'calendar') return plugins.diary
  if (view === 'expenses') return plugins.expenses
  return false
}
