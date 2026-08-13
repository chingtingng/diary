import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { atLocalNoon } from '../lib/dates'
import { haptic } from '../lib/haptics'

interface DateFieldProps {
  value: Date
  onChange: (next: Date) => void
  label?: string
}

const WEEK_OPTIONS = { weekStartsOn: 1 as const }
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DateField({ value, onChange, label = 'Date' }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => startOfMonth(value))
  const rootRef = useRef<HTMLDivElement>(null)
  const ignoreTriggerClick = useRef(false)
  const pointerStartY = useRef(0)
  const pointerMoved = useRef(false)

  useEffect(() => {
    if (open) setCursor(startOfMonth(value))
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), WEEK_OPTIONS)
    const end = endOfWeek(endOfMonth(cursor), WEEK_OPTIONS)
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const pick = (day: Date) => {
    ignoreTriggerClick.current = true
    onChange(atLocalNoon(day))
    haptic('select')
    setOpen(false)
    window.setTimeout(() => {
      ignoreTriggerClick.current = false
    }, 400)
  }

  return (
    <div className="date-field" ref={rootRef}>
      <span className="date-field-label">{label}</span>
      <button
        type="button"
        className={`date-field-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${label}: ${format(value, 'EEEE, MMMM d')}`}
        onClick={() => {
          if (ignoreTriggerClick.current) return
          setOpen((current) => !current)
        }}
      >
        <span>{format(value, 'EEE, MMM d')}</span>
        <svg
          className="date-field-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <rect
            x="4"
            y="5"
            width="16"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M8 3v4M16 3v4M4 10h16"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="date-field-calendar"
          role="dialog"
          aria-label="Choose date"
          onPointerDown={(event) => {
            event.stopPropagation()
            pointerStartY.current = event.clientY
            pointerMoved.current = false
          }}
          onPointerMove={(event) => {
            if (Math.abs(event.clientY - pointerStartY.current) > 10) pointerMoved.current = true
          }}
        >
          <div className="date-field-cal-nav">
            <button
              type="button"
              onClick={() => setCursor((month) => subMonths(month, 1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p>{format(cursor, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setCursor((month) => addMonths(month, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="date-field-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="date-field-grid">
            {days.map((day) => {
              const outside = !isSameMonth(day, cursor)
              const selected = isSameDay(day, value)
              const today = isSameDay(day, new Date())
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={[
                    'date-field-day',
                    outside ? 'outside' : '',
                    selected ? 'selected' : '',
                    today ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPointerUp={(event) => {
                    if (event.pointerType === 'mouse' && event.button !== 0) return
                    if (pointerMoved.current) return
                    event.preventDefault()
                    event.stopPropagation()
                    pick(day)
                  }}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
