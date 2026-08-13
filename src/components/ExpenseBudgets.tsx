import { useMemo } from 'react'
import {
  filterExpenses,
  summarizeCategories,
} from '../lib/expensePeriods'
import type { Expense } from '../types/expense'
import { CategoryIcon } from './CategoryIcon'

interface ExpenseBudgetsProps {
  expenses: Expense[]
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ExpenseBudgets({ expenses }: ExpenseBudgetsProps) {
  const scoped = useMemo(
    () => filterExpenses(expenses, 'month', new Date()),
    [expenses]
  )
  const total = useMemo(
    () => scoped.reduce((sum, expense) => sum + expense.amount, 0),
    [scoped]
  )
  const slices = useMemo(() => summarizeCategories(scoped), [scoped])

  return (
    <div className="expenses-view expense-budgets-view">
      <div className="expense-period-header budgets-header">
        <h2 className="expenses-title">Budgets</h2>
        <span className="expense-period-badge current">This Month</span>
      </div>

      <div className="expenses-total-block">
        <span className="expenses-total-amount">${formatMoney(total)}</span>
        <span className="expenses-total-label">Spent this month</span>
      </div>

      {slices.length === 0 ? (
        <p className="empty-list">No spending this month yet.</p>
      ) : (
        <ul className="expense-category-list">
          {slices.map((slice) => (
            <li key={slice.id} className="expense-category-row">
              <CategoryIcon category={slice.id} />
              <div className="expense-category-copy">
                <div className="expense-category-top">
                  <span className="expense-category-name">{slice.label}</span>
                  <span className="expense-category-amount">${formatMoney(slice.total)}</span>
                </div>
                <div className="expense-category-bar" aria-hidden>
                  <span
                    style={{ width: `${Math.max(slice.percent, 4)}%`, background: slice.color }}
                  />
                </div>
                <span className="expense-category-meta">{slice.percent.toFixed(0)}% of spending</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
