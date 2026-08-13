export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food' },
  { id: 'transport', label: 'Transport' },
  { id: 'travel', label: 'Travel' },
  { id: 'hobbies', label: 'Hobbies' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'health', label: 'Health' },
  { id: 'other', label: 'Other' },
] as const

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]['id']

const CATEGORY_IDS = new Set<string>(EXPENSE_CATEGORIES.map((category) => category.id))

export function normalizeCategory(id: string): ExpenseCategoryId {
  if (id === 'home' || id === 'fun') return 'other'
  if (CATEGORY_IDS.has(id)) return id as ExpenseCategoryId
  return 'other'
}

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
  category: string
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
    category: normalizeCategory(row.category),
    spentAt: row.spent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getCategoryLabel(id: ExpenseCategoryId): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}
