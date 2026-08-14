import type { PluginId, PluginPrefs } from '../lib/prefs'

interface PluginOption {
  id: PluginId
  title: string
  description: string
}

const PLUGINS: PluginOption[] = [
  {
    id: 'diary',
    title: 'Diary',
    description: 'Journal entries, moods, and the calendar view.',
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'Spending log, categories, and insights.',
  },
]

interface SettingsProps {
  plugins: PluginPrefs
  onChange: (plugins: PluginPrefs) => void
}

export function Settings({ plugins, onChange }: SettingsProps) {
  const enabledCount = (plugins.diary ? 1 : 0) + (plugins.expenses ? 1 : 0)

  const toggle = (id: PluginId) => {
    const next = { ...plugins, [id]: !plugins[id] }
    // Keep at least one plugin on so the app always has a home view.
    if (!next.diary && !next.expenses) return
    onChange(next)
  }

  return (
    <div className="settings-view">
      <header className="settings-header">
        <p className="eyebrow">Customise</p>
        <h2 className="settings-title">Plugins</h2>
        <p className="settings-lead">
          Choose what shows in your daybook. {enabledCount} of {PLUGINS.length}{' '}
          plugins on.
        </p>
      </header>

      <ul className="settings-plugin-list">
        {PLUGINS.map((plugin) => {
          const on = plugins[plugin.id]
          const alone = on && enabledCount === 1
          return (
            <li key={plugin.id} className="settings-plugin">
              <div className="settings-plugin-copy">
                <p className="settings-plugin-title">{plugin.title}</p>
                <p className="settings-plugin-desc">{plugin.description}</p>
              </div>
              <button
                type="button"
                className={`settings-switch${on ? ' on' : ''}`}
                role="switch"
                aria-checked={on}
                aria-label={`${plugin.title} ${on ? 'on' : 'off'}`}
                aria-disabled={alone || undefined}
                data-haptic="select"
                disabled={alone}
                title={alone ? 'Keep at least one plugin on' : undefined}
                onClick={() => toggle(plugin.id)}
              >
                <span className="settings-switch-thumb" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
