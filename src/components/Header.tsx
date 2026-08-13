import { useState } from 'react'
import type { StorageMode } from '../lib/storage'
import { MenuDots } from './MenuDots'
import { OpenBookMark } from './OpenBookMark'

export type AppView = 'journal' | 'calendar' | 'expenses'

interface HeaderProps {
  onExport: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  username?: string
  view: AppView
  onViewChange: (view: AppView) => void
  onOpenInsights?: () => void
}

export function Header({
  onExport,
  storageMode,
  onSignOut,
  username,
  view,
  onViewChange,
  onOpenInsights,
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

      <nav className="view-tabs" aria-label="Views">
        <button
          type="button"
          className={view === 'journal' ? 'active' : ''}
          onClick={() => onViewChange('journal')}
        >
          Journal
        </button>
        <button
          type="button"
          className={view === 'calendar' ? 'active' : ''}
          onClick={() => onViewChange('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={view === 'expenses' ? 'active' : ''}
          onClick={() => onViewChange('expenses')}
        >
          Expenses
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
          <MenuDots />
        </button>

        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="header-menu" role="menu">
              {onOpenInsights && (
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenInsights()
                  }}
                >
                  Insights
                </button>
              )}
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
