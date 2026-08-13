import { useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  format,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  subMonths,
} from 'date-fns'
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  type Expense,
  type ExpenseCategoryId,
  type ExpenseInput,
} from '../types/expense'

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

export function ExpenseTracker({
  expenses,
  loading,
  onAdd,
  onDelete,
}: ExpenseTrackerProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('food')
  const [spentOn, setSpentOn] = useState(todayInputValue)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthExpenses = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return expenses.filter((expense) =>
      isWithinInterval(new Date(expense.spentAt), { start, end })
    )
  }, [expenses, month])

  const monthTotal = useMemo(
    () => monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [monthExpenses]
  )

  const categoryTotals = useMemo(() => {
    const totals = new Map<ExpenseCategoryId, number>()
    for (const expense of monthExpenses) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount)
    }
    return [...totals.entries()]
      .map(([id, total]) => ({ id, total, label: getCategoryLabel(id) }))
      .sort((a, b) => b.total - a.total)
  }, [monthExpenses])

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
          <p className="eyebrow">This month</p>
          <h2 className="expenses-title">{format(month, 'MMMM yyyy')}</h2>
          <p className="expenses-subtitle">
            {monthExpenses.length === 0
              ? 'No spending logged yet'
              : `${monthExpenses.length} ${monthExpenses.length === 1 ? 'entry' : 'entries'}`}
          </p>
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
            ←
          </button>
          <button
            type="button"
            className="today-btn"
            onClick={() => setMonth(startOfMonth(new Date()))}
            disabled={isSameMonth(month, new Date())}
          >
            Today
          </button>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            →
          </button>
        </div>
      </div>

      <div className="expenses-total">
        <span className="expenses-total-label">Spent</span>
        <span className="expenses-total-amount">{formatMoney(monthTotal)}</span>
      </div>

      {categoryTotals.length > 0 && (
        <ul className="expenses-breakdown" aria-label="Spending by category">
          {categoryTotals.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <span>{formatMoney(item.total)}</span>
            </li>
          ))}
        </ul>
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
        ) : monthExpenses.length === 0 ? (
          <p className="empty-list">Nothing logged for this month yet.</p>
        ) : (
          <ul className="expenses-list">
            {monthExpenses.map((expense) => (
              <li key={expense.id} className="expense-item">
                <div className="expense-item-main">
                  <span className="expense-item-amount">{formatMoney(expense.amount)}</span>
                  <span className="expense-item-meta">
                    {format(new Date(expense.spentAt), 'MMM d')} ·{' '}
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
