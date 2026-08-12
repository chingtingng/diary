import { format, isToday, isYesterday } from 'date-fns'
import type { Entry } from '../types/entry'

interface EntryListProps {
  entries: Entry[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNewEntry: () => void
}

function formatEntryDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d, yyyy')
}

function getPreview(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return 'New entry...'
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
}

export function EntryList({ entries, selectedId, onSelect, onNewEntry }: EntryListProps) {
  return (
    <aside className="entry-list">
      <button type="button" className="new-entry-btn" onClick={onNewEntry}>
        <span className="new-entry-icon">+</span>
        New Entry
      </button>

      {entries.length === 0 ? (
        <p className="empty-list">No entries yet. Start writing!</p>
      ) : (
        <ul className="entries">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`entry-item ${selectedId === entry.id ? 'selected' : ''}`}
                onClick={() => onSelect(entry.id)}
              >
                <span className="entry-date">{formatEntryDate(entry.createdAt)}</span>
                <span className="entry-time">{format(new Date(entry.createdAt), 'h:mm a')}</span>
                <span className="entry-preview">{getPreview(entry.content)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
