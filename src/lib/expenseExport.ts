import { format } from 'date-fns'
import { getCategoryLabel, type Expense } from '../types/expense'
import { downloadTextFile } from './export'

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function exportExpensesAsText(expenses: Expense[]): string {
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime()
  )
  const total = sorted.reduce((sum, e) => sum + e.amount, 0)

  const lines: string[] = [
    'Daybook Expenses Export',
    `Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`,
    `Total expenses: ${sorted.length}`,
    `Total amount: ${formatMoney(total)}`,
    '',
    '─'.repeat(50),
    '',
  ]

  for (const expense of sorted) {
    const date = format(new Date(expense.spentAt), 'EEEE, MMMM d, yyyy')
    const category = getCategoryLabel(expense.category)
    lines.push(`${date} · ${category} · ${formatMoney(expense.amount)}`)
    if (expense.note.trim()) {
      lines.push(expense.note.trim())
    }
    lines.push('')
    lines.push('─'.repeat(50))
    lines.push('')
  }

  return lines.join('\n')
}

export function exportExpensesAndDownload(expenses: Expense[]) {
  const text = exportExpensesAsText(expenses)
  const filename = `daybook-expenses-${format(new Date(), 'yyyy-MM-dd')}.txt`
  downloadTextFile(text, filename)
}
