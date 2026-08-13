import type { MouseEvent } from 'react'

export type AppView = 'journal' | 'calendar' | 'expenses'
export type ExpenseScreen = 'list' | 'insights'

export interface AppLocation {
  view: AppView
  expenseScreen: ExpenseScreen
}

const VIEW_PATHS: Record<AppView, string> = {
  journal: '/journal',
  calendar: '/calendar',
  expenses: '/expenses',
}

export function parsePath(pathname: string): AppLocation {
  const parts = pathname.split('/').filter(Boolean)
  const head = parts[0]

  if (head === 'calendar') return { view: 'calendar', expenseScreen: 'list' }
  if (head === 'expenses') {
    return {
      view: 'expenses',
      expenseScreen: parts[1] === 'insights' ? 'insights' : 'list',
    }
  }

  return { view: 'journal', expenseScreen: 'list' }
}

export function locationToPath(location: AppLocation): string {
  if (location.view === 'expenses' && location.expenseScreen === 'insights') {
    return '/expenses/insights'
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
