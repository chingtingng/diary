import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  EXPENSE_PERIODS,
  buildSpendingBars,
  currentPeriodBadge,
  filterExpenses,
  formatPeriodLabel,
  groupExpensesByDay,
  groupExpensesByDayWithTotals,
  groupExpensesByMonth,
  isCurrentPeriod,
  shiftPeriod,
  summarizeCategories,
  type ExpensePeriod,
} from '../lib/expensePeriods'
import { readExpenseFilter, writeExpenseFilter } from '../lib/prefs'
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  type Expense,
  type ExpenseCategoryId,
  type ExpenseInput,
  type ExpensePatch,
} from '../types/expense'
import { CategoryIcon } from './CategoryIcon'
import { DateTimePicker } from './DateTimePicker'
import { ExpenseDetail } from './ExpenseDetail'
import { MenuSelect } from './MenuSelect'
import { SpendingBarChart } from './SpendingBarChart'

interface ExpenseTrackerProps {
  expenses: Expense[]
  loading: boolean
  searchQuery?: string
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

function asPeriod(value: string): ExpensePeriod {
  if (value === 'week' || value === 'month' || value === 'year') return value
  return 'day'
}

export function ExpenseTracker({
  expenses,
  loading,
  searchQuery = '',
  onAdd,
  onSave,
  onDelete,
}: ExpenseTrackerProps) {
  const [period, setPeriod] = useState<ExpensePeriod>(() => asPeriod(readExpenseFilter()))
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<ExpenseCategoryId>('food')
  const [spentAt, setSpentAt] = useState(() => new Date())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set())

  const selectedExpense = useMemo(
    () => expenses.find((expense) => expense.id === selectedId) ?? null,
    [expenses, selectedId]
  )

