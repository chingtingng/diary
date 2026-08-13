import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { EntryEditor, type EntryDraft } from './components/EntryEditor'
import { EntryList } from './components/EntryList'
import { ExpenseInsights } from './components/ExpenseInsights'
import { ExpenseTracker } from './components/ExpenseTracker'
import { Header } from './components/Header'
import { MoodCalendar } from './components/MoodCalendar'
import { exportAndDownload } from './lib/export'
import { exportExpensesAndDownload } from './lib/expenseExport'
import {
  locationToPath,
  parsePath,
  type AppLocation,
  type AppView,
} from './lib/navigation'
import { readLastView, writeLastView } from './lib/prefs'
import { getEntry } from './lib/storage'
import { useAuth } from './hooks/useAuth'
import { useEntries } from './hooks/useEntries'
import { useExpenses } from './hooks/useExpenses'
import { isBlankEntry, type Entry, type EntryPatch } from './types/entry'
import './index.css'

function initialLocation(): AppLocation {
  const path = window.location.pathname
  if (path === '/' || path === '') {
    return { view: readLastView() ?? 'journal', expenseScreen: 'list' }
  }
  return parsePath(path)
}

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
  const {
    expenses,
    loading: expensesLoading,
    addExpense,
    saveExpense,
    removeExpense,
  } = useExpenses(user?.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showList, setShowList] = useState(true)
  const [location, setLocation] = useState<AppLocation>(initialLocation)
  const view = location.view
  const expenseScreen = location.expenseScreen
  const draftRef = useRef<EntryDraft | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const discardingIdsRef = useRef(new Set<string>())

  const goTo = useCallback((next: AppLocation, mode: 'push' | 'replace' = 'push') => {
    const path = locationToPath(next)
    if (window.location.pathname !== path) {
      if (mode === 'replace') window.history.replaceState(next, '', path)
      else window.history.pushState(next, '', path)
    }
    writeLastView(next.view)
    setLocation(next)
  }, [])

  useEffect(() => {
    const current = locationToPath(location)
    if (window.location.pathname !== current) {
      window.history.replaceState(location, '', current)
    }
  }, [location])

  useEffect(() => {
    const onPopState = () => {
      const next = parsePath(window.location.pathname)
      writeLastView(next.view)
      setLocation(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const selectEntry = useCallback((id: string | null) => {
    selectedIdRef.current = id
    setSelectedId(id)
  }, [])

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
    if (discardingIdsRef.current.has(selectedId)) {
      setSelectedEntry(null)
      return
    }
    getEntry(selectedId, user?.id).then((entry) => {
      if (entry) setSelectedEntry(entry)
      else selectEntry(null)
    })
  }, [selectedId, entries, user?.id, selectEntry])

  const handleDraftChange = useCallback((draft: EntryDraft | null) => {
    draftRef.current = draft
  }, [])

  const discardBlankEntry = useCallback(
    async (id: string | null | undefined) => {
      if (!id || discardingIdsRef.current.has(id)) return false

      const draft = draftRef.current?.id === id ? draftRef.current : null

      // In-progress typing/mood wins so we don't delete before autosave.
      if (draft && !isBlankEntry(draft.content, draft.mood)) return false

      const stored =
        entries.find((e) => e.id === id) ??
        (selectedEntry?.id === id ? selectedEntry : null) ??
        (await getEntry(id, user?.id))

      if (!stored || !isBlankEntry(stored.content, stored.mood)) return false

      discardingIdsRef.current.add(id)
      if (draftRef.current?.id === id) draftRef.current = null

      try {
        await removeEntry(id)
        return true
      } finally {
        discardingIdsRef.current.delete(id)
      }
    },
    [entries, removeEntry, selectedEntry, user?.id]
  )

  const handleNewEntry = useCallback(async () => {
    await discardBlankEntry(selectedIdRef.current)
    const entry = await addEntry()
    selectEntry(entry.id)
    goTo({ view: 'journal', expenseScreen: 'list' })
    setShowList(false)
  }, [addEntry, discardBlankEntry, goTo, selectEntry])

  const handleSelect = useCallback(
    async (id: string) => {
      if (id !== selectedIdRef.current) {
        await discardBlankEntry(selectedIdRef.current)
      }
      selectEntry(id)
      goTo({ view: 'journal', expenseScreen: 'list' })
      setShowList(false)
    },
    [discardBlankEntry, goTo, selectEntry]
  )

  const handleCalendarSelect = useCallback(
    async (date: Date, entryId?: string) => {
      await discardBlankEntry(selectedIdRef.current)

      if (entryId) {
        selectEntry(entryId)
        goTo({ view: 'journal', expenseScreen: 'list' })
        setShowList(false)
        return
      }
      const stamped = new Date(date)
      stamped.setHours(12, 0, 0, 0)
      const entry = await addEntry(stamped.toISOString())
      selectEntry(entry.id)
      goTo({ view: 'journal', expenseScreen: 'list' })
      setShowList(false)
    },
    [addEntry, discardBlankEntry, goTo, selectEntry]
  )

  const handleSave = useCallback(
    async (id: string, patch: EntryPatch) => {
      if (discardingIdsRef.current.has(id)) return
      await saveEntry(id, patch)
    },
    [saveEntry]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (draftRef.current?.id === id) draftRef.current = null
      await removeEntry(id)
      selectEntry(null)
      setShowList(true)
    },
    [removeEntry, selectEntry]
  )

  const handleBackToList = useCallback(async () => {
    const discarded = await discardBlankEntry(selectedIdRef.current)
    if (discarded) selectEntry(null)
    setShowList(true)
  }, [discardBlankEntry, selectEntry])

  const handleViewChange = useCallback(
    async (next: AppView) => {
      if (next === 'calendar' || next === 'expenses') {
        const discarded = await discardBlankEntry(selectedIdRef.current)
        if (discarded) selectEntry(null)
        setShowList(true)
      }
      goTo({ view: next, expenseScreen: 'list' })
    },
    [discardBlankEntry, goTo, selectEntry]
  )

  const handleOpenInsights = useCallback(() => {
    goTo({ view: 'expenses', expenseScreen: 'insights' })
  }, [goTo])

  const handleExport = useCallback(() => {
    if (view === 'expenses') {
      if (expenses.length === 0) {
        alert('No expenses to export yet.')
        return
      }
      exportExpensesAndDownload(expenses)
      return
    }

    const exportable = entries.filter((e) => !isBlankEntry(e.content, e.mood))
    if (exportable.length === 0) {
      alert('No entries to export yet.')
      return
    }
    exportAndDownload(exportable)
  }, [entries, expenses, view])

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
        onViewChange={handleViewChange}
        onOpenInsights={
          view === 'expenses' && expenseScreen === 'list' ? handleOpenInsights : undefined
        }
      />

      <main className="main">
        {view === 'expenses' ? (
          <div className="expenses-shell">
            {expenseScreen === 'insights' ? (
              <ExpenseInsights
                expenses={expenses}
                onClose={() => goTo({ view: 'expenses', expenseScreen: 'list' })}
              />
            ) : (
              <ExpenseTracker
                expenses={expenses}
                loading={expensesLoading}
                onAdd={addExpense}
                onSave={async (id, patch) => {
                  await saveExpense(id, patch)
                }}
                onDelete={removeExpense}
              />
            )}
          </div>
        ) : view === 'calendar' ? (
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
              data-haptic="select"
              onClick={handleBackToList}
              aria-hidden={showList}
              style={{ visibility: showList ? 'hidden' : 'visible' }}
            >
              ← Back to journal
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
                  key={selectedEntry?.id ?? 'empty'}
                  entry={selectedEntry}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onDraftChange={handleDraftChange}
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
