import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import type { Entry } from '../types/entry'

interface EntryEditorProps {
  entry: Entry | null
  onSave: (id: string, content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function EntryEditor({ entry, onSave, onDelete }: EntryEditorProps) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (entry) {
      setContent(entry.content)
      setSaved(true)
      textareaRef.current?.focus()
    } else {
      setContent('')
    }
  }, [entry?.id])

  const persist = useCallback(
    async (text: string) => {
      if (!entry) return
      setSaving(true)
      try {
        await onSave(entry.id, text)
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
      persist(text)
    }, 800)
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
          <span className="editor-empty-icon">✎</span>
          <h2>Select an entry or create a new one</h2>
          <p>Your thoughts are saved automatically as you type.</p>
        </div>
      </div>
    )
  }

  const created = new Date(entry.createdAt)
  const updated = new Date(entry.updatedAt)
  const wasEdited = entry.updatedAt !== entry.createdAt

  return (
    <div className="editor">
      <header className="editor-header">
        <div className="editor-meta">
          <time dateTime={entry.createdAt}>
            {format(created, 'EEEE, MMMM d, yyyy')}
          </time>
          <span className="editor-time">{format(created, 'h:mm a')}</span>
          {wasEdited && (
            <span className="editor-edited">
              Edited {format(updated, 'MMM d, h:mm a')}
            </span>
          )}
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
