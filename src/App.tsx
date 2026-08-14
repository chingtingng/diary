import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { EntryEditor, type EntryDraft } from './components/EntryEditor'
import { EntryList } from './components/EntryList'
import { ExpenseInsights } from './components/ExpenseInsights'
import { ExpenseTracker } from './components/ExpenseTracker'
import { Header } from './components/Header'
import { InsuranceTracker } from './components/InsuranceTracker'
import { MoodCalendar } from './components/MoodCalendar'
import { exportAndDownload } from './lib/export'
import { exportExpensesAndDownload } from './lib/expenseExport'
import {
  defaultLocation,
  JOURNAL_TABS,
  locationToPath,
  parsePath,
  shouldHandleSpaClick,
  viewHref,
  type AppLocation,
  type AppView,
  type InsuranceScreen,
} from './lib/navigation'
import { readLastView, writeLastView } from './lib/prefs'
import { getEntry } from './lib/storage'
import { useAuth } from './hooks/useAuth'
import { useEntries } from './hooks/useEntries'
import { useExpenses } from './hooks/useExpenses'
import { useInsurance } from './hooks/useInsurance'
import { isBlankEntry, type Entry, type EntryPatch } from './types/entry'
import './index.css'

function initialLocation(): AppLocation {
  const path = window.location.pathname
  if (path === '/' || path === '') {
    return defaultLocation(readLastView() ?? 'journal')
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
  const {
    policies,
    documents,
    loading: insuranceLoading,
    addPolicy,
    removePolicy,
    addDocument,
    removeDocument,
    openDocument,
  } = useInsurance(user?.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showList, setShowList] = useState(true)
  const [location, setLocation] = useState<AppLocation>(initialLocation)
  const [uploadRequestKey, setUploadRequestKey] = useState(0)
  const view = location.view
  const expenseScreen = location.expenseScreen
  const insuranceScreen = location.insuranceScreen
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
    goTo(defaultLocation('journal'))
    setShowList(false)
  }, [addEntry, discardBlankEntry, goTo, selectEntry])

  const handleSelect = useCallback(
    async (id: string) => {
      if (id !== selectedIdRef.current) {
        await discardBlankEntry(selectedIdRef.current)
      }
      selectEntry(id)
      goTo(defaultLocation('journal'))
      setShowList(false)
    },
    [discardBlankEntry, goTo, selectEntry]
  )

  const handleCalendarSelect = useCallback(
    async (date: Date, entryId?: string) => {
      await discardBlankEntry(selectedIdRef.current)

      if (entryId) {
        selectEntry(entryId)
        goTo(defaultLocation('journal'))
        setShowList(false)
        return
      }
      const stamped = new Date(date)
      stamped.setHours(12, 0, 0, 0)
      const entry = await addEntry(stamped.toISOString())
      selectEntry(entry.id)
      goTo(defaultLocation('journal'))
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
      if (next !== 'journal') {
        const discarded = await discardBlankEntry(selectedIdRef.current)
        if (discarded) selectEntry(null)
        setShowList(true)
      }
      goTo(defaultLocation(next))
    },
    [discardBlankEntry, goTo, selectEntry]
  )

  const handleOpenInsights = useCallback(() => {
    goTo({ view: 'expenses', expenseScreen: 'insights', insuranceScreen: 'overview' })
  }, [goTo])

  const handleInsuranceScreen = useCallback(
    (screen: InsuranceScreen) => {
      goTo({ view: 'insurance', expenseScreen: 'list', insuranceScreen: screen })
    },
    [goTo]
  )

  const handleExport = useCallback(() => {
    if (view === 'expenses') {
      if (expenses.length === 0) {
        alert('No expenses to export yet.')
        return
      }
      exportExpensesAndDownload(expenses)
      return
    }

    if (view === 'insurance') {
      if (policies.length === 0 && documents.length === 0) {
        alert('No insurance data to export yet.')
        return
      }
      const lines = [
        'Daybook — Insurance',
        '',
        'Policies',
        ...policies.map(
          (p) =>
            `- ${p.policyName} (${p.insurer || '—'}) · ${p.policyType} · $${p.premium}/${p.premiumFrequency} · renewal ${p.renewalDate ?? '—'} · ${p.status}`
        ),
        '',
        'Documents',
        ...documents.map(
          (d) =>
            `- ${d.fileName} · ${d.insurer || d.policyName || 'unlinked'} · ${d.fileType} · ${d.uploadedAt}`
        ),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `daybook-insurance-${new Date().toISOString().slice(0, 10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    const exportable = entries.filter((e) => !isBlankEntry(e.content, e.mood))
    if (exportable.length === 0) {
      alert('No entries to export yet.')
      return
    }
    exportAndDownload(exportable)
  }, [documents, entries, expenses, policies, view])

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
        onUpload={
          view === 'insurance'
            ? () => {
                handleInsuranceScreen(insuranceScreen)
                setUploadRequestKey((key) => key + 1)
              }
            : undefined
        }
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
                onClose={() =>
                  goTo({ view: 'expenses', expenseScreen: 'list', insuranceScreen: 'overview' })
                }
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
        ) : view === 'insurance' ? (
          <div className="expenses-shell">
            <InsuranceTracker
              policies={policies}
              documents={documents}
              loading={insuranceLoading}
              screen={insuranceScreen}
              onScreenChange={handleInsuranceScreen}
              onAddPolicy={addPolicy}
              onDeletePolicy={removePolicy}
              onUploadDocument={addDocument}
              onDeleteDocument={removeDocument}
              onOpenDocument={openDocument}
              uploadRequestKey={uploadRequestKey}
            />
          </div>
        ) : (
          <div className="journal-shell">
            <nav
              className="journal-tabs expense-period-tabs"
              role="tablist"
              aria-label="Journal"
            >
              {JOURNAL_TABS.map((tab) => (
                <a
                  key={tab.id}
                  href={viewHref(tab.id)}
                  className={view === tab.id ? 'active' : ''}
                  aria-current={view === tab.id ? 'page' : undefined}
                  data-haptic="select"
                  onClick={(event) => {
                    if (!shouldHandleSpaClick(event)) return
                    event.preventDefault()
                    void handleViewChange(tab.id)
                  }}
                >
                  {tab.label}
                </a>
              ))}
            </nav>

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
                  className={`mobile-back${!showList ? ' visible' : ''}`}
                  data-haptic="select"
                  onClick={handleBackToList}
                  aria-hidden={showList}
                  hidden={showList}
                >
                  ← Back to journal
                </button>

                <div className={`layout${!showList ? ' has-back' : ''}`}>
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
          </div>
        )}
      </main>
    </div>
  )
}

export default App
