import { useEffect, useState } from 'react'
import {
  EXPENSE_CATEGORIES,
  getCategoryLabel,
  type Expense,
  type ExpenseCategoryId,
  type ExpensePatch,
} from '../types/expense'
import { DateTimePicker } from './DateTimePicker'
import { MenuSelect } from './MenuSelect'

interface ExpenseDetailProps {
  expense: Expense
  onSave: (id: string, patch: ExpensePatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBack: () => void
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ExpenseDetail({ expense, onSave, onDelete, onBack }: ExpenseDetailProps) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [note, setNote] = useState(expense.note)
  const [category, setCategory] = useState<ExpenseCategoryId>(expense.category)
  const [spentAt, setSpentAt] = useState(() => new Date(expense.spentAt))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAmount(String(expense.amount))
    setNote(expense.note)
    setCategory(expense.category)
    setSpentAt(new Date(expense.spentAt))
    setError(null)
    setSaved(false)
  }, [
    expense.id,
    expense.amount,
    expense.note,
    expense.category,
    expense.spentAt,
    expense.updatedAt,
  ])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const parsed = Number.parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    const nextSpentAt = spentAt.toISOString()
    setSaving(true)
    try {
      await onSave(expense.id, {
        amount: Math.round(parsed * 100) / 100,
        note,
        category,
        spentAt: nextSpentAt,
      })
      setSpentAt(new Date(nextSpentAt))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this expense?')) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(expense.id)
      onBack()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete expense')
      setDeleting(false)
    }
  }

  return (
    <div className="expenses-view expense-detail">
      <div className="expense-detail-top">
        <button type="button" className="insights-close" onClick={onBack} aria-label="Back to expenses">
          ←
        </button>
        <div className="expense-detail-summary">
          <p className="eyebrow">{getCategoryLabel(expense.category)}</p>
          <p className="expense-detail-amount">{formatMoney(expense.amount)}</p>
        </div>
        <span className="expense-detail-top-spacer" aria-hidden />
      </div>

      <form className="expense-form" onSubmit={handleSave}>
        <label>
          Amount
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setSaved(false)
            }}
            required
          />
        </label>

        <DateTimePicker
          value={spentAt}
          onChange={(next) => {
            setSpentAt(next)
            setSaved(false)
          }}
        />

        <MenuSelect
          label="Category"
          variant="field"
          value={category}
          options={EXPENSE_CATEGORIES}
          onChange={(next) => {
            setCategory(next)
            setSaved(false)
          }}
        />

        <label>
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setSaved(false)
            }}
            placeholder="Coffee, groceries, train…"
            maxLength={120}
          />
        </label>

        {error && <p className="expense-form-error">{error}</p>}
        {saved && !error && <p className="expense-form-saved">Saved</p>}

        <div className="expense-detail-actions">
          <button type="submit" className="expense-submit" disabled={saving || deleting}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            className="expense-detail-delete"
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? 'Deleting…' : 'Delete expense'}
          </button>
        </div>
      </form>
    </div>
  )
}
