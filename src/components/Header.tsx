import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import type { StorageMode } from '../lib/storage'
import type { PluginPrefs } from '../lib/prefs'
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
  plugins: PluginPrefs
  onViewChange: (view: AppView) => void
  onOpenInsights?: () => void
  onOpenSettings?: () => void
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
    // Open daybook / journal
    return (
      <svg {...common}>
        <path
          d="M9 3.4C7.1 2.55 4.55 2.2 2.4 2.7v11.1c2.15-.35 4.5.2 6.6 1 2.1-.8 4.45-1.35 6.6-1V2.7C13.45 2.2 10.9 2.55 9 3.4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M9 3.55v11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  if (plugin === 'expenses') {
    // Receipt / spending log
    return (
      <svg {...common}>
        <path
          d="M5 2.75h8v12.5l-1.35-1-1.35 1-1.3-1-1.3 1-1.35-1-1.35 1V2.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M7 6h4M7 8.75h4M7 11.5h2.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Shield — insurance / protection
  return (
    <svg {...common}>
      <path
        d="M9 2.6 14.25 4.4v4.35c0 3.2-2.15 5.45-5.25 6.65C5.9 14.2 3.75 11.95 3.75 8.75V4.4L9 2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6.85 8.55 8.35 10l2.9-3.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function isPluginEnabled(plugin: AppPlugin, plugins: PluginPrefs): boolean {
  if (plugin === 'journal') return plugins.diary
  if (plugin === 'expenses') return plugins.expenses
  return plugins.insurance
}

export function Header({
  onExport,
  onUpload,
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
  const [pluginOpen, setPluginOpen] = useState(false)
  const pluginRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const visiblePlugins = APP_PLUGINS.filter((plugin) => isPluginEnabled(plugin.id, plugins))
  const activePlugin = pluginForView(view)
  const currentPlugin =
    visiblePlugins.find((plugin) => plugin.id === activePlugin) ?? visiblePlugins[0]

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

        {currentPlugin ? (
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
                {visiblePlugins.map((plugin) => {
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
        ) : null}
      </div>

      <div className="header-actions">
        {view !== 'settings' &&
          (view === 'insurance' && onUpload ? (
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
          ))}

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
