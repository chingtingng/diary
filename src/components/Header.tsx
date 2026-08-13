import { useState } from 'react'
import type { StorageMode } from '../lib/storage'
import { MenuDots } from './MenuDots'
import { OpenBookMark } from './OpenBookMark'

export type AppMode = 'journal' | 'expenses'
export type AppView = 'journal' | 'calendar'

interface HeaderProps {
  onExport: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  username?: string
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  view: AppView
  onViewChange: (view: AppView) => void
}

export function Header({
  onExport,
  storageMode,
  onSignOut,
  username,
  mode,
  onModeChange,
  view,
  onViewChange,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="header-brand">
        <OpenBookMark />
        <div>
          <p className="brand-kicker">Private daybook</p>
          <h1>Daybook</h1>
        </div>
      </div>

      <div className="header-nav">
        <nav className="mode-tabs" aria-label="App mode">
          <button
            type="button"
            className={mode === 'journal' ? 'active' : ''}
            onClick={() => onModeChange('journal')}
          >
            Journal
          </button>
          <button
            type="button"
            className={mode === 'expenses' ? 'active' : ''}
            onClick={() => onModeChange('expenses')}
          >
            Expenses
          </button>
        </nav>

        {mode === 'journal' && (
          <nav className="view-tabs" aria-label="Journal views">
            <button
              type="button"
              className={view === 'journal' ? 'active' : ''}
              onClick={() => onViewChange('journal')}
            >
              Pages
            </button>
            <button
              type="button"
              className={view === 'calendar' ? 'active' : ''}
              onClick={() => onViewChange('calendar')}
            >
              Calendar
            </button>
          </nav>
        )}
      </div>

      <div className="header-actions">
        <button type="button" className="header-btn" onClick={onExport}>
          Export
        </button>

        <button
          type="button"
          className="header-btn menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MenuDots />
        </button>

        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="header-menu" role="menu">
              {storageMode === 'local' && (
                <p className="menu-note">
                  Local mode — connect Supabase to sync across devices.
                </p>
              )}
              {username && <p className="menu-email">@{username}</p>}
              {onSignOut && (
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
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
    </header>
  )
}
