import { useState } from 'react'
import type { StorageMode } from '../lib/storage'

interface HeaderProps {
  onExport: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  userEmail?: string
}

export function Header({ onExport, storageMode, onSignOut, userEmail }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="header-logo">📔</span>
        <h1>My Diary</h1>
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
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="header-menu">
              {storageMode === 'local' && (
                <p className="menu-note">
                  Running in local mode. Connect Supabase to sync across devices.
                </p>
              )}
              {userEmail && <p className="menu-email">{userEmail}</p>}
              {onSignOut && (
                <button
                  type="button"
                  className="menu-item"
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
