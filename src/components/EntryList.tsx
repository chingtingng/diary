import { format, isToday, isYesterday } from 'date-fns'
import { isBlankEntry, type Entry } from '../types/entry'
import { getMood } from '../lib/moods'

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
  if (!trimmed) return 'New entry…'
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed
}

export function EntryList({ entries, selectedId, onSelect, onNewEntry }: EntryListProps) {
  // Keep the open blank page visible; hide other empty drafts like Apple Notes.
  const visibleEntries = entries.filter(
    (entry) => entry.id === selectedId || !isBlankEntry(entry.content, entry.mood)
  )

  return (
    <aside className="entry-list">
      <button type="button" className="new-entry-btn" data-haptic="light" onClick={onNewEntry}>
        <span className="new-entry-icon">+</span>
        New page
      </button>

      {visibleEntries.length === 0 ? (
        <p className="empty-list">No journal pages yet. Tap above to begin.</p>
      ) : (
        <ul className="entries">
          {visibleEntries.map((entry) => {
            const mood = getMood(entry.mood)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`entry-item ${selectedId === entry.id ? 'selected' : ''}`}
                  data-haptic="select"
                  onClick={() => onSelect(entry.id)}
                  style={
                    mood
                      ? ({
                          '--mood': mood.color,
                          '--mood-soft': mood.colorSoft,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <span className="entry-item-top">
                    <span className="entry-date">{formatEntryDate(entry.createdAt)}</span>
                    {mood ? (
                      <span className="entry-mood-pill">
                        <span aria-hidden>{mood.emoji}</span>
                        {mood.label}
                      </span>
                    ) : (
                      <span className="entry-time">{format(new Date(entry.createdAt), 'h:mm a')}</span>
                    )}
                  </span>
                  <span className="entry-preview">{getPreview(entry.content)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
