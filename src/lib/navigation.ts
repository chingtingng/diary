import type { MouseEvent } from 'react'

export type AppView = 'journal' | 'calendar' | 'expenses' | 'settings'
export type ExpenseScreen = 'list' | 'insights' | 'budgets'

export interface AppLocation {
  view: AppView
  expenseScreen: ExpenseScreen
}

const VIEW_PATHS: Record<AppView, string> = {
  journal: '/journal',
  calendar: '/calendar',
  expenses: '/expenses',
  settings: '/settings',
}

function parseExpenseScreen(segment?: string): ExpenseScreen {
  if (segment === 'insights') return 'insights'
  if (segment === 'budgets') return 'budgets'
  return 'list'
}

export function parsePath(pathname: string): AppLocation {
  const parts = pathname.split('/').filter(Boolean)
  const head = parts[0]

  if (head === 'calendar') return { view: 'calendar', expenseScreen: 'list' }
  if (head === 'expenses') {
    return {
      view: 'expenses',
      expenseScreen: parseExpenseScreen(parts[1]),
    }
  }
  if (head === 'settings') return { view: 'settings', expenseScreen: 'list' }

  return { view: 'journal', expenseScreen: 'list' }
}

export function locationToPath(location: AppLocation): string {
  if (location.view === 'expenses' && location.expenseScreen === 'insights') {
    return '/expenses/insights'
  }
  if (location.view === 'expenses' && location.expenseScreen === 'budgets') {
    return '/expenses/budgets'
  }
  return VIEW_PATHS[location.view]
}

export function viewHref(view: AppView): string {
  return VIEW_PATHS[view]
}

export function shouldHandleSpaClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
