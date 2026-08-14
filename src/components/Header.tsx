import { useState, type MouseEvent } from 'react'
import type { StorageMode } from '../lib/storage'
import type { PluginPrefs } from '../lib/prefs'
import { shouldHandleSpaClick, viewHref, type AppView } from '../lib/navigation'
import { MenuDots } from './MenuDots'
import { OpenBookMark } from './OpenBookMark'

export type { AppView }

interface HeaderProps {
  onExport: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  username?: string
  view: AppView
  plugins: PluginPrefs
  onViewChange: (view: AppView) => void
  onOpenInsights?: () => void
  onOpenSettings?: () => void
}

export function Header({
  onExport,
  storageMode,
  onSignOut,
  username,
  view,
  plugins,
  onViewChange,
  onOpenInsights,
  onOpenSettings,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (next: AppView) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleSpaClick(event)) return
    event.preventDefault()
    onViewChange(next)
  }

  return (
    <header className="app-header">
      <div className="header-brand">
        <OpenBookMark />
        <h1>Daybook</h1>
      </div>

      <nav className="view-tabs" aria-label="Views">
        {plugins.diary && (
          <>
            <a
              href={viewHref('journal')}
              className={view === 'journal' ? 'active' : ''}
              aria-current={view === 'journal' ? 'page' : undefined}
              data-haptic="select"
              onClick={go('journal')}
            >
              Journal
            </a>
            <a
              href={viewHref('calendar')}
              className={view === 'calendar' ? 'active' : ''}
              aria-current={view === 'calendar' ? 'page' : undefined}
              data-haptic="select"
              onClick={go('calendar')}
            >
              Calendar
            </a>
          </>
        )}
        {plugins.expenses && (
          <a
            href={viewHref('expenses')}
            className={view === 'expenses' ? 'active' : ''}
            aria-current={view === 'expenses' ? 'page' : undefined}
            data-haptic="select"
            onClick={go('expenses')}
          >
            Expenses
          </a>
        )}
      </nav>

      <div className="header-actions">
        {view !== 'settings' && (
          <button type="button" className="header-btn" data-haptic="light" onClick={onExport}>
            Export
          </button>
        )}

        <button
          type="button"
          className="header-btn menu-toggle"
          data-haptic="light"
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
              {onOpenSettings && (
                <button
                  type="button"
                  className={`menu-item${view === 'settings' ? ' menu-item-active' : ''}`}
                  role="menuitem"
                  data-haptic="select"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenSettings()
                  }}
                >
                  Settings
                </button>
              )}
              {onOpenInsights && (
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  data-haptic="select"
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
    </header>
  )
}
