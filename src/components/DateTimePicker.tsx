import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

interface DateTimePickerProps {
  value: Date
  onChange: (next: Date) => void
  label?: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const WEEK_OPTIONS = { weekStartsOn: 1 as const }

function clampHour12(hour24: number): { hour12: number; meridiem: 'AM' | 'PM' } {
  const meridiem = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return { hour12, meridiem }
}

function toHour24(hour12: number, meridiem: 'AM' | 'PM'): number {
  if (meridiem === 'AM') return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 1
  return { id: hour, label: String(hour) }
})

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  label: String(i).padStart(2, '0'),
}))

const PERIOD_OPTIONS = [
  { id: 'AM' as const, label: 'AM' },
  { id: 'PM' as const, label: 'PM' },
]

interface TimeColumnOption<T extends string | number> {
  id: T
  label: string
}

function TimeColumn<T extends string | number>({
  label,
  options,
  value,
  onChange,
  fill = false,
}: {
  label: string
  options: TimeColumnOption<T>[]
  value: T
  onChange: (next: T) => void
  fill?: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  const labelId = useId()

  useLayoutEffect(() => {
    const list = listRef.current
    const selected = selectedRef.current
    if (!list || !selected || fill) return
    // getBoundingClientRect accounts for list padding; offsetTop often
    // resolves against a farther offsetParent and leaves the value off-center.
    const listRect = list.getBoundingClientRect()
    const selectedRect = selected.getBoundingClientRect()
    const delta =
      selectedRect.top +
      selectedRect.height / 2 -
      (listRect.top + listRect.height / 2)
    list.scrollTop += delta
  }, [value, fill])

  const move = (delta: number) => {
    const index = options.findIndex((option) => option.id === value)
    const next = options[Math.min(Math.max(index + delta, 0), options.length - 1)]
    if (next && next.id !== value) onChange(next.id)
  }

  return (
    <div className="datetime-time-column">
      <span className="datetime-time-column-label" id={labelId}>
        {label}
      </span>
      <div
        ref={listRef}
        className={`datetime-time-list${fill ? ' fill' : ''}`}
        role="listbox"
        aria-labelledby={labelId}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            move(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            move(-1)
          }
        }}
      >
        {options.map((option) => {
          const active = option.id === value
          return (
            <button
              key={String(option.id)}
              type="button"
              role="option"
              aria-selected={active}
              ref={active ? selectedRef : undefined}
              className={`datetime-time-option${active ? ' active' : ''}`}
              data-haptic="select"
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateTimePicker({ value, onChange, label = 'When' }: DateTimePickerProps) {
  const [openPanel, setOpenPanel] = useState<'date' | 'time' | null>(null)
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(value))
  const rootRef = useRef<HTMLDivElement>(null)
  const labelId = useId()

  const { hour12, meridiem } = clampHour12(value.getHours())
  const minute = value.getMinutes()

  useEffect(() => {
    if (openPanel === 'date') setMonthCursor(startOfMonth(value))
  }, [openPanel, value])

  useEffect(() => {
    if (!openPanel) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenPanel(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openPanel])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), WEEK_OPTIONS)
    const end = endOfWeek(endOfMonth(monthCursor), WEEK_OPTIONS)
    return eachDayOfInterval({ start, end })
  }, [monthCursor])

  const setDatePart = (day: Date) => {
    const next = new Date(value)
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate())
    onChange(next)
    setOpenPanel(null)
  }

  const setTimePart = (nextHour12: number, nextMinute: number, nextMeridiem: 'AM' | 'PM') => {
    const next = new Date(value)
    next.setHours(toHour24(nextHour12, nextMeridiem), nextMinute, 0, 0)
    onChange(next)
  }

  return (
    <div className="datetime-picker" ref={rootRef}>
      <p className="datetime-label" id={labelId}>
        {label}
      </p>
      <div className="datetime-fields" role="group" aria-labelledby={labelId}>
        <button
          type="button"
          className={`datetime-chip ${openPanel === 'date' ? 'active' : ''}`}
          data-haptic="select"
          aria-expanded={openPanel === 'date'}
          onClick={() => setOpenPanel((panel) => (panel === 'date' ? null : 'date'))}
        >
          <span className="datetime-chip-kicker">Date</span>
          <span className="datetime-chip-value">{format(value, 'EEE, MMM d')}</span>
        </button>
        <button
          type="button"
          className={`datetime-chip ${openPanel === 'time' ? 'active' : ''}`}
          data-haptic="select"
          aria-expanded={openPanel === 'time'}
          onClick={() => setOpenPanel((panel) => (panel === 'time' ? null : 'time'))}
        >
          <span className="datetime-chip-kicker">Time</span>
          <span className="datetime-chip-value">{format(value, 'h:mm a')}</span>
        </button>
      </div>

      {openPanel === 'date' && (
        <div className="datetime-popover" role="dialog" aria-label="Choose date">
          <div className="datetime-cal-nav">
            <button
              type="button"
              onClick={() => setMonthCursor((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              ←
            </button>
            <p>{format(monthCursor, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setMonthCursor((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <div className="datetime-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="datetime-grid">
            {days.map((day) => {
              const outside = !isSameMonth(day, monthCursor)
              const selected = isSameDay(day, value)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  data-haptic="select"
                  className={[
                    'datetime-day',
                    outside ? 'outside' : '',
                    selected ? 'selected' : '',
                    isSameDay(day, new Date()) ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setDatePart(day)}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {openPanel === 'time' && (
        <div className="datetime-popover datetime-time-popover" role="dialog" aria-label="Choose time">
          <div className="datetime-time-columns">
            <TimeColumn
              label="Hour"
              options={HOUR_OPTIONS}
              value={hour12}
              onChange={(next) => setTimePart(next, minute, meridiem)}
            />
            <TimeColumn
              label="Minute"
              options={MINUTE_OPTIONS}
              value={minute}
              onChange={(next) => setTimePart(hour12, next, meridiem)}
            />
            <TimeColumn
              label="Period"
              options={PERIOD_OPTIONS}
              value={meridiem}
              onChange={(next) => setTimePart(hour12, minute, next)}
              fill
            />
          </div>
          <div className="datetime-time-presets" role="group" aria-label="Quick times">
            {[
              { label: 'Morning', h: 9, m: 0, mer: 'AM' as const },
              { label: 'Noon', h: 12, m: 0, mer: 'PM' as const },
              { label: 'Evening', h: 6, m: 0, mer: 'PM' as const },
              { label: 'Now', h: clampHour12(new Date().getHours()).hour12, m: new Date().getMinutes(), mer: clampHour12(new Date().getHours()).meridiem },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (preset.label === 'Now') {
                    const now = new Date()
                    const parts = clampHour12(now.getHours())
                    setTimePart(parts.hour12, now.getMinutes(), parts.meridiem)
                  } else {
                    setTimePart(preset.h, preset.m, preset.mer)
                  }
                  setOpenPanel(null)
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
