import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import type { Entry } from '../types/entry'
import { MOODS, getMood } from '../lib/moods'

interface MoodCalendarProps {
  entries: Entry[]
  onSelectDate: (date: Date, entryId?: string) => void
  selectedId: string | null
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function MoodCalendar({ entries, onSelectDate, selectedId }: MoodCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const entriesByDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const entry of entries) {
      const key = dayKey(new Date(entry.createdAt))
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return map
  }, [entries])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const writtenThisMonth = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of entries) {
      const d = new Date(entry.createdAt)
      if (isSameMonth(d, month)) keys.add(dayKey(d))
    }
    return keys.size
  }, [entries, month])

  const daysInMonth = endOfMonth(month).getDate()

  return (
    <section className="mood-calendar">
      <header className="calendar-header">
        <div>
          <p className="eyebrow">Emotional landscape</p>
          <h2 className="calendar-title">{format(month, 'MMMM yyyy')}</h2>
          <p className="calendar-subtitle">
            {writtenThisMonth}/{daysInMonth} days written
          </p>
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
            ‹
          </button>
          <button type="button" className="today-btn" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </button>
          <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            ›
          </button>
        </div>
      </header>

      <div className="calendar-weekdays">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const key = dayKey(day)
          const dayEntries = entriesByDay.get(key) ?? []
          const primary = dayEntries.find((e) => e.mood) ?? dayEntries[0]
          const mood = getMood(primary?.mood)
          const inMonth = isSameMonth(day, month)
          const selected = primary ? selectedId === primary.id : false

          return (
            <button
              key={key}
              type="button"
              className={[
                'calendar-day',
                inMonth ? '' : 'outside',
                isToday(day) ? 'today' : '',
                dayEntries.length ? 'has-entry' : '',
                mood ? 'has-mood' : '',
                selected ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                mood
                  ? ({
                      '--day-mood': mood.color,
                      '--day-mood-soft': mood.colorSoft,
                    } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onSelectDate(day, primary?.id)}
            >
              <span className="day-number">{format(day, 'd')}</span>
              <span className="day-emoji" aria-hidden>
                {mood ? mood.emoji : dayEntries.length ? '📝' : ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="calendar-legend">
        {MOODS.map((mood) => (
          <span key={mood.id} className="legend-item">
            <span className="legend-emoji">{mood.emoji}</span>
            {mood.label}
          </span>
        ))}
      </div>
    </section>
  )
}
