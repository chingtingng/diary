import { useCallback, useEffect, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { EntryEditor } from './components/EntryEditor'
import { EntryList } from './components/EntryList'
import { Header, type AppView } from './components/Header'
import { MoodCalendar } from './components/MoodCalendar'
import { exportAndDownload } from './lib/export'
import { getEntry } from './lib/storage'
import { useAuth } from './hooks/useAuth'
import { useEntries } from './hooks/useEntries'
import type { Entry, EntryPatch } from './types/entry'
import './index.css'

function App() {
  const {
    user,
    username,
    loading: authLoading,
    signIn,
    signUp,
    signOut,
    isSupabaseConfigured,
  } = useAuth()
  const { entries, loading, addEntry, saveEntry, removeEntry, storageMode } = useEntries(
    user?.id
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showList, setShowList] = useState(true)
  const [view, setView] = useState<AppView>('journal')

  useEffect(() => {
    if (!selectedId) {
      setSelectedEntry(null)
      return
    }
    const fromList = entries.find((e) => e.id === selectedId)
    if (fromList) {
      setSelectedEntry(fromList)
      return
    }
    getEntry(selectedId, user?.id).then(setSelectedEntry)
  }, [selectedId, entries, user?.id])

  const handleNewEntry = useCallback(async () => {
    const entry = await addEntry()
    setSelectedId(entry.id)
    setView('journal')
    setShowList(false)
  }, [addEntry])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setView('journal')
    setShowList(false)
  }, [])

  const handleCalendarSelect = useCallback(
    async (date: Date, entryId?: string) => {
      if (entryId) {
        setSelectedId(entryId)
        setView('journal')
        setShowList(false)
        return
      }
      const stamped = new Date(date)
      stamped.setHours(12, 0, 0, 0)
      const entry = await addEntry(stamped.toISOString())
      setSelectedId(entry.id)
      setView('journal')
      setShowList(false)
    },
    [addEntry]
  )

  const handleSave = useCallback(
    async (id: string, patch: EntryPatch) => {
      await saveEntry(id, patch)
    },
    [saveEntry]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await removeEntry(id)
      setSelectedId(null)
      setShowList(true)
    },
    [removeEntry]
  )

  const handleExport = useCallback(() => {
    if (entries.length === 0) {
      alert('No entries to export yet.')
      return
    }
    exportAndDownload(entries)
  }, [entries])

  if (isSupabaseConfigured && authLoading) {
    return (
      <div className="loading-screen">
        <span className="loading-spinner" />
        <p>Loading…</p>
      </div>
    )
  }

  if (isSupabaseConfigured && !user) {
    return <AuthForm onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <div className="app">
      <Header
        onExport={handleExport}
        storageMode={storageMode}
        onSignOut={isSupabaseConfigured ? signOut : undefined}
        username={username}
        view={view}
        onViewChange={(next) => {
          setView(next)
          if (next === 'calendar') setShowList(true)
        }}
      />

      <main className="main">
        {view === 'calendar' ? (
          <div className="calendar-view">
            <MoodCalendar
              entries={entries}
              selectedId={selectedId}
              onSelectDate={handleCalendarSelect}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              className="mobile-back"
              onClick={() => setShowList(true)}
              aria-hidden={showList}
              style={{ visibility: showList ? 'hidden' : 'visible' }}
            >
              ← Pages
            </button>

            <div className="layout">
              <div className={`panel list-panel ${showList ? 'visible' : ''}`}>
                {loading ? (
                  <p className="loading-text">Loading entries…</p>
                ) : (
                  <EntryList
                    entries={entries}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onNewEntry={handleNewEntry}
                  />
                )}
              </div>

              <div className={`panel editor-panel ${!showList ? 'visible' : ''}`}>
                <EntryEditor
                  entry={selectedEntry}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
