import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import type { StorageMode } from '../lib/storage'
import {
  APP_PLUGINS,
  pluginForView,
  shouldHandleSpaClick,
  viewHref,
  type AppPlugin,
  type AppView,
} from '../lib/navigation'
import { MenuDots } from './MenuDots'
import { OpenBookMark } from './OpenBookMark'

export type { AppView }

interface HeaderProps {
  onExport: () => void
  onUpload?: () => void
  storageMode: StorageMode
  onSignOut?: () => void
  username?: string
  view: AppView
  onViewChange: (view: AppView) => void
  onOpenInsights?: () => void
}

function PluginIcon({ plugin }: { plugin: AppPlugin }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    'aria-hidden': true as const,
  }

  if (plugin === 'journal') {
    return (
      <svg {...common}>
        <path
          d="M4.5 3.25h7.25A1.75 1.75 0 0 1 13.5 5v10.25L9 13.1l-4.5 2.15V5A1.75 1.75 0 0 1 4.5 3.25Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (plugin === 'expenses') {
    return (
      <svg {...common}>
        <path
          d="M4 13.5 7.2 9.8l2.3 2.1L14 6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 6.5H14v2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path
        d="M9 3.4c-2.4 0-4.35 1.75-4.35 4.35 0 3.2 3.55 6.35 4.1 6.8a.4.4 0 0 0 .5 0c.55-.45 4.1-3.6 4.1-6.8C13.35 5.15 11.4 3.4 9 3.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7.6" r="1.35" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function UploadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 10.5V3.75M8 3.75 5.6 6.1M8 3.75l2.4 2.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 11.25V12a1.5 1.5 0 0 0 1.5 1.5h6A1.5 1.5 0 0 0 12.5 12v-.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Header({
  onExport,
  onUpload,
  storageMode,
  onSignOut,
  username,
  view,
  onViewChange,
  onOpenInsights,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pluginOpen, setPluginOpen] = useState(false)
  const pluginRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const activePlugin = pluginForView(view)
  const currentPlugin =
    APP_PLUGINS.find((plugin) => plugin.id === activePlugin) ?? APP_PLUGINS[0]

  useEffect(() => {
    if (!pluginOpen) return

    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (!pluginRef.current?.contains(event.target as Node)) setPluginOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPluginOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pluginOpen])

  const go = (next: AppPlugin) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleSpaClick(event)) return
    event.preventDefault()
    setPluginOpen(false)
    onViewChange(next)
  }

  return (
    <header className="app-header app-header-plugins">
      <div className="header-brand">
        <OpenBookMark />
        <h1>Daybook</h1>

        <div className="plugin-select" ref={pluginRef}>
          <button
            type="button"
            className={`plugin-select-trigger${pluginOpen ? ' open' : ''}`}
            data-haptic="select"
            aria-haspopup="listbox"
            aria-expanded={pluginOpen}
            aria-controls={listId}
            aria-label={`Plugin: ${currentPlugin.label}`}
            onClick={() => {
              setMenuOpen(false)
              setPluginOpen((open) => !open)
            }}
          >
            <span className="plugin-select-value">{currentPlugin.label}</span>
            <svg
              className="plugin-select-chevron"
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M2.5 4.25 6 7.75l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {pluginOpen && (
            <ul className="plugin-select-menu" id={listId} role="listbox" aria-label="Plugins">
              {APP_PLUGINS.map((plugin) => {
                const active = plugin.id === activePlugin
                return (
                  <li key={plugin.id} role="option" aria-selected={active}>
                    <a
                      href={viewHref(plugin.id)}
                      className={`plugin-select-option${active ? ' active' : ''}`}
                      data-haptic="select"
                      onClick={go(plugin.id)}
                    >
                      <span className="plugin-select-icon">
                        <PluginIcon plugin={plugin.id} />
                      </span>
                      <span>{plugin.label}</span>
                      {active && (
                        <svg
                          className="plugin-select-check"
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M2.5 7.2 5.6 10.2 11.5 3.8"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="header-actions">
        {view === 'insurance' && onUpload ? (
          <button
            type="button"
            className="header-btn header-btn-icon"
            data-haptic="light"
            onClick={onUpload}
            aria-label="Upload insurance document"
            title="Upload"
          >
            <UploadGlyph />
          </button>
        ) : (
          <button type="button" className="header-btn" data-haptic="light" onClick={onExport}>
            Export
          </button>
        )}

        <button
          type="button"
          className="header-btn menu-toggle"
          data-haptic="light"
          onClick={() => {
            setPluginOpen(false)
            setMenuOpen(!menuOpen)
          }}
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
                  data-haptic="select"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenInsights()
                  }}
                >
                  Insights
                </button>
              )}
              {view === 'insurance' && (
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  data-haptic="select"
                  onClick={() => {
                    setMenuOpen(false)
                    onExport()
                  }}
                >
                  Export
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
