import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import type { Entry } from '../types/entry'
import { MOODS, getMood } from '../lib/moods'
import { exportYearMoodBoardPng } from '../lib/moodBoardExport'

type CalendarMode = 'emoji' | 'board'
type BoardScope = 'month' | 'year'

interface MoodCalendarProps {
  entries: Entry[]
  onSelectDate: (date: Date, entryId?: string) => void
  selectedId: string | null
}

function dayKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function MoodCalendar({ entries, onSelectDate, selectedId }: MoodCalendarProps) {
  const [mode, setMode] = useState<CalendarMode>('emoji')
  const [boardScope, setBoardScope] = useState<BoardScope>('year')
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [exporting, setExporting] = useState(false)

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

  const writtenThisYear = useMemo(() => {
    let count = 0
    const seen = new Set<string>()
    for (const entry of entries) {
      if (!entry.mood) continue
      const d = new Date(entry.createdAt)
      if (d.getFullYear() !== year) continue
      const key = dayKey(d)
      if (seen.has(key)) continue
      seen.add(key)
      count += 1
    }
    return count
  }, [entries, year])

  const daysInMonth = endOfMonth(month).getDate()
  const showMonthGrid = mode === 'emoji' || (mode === 'board' && boardScope === 'month')
  const showYearBoard = mode === 'board' && boardScope === 'year'
  const viewingThisMonth = isSameMonth(month, new Date())
  const viewingThisYear = year === new Date().getFullYear()

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportYearMoodBoardPng(entries, year)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not export mood board')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className={`mood-calendar ${mode === 'board' ? 'board-mode' : 'emoji-mode'}`}>
      <div className="calendar-toolbar">
        <div className="segmented" role="tablist" aria-label="Calendar style">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'emoji'}
            className={mode === 'emoji' ? 'active' : ''}
            onClick={() => setMode('emoji')}
          >
            Emojis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'board'}
            className={mode === 'board' ? 'active' : ''}
            onClick={() => {
              setMode('board')
              setYear(month.getFullYear())
            }}
          >
            Mood board
          </button>
        </div>

        {mode === 'board' && (
          <div className="segmented segmented-sm" role="tablist" aria-label="Mood board range">
            <button
              type="button"
              role="tab"
              aria-selected={boardScope === 'month'}
              className={boardScope === 'month' ? 'active' : ''}
              onClick={() => setBoardScope('month')}
            >
              Month
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={boardScope === 'year'}
              className={boardScope === 'year' ? 'active' : ''}
              onClick={() => {
                setBoardScope('year')
                setYear(month.getFullYear())
              }}
            >
              Year
            </button>
          </div>
        )}
      </div>

      <header className="calendar-header">
        <div>
          <p className="eyebrow">Emotional landscape</p>
          <h2 className="calendar-title">
            {showYearBoard ? String(year) : format(month, 'MMMM yyyy')}
          </h2>
          <p className="calendar-subtitle">
            {showYearBoard
              ? `${writtenThisYear} days with a mood`
              : `${writtenThisMonth}/${daysInMonth} days written`}
          </p>
        </div>

        <div className="calendar-nav">
          {showYearBoard ? (
            <>
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label="Previous year"
              >
                ‹
              </button>
              <button
                type="button"
                className={`today-btn${viewingThisYear ? ' current' : ''}`}
                onClick={() => setYear(new Date().getFullYear())}
                disabled={viewingThisYear}
              >
                This year
              </button>
              <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
                ›
              </button>
              <button
                type="button"
                className="export-board-btn"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : 'Export PNG'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMonth((m) => subMonths(m, 1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <button
                type="button"
                className={`today-btn${viewingThisMonth ? ' current' : ''}`}
                onClick={() => setMonth(startOfMonth(new Date()))}
                disabled={viewingThisMonth}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="Next month"
              >
                ›
              </button>
            </>
          )}
        </div>
      </header>

      {showMonthGrid && (
        <>
          <div className="calendar-weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={`${d}-${i}`}>{d}</span>
            ))}
          </div>

          <div className={`calendar-grid ${mode === 'board' ? 'board-grid' : ''}`}>
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
                    mode === 'board' ? 'board-day' : '',
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
                          '--day-mood-soft':
                            mode === 'board' ? mood.color : mood.colorSoft,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onClick={() => onSelectDate(day, primary?.id)}
                  aria-label={
                    mood
                      ? `${format(day, 'MMMM d')}, ${mood.label}`
                      : format(day, 'MMMM d')
                  }
                >
                  {mode === 'emoji' ? (
                    <>
                      <span className="day-number">{format(day, 'd')}</span>
                      <span className="day-emoji" aria-hidden>
                        {mood ? mood.emoji : dayEntries.length ? '📝' : ''}
                      </span>
                    </>
                  ) : (
                    <span className="day-number board-day-number">{format(day, 'd')}</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {showYearBoard && (
        <div className="year-board" role="img" aria-label={`${year} mood board`}>
          <div className="year-board-day-headers" aria-hidden>
            <span className="year-board-spacer" />
            {Array.from({ length: 31 }, (_, i) => (
              <span
                key={i}
                className={i === 0 || (i + 1) % 5 === 0 || i === 30 ? 'show' : ''}
              >
                {i === 0 || (i + 1) % 5 === 0 || i === 30 ? i + 1 : ''}
              </span>
            ))}
          </div>

          {Array.from({ length: 12 }, (_, monthIndex) => {
            const monthDate = new Date(year, monthIndex, 1)
            const dim = getDaysInMonth(monthDate)
            return (
              <div key={monthIndex} className="year-board-row">
                <span className="year-board-label">{format(monthDate, 'MMM')}</span>
                {Array.from({ length: 31 }, (_, dayIndex) => {
                  const dayNum = dayIndex + 1
                  if (dayNum > dim) {
                    return <span key={dayNum} className="year-board-cell empty" />
                  }
                  const date = new Date(year, monthIndex, dayNum)
                  const key = dayKey(date)
                  const dayEntries = entriesByDay.get(key) ?? []
                  const primary = dayEntries.find((e) => e.mood) ?? dayEntries[0]
                  const mood = getMood(primary?.mood)
                  const selected = primary ? selectedId === primary.id : false

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      className={[
                        'year-board-cell',
                        mood ? 'has-mood' : dayEntries.length ? 'has-entry' : '',
                        isToday(date) ? 'today' : '',
                        selected ? 'selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={mood ? { background: mood.color } : undefined}
                      onClick={() => {
                        setMonth(startOfMonth(date))
                        onSelectDate(date, primary?.id)
                      }}
                      aria-label={
                        mood
                          ? `${format(date, 'MMMM d')}, ${mood.label}`
                          : format(date, 'MMMM d')
                      }
                      title={
                        mood
                          ? `${format(date, 'MMM d')} · ${mood.label}`
                          : format(date, 'MMM d')
                      }
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      <div className="calendar-legend">
        {MOODS.map((mood) => (
          <span key={mood.id} className="legend-item">
            {mode === 'emoji' ? (
              <span className="legend-emoji">{mood.emoji}</span>
            ) : (
              <span className="legend-swatch" style={{ background: mood.color }} />
            )}
            {mood.label}
          </span>
        ))}
      </div>
    </section>
  )
}

