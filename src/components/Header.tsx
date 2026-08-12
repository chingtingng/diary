import { useState } from 'react'
import type { StorageMode } from '../lib/storage'

export type AppView = 'journal' | 'calendar'

interface HeaderProps {
  onExport: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  username?: string
  view: AppView
  onViewChange: (view: AppView) => void
}

export function Header({
  onExport,
  storageMode,
  onSignOut,
  username,
  view,
  onViewChange,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="header-mark" aria-hidden>
          ✦
        </span>
        <div>
          <p className="brand-kicker">Private journal</p>
          <h1>My Diary</h1>
        </div>
      </div>

      <nav className="view-tabs" aria-label="Views">
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
          <span className="menu-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
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
