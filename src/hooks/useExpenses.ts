import { useCallback, useEffect, useState } from 'react'
import type { Expense, ExpenseInput, ExpensePatch } from '../types/expense'
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  updateExpense,
} from '../lib/expenseStorage'
import { getStorageMode } from '../lib/storage'

export function useExpenses(userId?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const mode = getStorageMode()
    if (mode === 'supabase' && !userId) {
      setExpenses([])
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await fetchExpenses(userId)
      setExpenses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const addExpense = useCallback(
    async (input: ExpenseInput) => {
      const expense = await createExpense(input, userId)
      setExpenses((prev) =>
        [expense, ...prev].sort(
          (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
        )
      )
      return expense
    },
    [userId]
  )

  const saveExpense = useCallback(
    async (id: string, patch: ExpensePatch) => {
      const updated = await updateExpense(id, patch, userId)
      setExpenses((prev) =>
        prev
          .map((e) => (e.id === id ? updated : e))
          .sort((a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime())
      )
      return updated
    },
    [userId]
  )

  const removeExpense = useCallback(
    async (id: string) => {
      await deleteExpense(id, userId)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    },
    [userId]
  )

  return {
    expenses,
    loading,
    error,
    addExpense,
    saveExpense,
    removeExpense,
    reload: load,
  }
}
