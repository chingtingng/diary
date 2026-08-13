import { format } from 'date-fns'
import type { Entry } from '../types/entry'

export function exportEntriesAsText(entries: Entry[]): string {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const lines: string[] = [
    'Daybook Journal Export',
    `Exported: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`,
    `Total entries: ${sorted.length}`,
    '',
    '─'.repeat(50),
    '',
  ]

  for (const entry of sorted) {
    const date = format(new Date(entry.createdAt), 'EEEE, MMMM d, yyyy')
    const time = format(new Date(entry.createdAt), 'h:mm a')
    const updated =
      entry.updatedAt !== entry.createdAt
        ? ` (edited ${format(new Date(entry.updatedAt), 'MMM d, yyyy h:mm a')})`
        : ''

    const mood = entry.mood ? ` · mood: ${entry.mood}` : ''
    lines.push(`${date} · ${time}${updated}${mood}`)
    lines.push('')
    lines.push(entry.content.trim() || '(empty entry)')
    lines.push('')
    lines.push('─'.repeat(50))
    lines.push('')
  }

  return lines.join('\n')
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportAndDownload(entries: Entry[]) {
  const text = exportEntriesAsText(entries)
  const filename = `daybook-journal-${format(new Date(), 'yyyy-MM-dd')}.txt`
  downloadTextFile(text, filename)
}
