import type { MouseEvent } from 'react'

export type AppView = 'journal' | 'calendar' | 'expenses' | 'insurance'
export type ExpenseScreen = 'list' | 'insights' | 'budgets'
export type InsuranceScreen = 'overview' | 'policies' | 'documents'

export interface AppLocation {
  view: AppView
  expenseScreen: ExpenseScreen
  insuranceScreen: InsuranceScreen
}

export const APP_PLUGINS: { id: AppView; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'insurance', label: 'Insurance' },
]

export const INSURANCE_TABS: { id: InsuranceScreen; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'policies', label: 'Policies' },
  { id: 'documents', label: 'Documents' },
]

const VIEW_PATHS: Record<AppView, string> = {
  journal: '/journal',
  calendar: '/calendar',
  expenses: '/expenses',
  insurance: '/insurance',
}

function parseExpenseScreen(segment?: string): ExpenseScreen {
  if (segment === 'insights') return 'insights'
  if (segment === 'budgets') return 'budgets'
  return 'list'
}

function parseInsuranceScreen(segment?: string): InsuranceScreen {
  if (segment === 'policies') return 'policies'
  if (segment === 'documents') return 'documents'
  return 'overview'
}

export function parsePath(pathname: string): AppLocation {
  const parts = pathname.split('/').filter(Boolean)
  const head = parts[0]

  if (head === 'calendar') {
    return { view: 'calendar', expenseScreen: 'list', insuranceScreen: 'overview' }
  }
  if (head === 'expenses') {
    return {
      view: 'expenses',
      expenseScreen: parseExpenseScreen(parts[1]),
      insuranceScreen: 'overview',
    }
  }
  if (head === 'insurance') {
    return {
      view: 'insurance',
      expenseScreen: 'list',
      insuranceScreen: parseInsuranceScreen(parts[1]),
    }
  }

  return { view: 'journal', expenseScreen: 'list', insuranceScreen: 'overview' }
}

export function locationToPath(location: AppLocation): string {
  if (location.view === 'expenses' && location.expenseScreen === 'insights') {
    return '/expenses/insights'
  }
  if (location.view === 'expenses' && location.expenseScreen === 'budgets') {
    return '/expenses/budgets'
  }
  if (location.view === 'insurance' && location.insuranceScreen !== 'overview') {
    return `/insurance/${location.insuranceScreen}`
  }
  return VIEW_PATHS[location.view]
}

export function viewHref(view: AppView): string {
  return VIEW_PATHS[view]
}

export function insuranceHref(screen: InsuranceScreen): string {
  if (screen === 'overview') return VIEW_PATHS.insurance
  return `/insurance/${screen}`
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

export function defaultLocation(view: AppView = 'journal'): AppLocation {
  return { view, expenseScreen: 'list', insuranceScreen: 'overview' }
}