  const visibleExpenses = useMemo(() => {
    const scoped = filterExpenses(expenses, period, anchor)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return scoped
    return scoped.filter((expense) => {
      const haystack = `${expense.note} ${getCategoryLabel(expense.category)}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [expenses, period, anchor, searchQuery])

  const total = useMemo(
    () => visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [visibleExpenses]
  )

  const dayGroups = useMemo(() => groupExpensesByDay(visibleExpenses), [visibleExpenses])
  const weekGroups = useMemo(
    () => groupExpensesByDayWithTotals(visibleExpenses),
    [visibleExpenses]
  )
  const categorySlices = useMemo(
    () => summarizeCategories(visibleExpenses),
    [visibleExpenses]
  )
  const monthRows = useMemo(
    () => groupExpensesByMonth(visibleExpenses, anchor),
    [visibleExpenses, anchor]
  )
  const bars = useMemo(
    () => (period === 'day' ? [] : buildSpendingBars(visibleExpenses, anchor, period)),
    [visibleExpenses, anchor, period]
  )
  const current = isCurrentPeriod(anchor, period)

  const handlePeriodChange = (next: ExpensePeriod) => {
    setPeriod(next)
    writeExpenseFilter(next)
    setAnchor(new Date())
    setExpandedDays(new Set())
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
      setAnchor(spentAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDay = (key: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
    <div className="expenses-view expenses-overview">
      <div className="expense-period-tabs" role="tablist" aria-label="Period">
        {EXPENSE_PERIODS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={period === option.id}
            className={period === option.id ? 'active' : ''}
            data-haptic="select"
            onClick={() => handlePeriodChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="expense-period-header">
        <div className="expense-period-heading">
          <h2 className="expenses-title">{formatPeriodLabel(anchor, period)}</h2>
          <div className="expense-period-shifts" role="group" aria-label={`${period} navigation`}>
            <button
              type="button"
              className="expense-period-shift"
              data-haptic="select"
              onClick={() => setAnchor((value) => shiftPeriod(value, period, -1))}
              aria-label={`Previous ${period}`}
            >
              ‹
            </button>
            <button
              type="button"
              className="expense-period-shift"
              data-haptic="select"
              onClick={() => setAnchor((value) => shiftPeriod(value, period, 1))}
              aria-label={`Next ${period}`}
            >
              ›
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`expense-period-badge${current ? ' current' : ''}`}
          data-haptic="select"
          onClick={() => setAnchor(new Date())}
          disabled={current}
        >
          {current ? currentPeriodBadge(period) : 'Jump to now'}
        </button>
      </div>

      <div className="expenses-total-block">
        <span className="expenses-total-amount">${formatMoney(total)}</span>
        <span className="expenses-total-label">Total Spent</span>
      </div>

      {period !== 'day' && bars.length > 0 && (
        <SpendingBarChart
          bars={bars}
          density={period === 'month' ? 'month' : period === 'year' ? 'year' : 'week'}
        />
      )}

      {!showAddForm ? (
        <button
          type="button"
          className="expense-add-toggle"
          data-haptic="light"
          onClick={() => {
            setSpentAt(new Date())
            setShowAddForm(true)
          }}
        >
          + Add expense
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

          <MenuSelect
            label="Category"
            variant="field"
            value={category}
            options={EXPENSE_CATEGORIES}
            onChange={setCategory}
          />

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

          <button type="submit" className="expense-submit" data-haptic="success" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save expense'}
          </button>
        </form>
      )}

      <section className="expenses-list-section" aria-label="Expense history">
        {loading ? (
          <p className="empty-list">Loading expenses…</p>
        ) : visibleExpenses.length === 0 ? (
          <p className="empty-list">Nothing logged for this {period} yet.</p>
        ) : period === 'day' ? (
          <ul className="expenses-list expense-txn-list">
            {dayGroups.flatMap((group) =>
              group.items.map((expense) => (
                <li key={expense.id}>
                  <button
                    type="button"
                    className="expense-item expense-item-button expense-txn-row"
                    data-haptic="select"
                    onClick={() => setSelectedId(expense.id)}
                  >
                    <CategoryIcon category={expense.category} />
                    <div className="expense-item-main">
                      <span className="expense-item-note">
                        {expense.note.trim() || getCategoryLabel(expense.category)}
                      </span>
                      <span className="expense-item-meta">
                        {getCategoryLabel(expense.category)} •{' '}
                        {format(new Date(expense.spentAt), 'h:mm a')}
                      </span>
                    </div>
                    <span className="expense-item-amount">${formatMoney(expense.amount)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : period === 'week' ? (
          <div className="expenses-history expense-week-groups">
            {weekGroups.map((group) => {
              const open = expandedDays.has(group.key)
              return (
                <section key={group.key} className={`expense-week-group${open ? ' open' : ''}`}>
                  <button
                    type="button"
                    className="expense-week-group-toggle"
                    data-haptic="select"
                    aria-expanded={open}
                    onClick={() => toggleDay(group.key)}
                  >
                    <span className="expense-week-group-label">{group.label}</span>
                    <span className="expense-week-group-total">${formatMoney(group.total)}</span>
                    <span className="expense-week-chevron" aria-hidden>
                      {open ? '▾' : '›'}
                    </span>
                  </button>
                  {open && (
                    <ul className="expenses-list expense-txn-list">
                      {group.items.map((expense) => (
                        <li key={expense.id}>
                          <button
                            type="button"
                            className="expense-item expense-item-button expense-txn-row"
                            data-haptic="select"
                            onClick={() => setSelectedId(expense.id)}
                          >
                            <CategoryIcon category={expense.category} size={36} />
                            <div className="expense-item-main">
                              <span className="expense-item-note">
                                {expense.note.trim() || getCategoryLabel(expense.category)}
                              </span>
                              <span className="expense-item-meta">
                                {getCategoryLabel(expense.category)} •{' '}
                                {format(new Date(expense.spentAt), 'h:mm a')}
                              </span>
                            </div>
                            <span className="expense-item-amount">
                              ${formatMoney(expense.amount)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        ) : period === 'month' ? (
          <ul className="expense-category-list">
            {categorySlices.map((slice) => (
              <li key={slice.id} className="expense-category-row">
                <CategoryIcon category={slice.id} />
                <div className="expense-category-copy">
                  <div className="expense-category-top">
                    <span className="expense-category-name">{slice.label}</span>
                    <span className="expense-category-amount">${formatMoney(slice.total)}</span>
                  </div>
                  <div className="expense-category-bar" aria-hidden>
                    <span style={{ width: `${Math.max(slice.percent, 4)}%`, background: slice.color }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="expense-month-list">
            {monthRows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className="expense-month-row"
                  data-haptic="select"
                  onClick={() => {
                    setPeriod('month')
                    writeExpenseFilter('month')
                    setAnchor(row.date)
                  }}
                >
                  <span className="expense-month-name">{row.label}</span>
                  <span className="expense-month-amount">${formatMoney(row.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
