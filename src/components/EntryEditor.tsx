import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { Entry, EntryPatch } from '../types/entry'
import type { MoodId } from '../lib/moods'
import { getMood } from '../lib/moods'
import { atLocalNoon } from '../lib/dates'
import { DateField } from './DateField'
import { MoodPicker } from './MoodPicker'
import { MenuDots } from './MenuDots'

export type EntryDraft = {
  id: string
  content: string
  mood: MoodId | null
}

interface EntryEditorProps {
  entry: Entry | null
  onSave: (id: string, patch: EntryPatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDraftChange?: (draft: EntryDraft | null) => void
}

function withPreservedTime(day: Date, previousIso: string): string {
  const previous = parseISO(previousIso)
  const next = new Date(day)
  next.setHours(
    previous.getHours(),
    previous.getMinutes(),
    previous.getSeconds(),
    previous.getMilliseconds()
  )
  return next.toISOString()
}

export function EntryEditor({ entry, onSave, onDelete, onDraftChange }: EntryEditorProps) {
  const [content, setContent] = useState(entry?.content ?? '')
  const [mood, setMood] = useState<MoodId | null>(entry?.mood ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }

    if (entry) {
      setContent(entry.content)
      setMood(entry.mood)
      setSaved(true)
      setMenuOpen(false)
      setEditingDate(false)
      textareaRef.current?.focus()
    } else {
      setContent('')
      setMood(null)
      setMenuOpen(false)
      setEditingDate(false)
    }
  }, [entry?.id])

  useEffect(() => {
    if (!entry) {
      onDraftChange?.(null)
      return
    }
    onDraftChange?.({ id: entry.id, content, mood })
  }, [entry, content, mood, onDraftChange])

  const persist = useCallback(
    async (patch: EntryPatch) => {
      if (!entry) return
      setSaving(true)
      try {
        await onSave(entry.id, patch)
        setSaved(true)
      } finally {
        setSaving(false)
      }
    },
    [entry, onSave]
  )

  const handleChange = (text: string) => {
    setContent(text)
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persist({ content: text })
    }, 800)
  }

  const handleMood = async (next: MoodId | null) => {
    setMood(next)
    setSaved(false)
    await persist({ mood: next })
  }

  const handleDateChange = async (next: Date) => {
    if (!entry) return
    setSaved(false)
    await persist({ createdAt: withPreservedTime(next, entry.createdAt) })
    setEditingDate(false)
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleDelete = async () => {
    if (!entry) return
    setMenuOpen(false)
    if (!confirm('Delete this entry? This cannot be undone.')) return
    await onDelete(entry.id)
  }

  if (!entry) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-content">
          <p className="eyebrow">Journal</p>
          <h2>Pick a day, or start a fresh page</h2>
          <p>Thoughts auto-save. Tag a mood to colour your calendar.</p>
        </div>
      </div>
    )
  }

  const created = new Date(entry.createdAt)
  const moodMeta = getMood(mood)
  const saveLabel = saving ? 'Saving…' : saved ? 'Saved' : null

  return (
    <div
      className="editor"
      style={
        moodMeta
          ? ({ '--accent-soft': moodMeta.colorSoft, '--accent': moodMeta.color } as React.CSSProperties)
          : undefined
      }
    >
      <header className="editor-header">
        <div className="editor-meta">
          <time dateTime={entry.createdAt}>{format(created, 'EEEE, MMMM d')}</time>
          <div className="editor-meta-row">
            <span className="editor-time">{format(created, 'h:mm a')}</span>
            {saveLabel && (
              <>
                <span className="editor-meta-sep" aria-hidden>
                  ·
                </span>
                <span className="save-status" aria-live="polite">
                  {saveLabel}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="editor-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Entry options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MenuDots />
          </button>

          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="editor-menu" role="menu">
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setEditingDate(true)
                  }}
                >
                  Edit date
                </button>
                <button
                  type="button"
                  className="menu-item menu-item-danger"
                  role="menuitem"
                  onClick={handleDelete}
                >
                  Delete entry
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {editingDate ? (
        <div className="editor-date-edit">
          <DateField
            label="Entry date"
            value={atLocalNoon(created)}
            onChange={(next) => {
              void handleDateChange(next)
            }}
          />
          <button
            type="button"
            className="expense-form-cancel"
            data-haptic="light"
            onClick={() => setEditingDate(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <MoodPicker value={mood} onChange={handleMood} />

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="What's on your mind today?"
        spellCheck
      />
    </div>
  )
}
