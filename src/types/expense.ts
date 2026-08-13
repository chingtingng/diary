export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'travel', label: 'Travel' },
  { id: 'home', label: 'Home' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'health', label: 'Health' },
  { id: 'fun', label: 'Fun' },
  { id: 'other', label: 'Other' },
] as const

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id']

export interface Expense {
  id: string
  amount: number
  note: string
  category: ExpenseCategoryId
  spentAt: string
  createdAt: string
  updatedAt: string
}

export interface ExpenseRow {
  id: string
  user_id: string
  amount: number
  note: string
  category: ExpenseCategoryId
  spent_at: string
  created_at: string
  updated_at: string
}

export type ExpenseInput = {
  amount: number
  note: string
  category: ExpenseCategoryId
  spentAt: string
}

export type ExpensePatch = Partial<ExpenseInput>

export function rowToExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    amount: Number(row.amount),
    note: row.note ?? '',
    category: row.category,
    spentAt: row.spent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getCategoryLabel(id: ExpenseCategoryId): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}
