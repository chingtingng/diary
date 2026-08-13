import type { Expense, ExpenseInput, ExpensePatch, ExpenseRow } from '../types/expense'
import { normalizeCategory, rowToExpense } from '../types/expense'
import { getStorageMode } from './storage'
import { supabase } from './supabase'

const LOCAL_STORAGE_KEY = 'daybook-expenses'

function readLocalExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as Expense[]).map((expense) => ({
      ...expense,
      category: normalizeCategory(expense.category),
    }))
  } catch {
    return []
  }
}

function writeLocalExpenses(expenses: Expense[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses))
}

function generateId(): string {
  return crypto.randomUUID()
}

function sortBySpentAt(expenses: Expense[]): Expense[] {
  return [...expenses].sort(
    (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
  )
}

export async function fetchExpenses(userId?: string): Promise<Expense[]> {
  if (getStorageMode() === 'local') {
    return sortBySpentAt(readLocalExpenses())
  }

  if (!supabase || !userId) return []

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('spent_at', { ascending: false })

  if (error) throw error
  return (data as ExpenseRow[]).map(rowToExpense)
}

export async function createExpense(
  input: ExpenseInput,
  userId?: string
): Promise<Expense> {
  const now = new Date().toISOString()

  if (getStorageMode() === 'local') {
    const expense: Expense = {
      id: generateId(),
      amount: input.amount,
      note: input.note.trim(),
      category: input.category,
      spentAt: input.spentAt,
      createdAt: now,
      updatedAt: now,
    }
    const expenses = readLocalExpenses()
    expenses.unshift(expense)
    writeLocalExpenses(expenses)
    return expense
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      amount: input.amount,
      note: input.note.trim(),
      category: input.category,
      spent_at: input.spentAt,
    })
    .select()
    .single()

  if (error) throw error
  return rowToExpense(data as ExpenseRow)
}

export async function updateExpense(
  id: string,
  patch: ExpensePatch,
  userId?: string
): Promise<Expense> {
  if (getStorageMode() === 'local') {
    const expenses = readLocalExpenses()
    const index = expenses.findIndex((e) => e.id === id)
    if (index === -1) throw new Error('Expense not found')

    const updated: Expense = {
      ...expenses[index],
      ...patch,
      note: patch.note !== undefined ? patch.note.trim() : expenses[index].note,
      updatedAt: new Date().toISOString(),
    }
    expenses[index] = updated
    writeLocalExpenses(expenses)
    return updated
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const payload: Record<string, unknown> = {}
  if (patch.amount !== undefined) payload.amount = patch.amount
  if (patch.note !== undefined) payload.note = patch.note.trim()
  if (patch.category !== undefined) payload.category = patch.category
  if (patch.spentAt !== undefined) payload.spent_at = patch.spentAt

  const { data, error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return rowToExpense(data as ExpenseRow)
}

export async function deleteExpense(id: string, userId?: string): Promise<void> {
  if (getStorageMode() === 'local') {
    writeLocalExpenses(readLocalExpenses().filter((e) => e.id !== id))
    return
  }

  if (!supabase || !userId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
