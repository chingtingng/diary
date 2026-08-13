import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  EXPENSE_FILTERS,
  filterExpenses,
  formatPeriodLabel,
  groupExpensesByDay,
  isCurrentPeriod,
  periodEyebrow,
  shiftPeriod,
  type ExpenseFilter,
  type ExpensePeriod,
} from '../lib/expensePeriods'
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  type Expense,
  type ExpenseCategoryId,
  type ExpenseInput,
  type ExpensePatch,
} from '../types/expense'
import { DateTimePicker } from './DateTimePicker'
import { ExpenseDetail } from './ExpenseDetail'
import { PeriodSelect } from './PeriodSelect'

interface ExpenseTrackerProps {
  expenses: Expense[]
  loading: boolean
  onAdd: (input: ExpenseInput) => Promise<Expense>
  onSave: (id: string, patch: ExpensePatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ExpenseTracker({
  expenses,
  loading,
  onAdd,
  onSave,
  onDelete,
}: ExpenseTrackerProps) {
  const [filter, setFilter] = useState<ExpenseFilter>('all')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('food')
  const [spentAt, setSpentAt] = useState(() => new Date())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const selectedExpense = useMemo(
    () => expenses.find((expense) => expense.id === selectedId) ?? null,
    [expenses, selectedId]
  )

  const visibleExpenses = useMemo(
    () => filterExpenses(expenses, filter, anchor),
    [expenses, filter, anchor]
  )

  const total = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses]
  )

  const groups = useMemo(() => groupExpensesByDay(visibleExpenses), [visibleExpenses])
  const current = filter === 'all' ? true : isCurrentPeriod(anchor, filter)

  const handleFilterChange = (next: ExpenseFilter) => {
    setFilter(next)
    setAnchor(new Date())
  }

  const resetAddForm = () => {
    setAmount('')
    setNote('')
    setCategory('food')
    setSpentAt(new Date())
    setError(null)
    setShowAddForm(false)
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
      await onAdd({
        amount: Math.round(parsed * 100) / 100,
        note,
        category,
        spentAt: spentAt.toISOString(),
      })
      resetAddForm()
      if (filter !== 'all') setAnchor(spentAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedId) {
    if (!selectedExpense) {
      return (
        <div className="expenses-view">
          <p className="empty-list">This expense is no longer available.</p>
          <button type="button" className="expense-form-cancel" onClick={() => setSelectedId(null)}>
            ← Back to expenses
          </button>
        </div>
      )
    }

    return (
      <ExpenseDetail
        expense={selectedExpense}
        onSave={onSave}
        onDelete={onDelete}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <div className="expenses-view">
      <div className="expenses-toolbar">
        <div className="expenses-toolbar-copy">
          <p className="eyebrow">{periodEyebrow(filter, current)}</p>
          <h2 className="expenses-title">
            {filter === 'all' ? 'My expenses' : formatPeriodLabel(anchor, filter as ExpensePeriod)}
          </h2>
          <p className="expenses-subtitle">
            {visibleExpenses.length === 0
              ? 'No spending logged yet'
              : `${visibleExpenses.length} ${visibleExpenses.length === 1 ? 'entry' : 'entries'}`}
          </p>
        </div>
        <div className="expenses-toolbar-controls">
          <PeriodSelect
            value={filter}
            options={EXPENSE_FILTERS}
            onChange={handleFilterChange}
          />
        </div>
        {filter !== 'all' && (
          <div className="calendar-nav expenses-period-nav">
            <button
              type="button"
              onClick={() => setAnchor((value) => shiftPeriod(value, filter as ExpensePeriod, -1))}
              aria-label={`Previous ${filter}`}
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
              onClick={() => setAnchor((value) => shiftPeriod(value, filter as ExpensePeriod, 1))}
              aria-label={`Next ${filter}`}
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className="expenses-total">
        <span className="expenses-total-label">
          {filter === 'all' ? 'Total expenses' : 'Spent'}
        </span>
        <span className="expenses-total-amount">{formatMoney(total)}</span>
      </div>

      {!showAddForm ? (
        <button
          type="button"
          className="expense-add-toggle"
          onClick={() => {
            setSpentAt(new Date())
            setShowAddForm(true)
          }}
        >
          <span aria-hidden>+</span>
          Add expense
        </button>
      ) : (
        <form className="expense-form" onSubmit={handleSubmit}>
          <div className="expense-form-heading">
            <p className="eyebrow">Add expense</p>
            <button type="button" className="expense-form-cancel" onClick={resetAddForm}>
              Cancel
            </button>
          </div>

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
              autoFocus
            />
          </label>

          <DateTimePicker value={spentAt} onChange={setSpentAt} />

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
            {submitting ? 'Saving…' : 'Save expense'}
          </button>
        </form>
      )}

      <section className="expenses-list-section" aria-label="Expense history">
        {loading ? (
          <p className="empty-list">Loading expenses…</p>
        ) : groups.length === 0 ? (
          <p className="empty-list">
            {filter === 'all'
              ? 'Nothing logged yet. Add an expense to begin.'
              : `Nothing logged for this ${filter} yet.`}
          </p>
        ) : (
          <div className="expenses-history">
            {groups.map((group) => (
              <section key={group.key} className="expense-day-group">
                <h3 className="expense-day-label">{group.label}</h3>
                <ul className="expenses-list">
                  {group.items.map((expense) => (
                    <li key={expense.id}>
                      <button
                        type="button"
                        className="expense-item expense-item-button"
                        onClick={() => setSelectedId(expense.id)}
                      >
                        <div className="expense-item-main">
                          <span className="expense-item-note">
                            {expense.note.trim() || getCategoryLabel(expense.category)}
                          </span>
                          <span className="expense-item-meta">
                            {getCategoryLabel(expense.category)} ·{' '}
                            {format(new Date(expense.spentAt), 'h:mm a')}
                          </span>
                        </div>
                        <span className="expense-item-amount">{formatMoney(expense.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
