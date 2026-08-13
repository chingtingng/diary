import { useMemo, useState } from 'react'
import { format, isWithinInterval } from 'date-fns'
import {
  EXPENSE_PERIODS,
  formatPeriodLabel,
  getPeriodRange,
  isCurrentPeriod,
  periodEyebrow,
  shiftPeriod,
  summarizeCategories,
  type ExpensePeriod,
} from '../lib/expensePeriods'
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  type Expense,
  type ExpenseCategoryId,
  type ExpenseInput,
} from '../types/expense'
import { CategoryPieChart } from './CategoryPieChart'

interface ExpenseTrackerProps {
  expenses: Expense[]
  loading: boolean
  onAdd: (input: ExpenseInput) => Promise<Expense>
  onDelete: (id: string) => Promise<void>
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function todayInputValue(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function listDateFormat(period: ExpensePeriod): string {
  switch (period) {
    case 'day':
      return 'h:mm a'
    case 'year':
      return 'MMM d'
    default:
      return 'EEE, MMM d'
  }
}

export function ExpenseTracker({
  expenses,
  loading,
  onAdd,
  onDelete,
}: ExpenseTrackerProps) {
  const [period, setPeriod] = useState<ExpensePeriod>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('food')
  const [spentOn, setSpentOn] = useState(todayInputValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => getPeriodRange(anchor, period), [anchor, period])
  const current = isCurrentPeriod(anchor, period)

  const periodExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      isWithinInterval(new Date(expense.spentAt), range)
    )
  }, [expenses, range])

  const periodTotal = useMemo(
    () => periodExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [periodExpenses]
  )

  const categorySlices = useMemo(
    () => summarizeCategories(periodExpenses),
    [periodExpenses]
  )

  const handlePeriodChange = (next: ExpensePeriod) => {
    setPeriod(next)
    setAnchor(new Date())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    setSubmitting(true)
    try {
      const spentAt = new Date(`${spentOn}T12:00:00`)
      await onAdd({
        amount: Math.round(parsed * 100) / 100,
        note,
        category,
        spentAt: spentAt.toISOString(),
      })
      setAmount('')
      setNote('')
      setCategory('food')
      setSpentOn(todayInputValue())
      setAnchor(spentAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="expenses-view">
      <div className="expenses-toolbar">
        <div>
          <p className="eyebrow">{periodEyebrow(period, current)}</p>
          <h2 className="expenses-title">{formatPeriodLabel(anchor, period)}</h2>
          <p className="expenses-subtitle">
            {periodExpenses.length === 0
              ? 'No spending logged yet'
              : `${periodExpenses.length} ${periodExpenses.length === 1 ? 'entry' : 'entries'}`}
          </p>
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            onClick={() => setAnchor((value) => shiftPeriod(value, period, -1))}
            aria-label={`Previous ${period}`}
          >
            ←
          </button>
          <button
            type="button"
            className="today-btn"
            onClick={() => setAnchor(new Date())}
            disabled={current}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setAnchor((value) => shiftPeriod(value, period, 1))}
            aria-label={`Next ${period}`}
          >
            →
          </button>
        </div>
      </div>

      <div className="segmented expense-period-tabs" role="tablist" aria-label="Breakdown period">
        {EXPENSE_PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            className={period === item.id ? 'active' : ''}
            onClick={() => handlePeriodChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="expenses-total">
        <span className="expenses-total-label">Spent</span>
        <span className="expenses-total-amount">{formatMoney(periodTotal)}</span>
      </div>

      {categorySlices.length > 0 && (
        <section className="expense-category-section" aria-labelledby="expense-category-heading">
          <h3 id="expense-category-heading" className="eyebrow">
            By category
          </h3>
          <CategoryPieChart slices={categorySlices} totalLabel={formatMoney(periodTotal)} />
        </section>
      )}

      <form className="expense-form" onSubmit={handleSubmit}>
        <p className="eyebrow">Add expense</p>
        <div className="expense-form-row">
          <label>
            Amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              required
            />
          </label>
        </div>

        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategoryId)}
          >
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Coffee, groceries, train…"
            maxLength={120}
          />
        </label>

        {error && <p className="expense-form-error">{error}</p>}

        <button type="submit" className="expense-submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      <section className="expenses-list-section" aria-label="Expenses">
        {loading ? (
          <p className="empty-list">Loading expenses…</p>
        ) : periodExpenses.length === 0 ? (
          <p className="empty-list">Nothing logged for this {period} yet.</p>
        ) : (
          <ul className="expenses-list">
            {periodExpenses.map((expense) => (
              <li key={expense.id} className="expense-item">
                <div className="expense-item-main">
                  <span className="expense-item-amount">{formatMoney(expense.amount)}</span>
                  <span className="expense-item-meta">
                    {format(new Date(expense.spentAt), listDateFormat(period))} ·{' '}
                    {getCategoryLabel(expense.category)}
                  </span>
                  {expense.note.trim() ? (
                    <span className="expense-item-note">{expense.note}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="expense-delete"
                  onClick={() => onDelete(expense.id)}
                  aria-label="Delete expense"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
