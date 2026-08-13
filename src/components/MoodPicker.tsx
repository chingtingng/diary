import type { MoodId } from '../lib/moods'
import { MOODS } from '../lib/moods'

interface MoodPickerProps {
  value: MoodId | null
  onChange: (mood: MoodId | null) => void
}

export function MoodPicker({ value, onChange }: MoodPickerProps) {
  return (
    <div className="mood-picker" role="group" aria-label="Mood">
      <span className="mood-picker-label">Mood</span>
      <div className="mood-options">
        {MOODS.map((mood) => {
          const selected = value === mood.id
          return (
            <button
              key={mood.id}
              type="button"
              className={`mood-chip ${selected ? 'selected' : ''}`}
              data-haptic="select"
              style={
                {
                  '--mood': mood.color,
                  '--mood-soft': mood.colorSoft,
                } as React.CSSProperties
              }
              aria-pressed={selected}
              aria-label={mood.label}
              title={mood.label}
              onClick={() => onChange(selected ? null : mood.id)}
            >
              <span className="mood-emoji" aria-hidden>
                {mood.emoji}
              </span>
              <span className="mood-chip-label">{mood.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
