import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Entry, EntryPatch } from '../types/entry'
import type { MoodId } from '../lib/moods'
import { getMood } from '../lib/moods'
import { MoodPicker } from './MoodPicker'

interface EntryEditorProps {
  entry: Entry | null
  onSave: (id: string, patch: EntryPatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EntryEditor({ entry, onSave, onDelete }: EntryEditorProps) {
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<MoodId | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (entry) {
      setContent(entry.content)
      setMood(entry.mood)
      setSaved(true)
      textareaRef.current?.focus()
    } else {
      setContent('')
      setMood(null)
    }
  }, [entry?.id])

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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const handleDelete = async () => {
    if (!entry) return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    await onDelete(entry.id)
  }

  if (!entry) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-content">
          <p className="eyebrow">Your journal</p>
          <h2>Pick a day, or start a fresh page</h2>
          <p>Thoughts auto-save. Tag a mood to colour your calendar.</p>
        </div>
      </div>
    )
  }

  const created = new Date(entry.createdAt)
  const moodMeta = getMood(mood)

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
          <span className="editor-time">{format(created, 'h:mm a')}</span>
        </div>
        <div className="editor-actions">
          <span className={`save-status ${saved && !saving ? 'saved' : ''}`}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Unsaved'}
          </span>
          <button type="button" className="delete-btn" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

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
