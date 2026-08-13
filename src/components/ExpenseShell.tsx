import { useState, type ReactNode } from 'react'
import type { StorageMode } from '../lib/storage'
import type { ExpenseScreen } from '../lib/navigation'

interface ExpenseShellProps {
  screen: ExpenseScreen
  username?: string
  storageMode: StorageMode
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onExport: () => void
  onScreenChange: (screen: ExpenseScreen) => void
  onOpenJournal: () => void
  onOpenCalendar: () => void
  onSignOut?: () => void
  children: ReactNode
}

function Avatar({ username }: { username?: string }) {
  const initial = (username?.trim()?.[0] ?? 'P').toUpperCase()
  return (
    <span className="expense-avatar" aria-hidden>
      {initial}
    </span>
  )
}

export function ExpenseShell({
  screen,
  username,
  storageMode,
  searchQuery,
  onSearchQueryChange,
  onExport,
  onScreenChange,
  onOpenJournal,
  onOpenCalendar,
  onSignOut,
  children,
}: ExpenseShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="expense-app">
      <header className="expense-topbar">
        <div className="expense-topbar-brand">
          <Avatar username={username} />
          <div>
            <p className="expense-topbar-kicker">All Cash Accounts</p>
            <h1 className="expense-topbar-title">Personal</h1>
          </div>
        </div>

        <div className="expense-topbar-actions">
          <button
            type="button"
            className="expense-icon-btn"
            data-haptic="light"
            onClick={onExport}
            aria-label="Export expenses"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M12 14V4m0 0 4 4m-4-4-4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={`expense-icon-btn${searchOpen ? ' active' : ''}`}
            data-haptic="light"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label="Search expenses"
            aria-pressed={searchOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="m16 16 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="expense-search-bar">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search notes or categories"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              className="expense-search-clear"
              onClick={() => onSearchQueryChange('')}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="expense-app-body">{children}</div>

      <nav className="expense-bottom-nav" aria-label="Expense sections">
        <button
          type="button"
          className={screen === 'list' ? 'active' : ''}
          data-haptic="select"
          onClick={() => onScreenChange('list')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-7.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          Overview
        </button>
        <button
          type="button"
          className={screen === 'insights' ? 'active' : ''}
          data-haptic="select"
          onClick={() => onScreenChange('insights')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M5 19V10m7 9V5m7 14v-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Analytics
        </button>
        <button
          type="button"
          className={screen === 'budgets' ? 'active' : ''}
          data-haptic="select"
          onClick={() => onScreenChange('budgets')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <rect
              x="4"
              y="5"
              width="16"
              height="14"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path d="M4 10h16" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Budgets
        </button>
        <button
          type="button"
          className={menuOpen ? 'active' : ''}
          data-haptic="select"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M5 7h14M5 12h14M5 17h14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          More
        </button>
      </nav>

      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="expense-more-menu" role="menu">
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              data-haptic="select"
              onClick={() => {
                setMenuOpen(false)
                onOpenJournal()
              }}
            >
              Journal
            </button>
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              data-haptic="select"
              onClick={() => {
                setMenuOpen(false)
                onOpenCalendar()
              }}
            >
              Calendar
            </button>
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              data-haptic="light"
              onClick={() => {
                setMenuOpen(false)
                onExport()
              }}
            >
              Export
            </button>
            {storageMode === 'local' && (
              <p className="menu-note">Local mode — connect Supabase to sync across devices.</p>
            )}
            {username && <p className="menu-email">@{username}</p>}
            {onSignOut && (
              <button
                type="button"
                className="menu-item menu-item-danger"
                role="menuitem"
                data-haptic="light"
                onClick={() => {
                  setMenuOpen(false)
                  onSignOut()
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
