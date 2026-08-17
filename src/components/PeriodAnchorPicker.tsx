import { useMemo, useState } from 'react'
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from 'date-fns'
import type { ExpensePeriod } from '../lib/expensePeriods'

interface PeriodAnchorPickerProps {
  period: ExpensePeriod
  value: Date
  onChange: (next: Date) => void
  onClose: () => void
}

const WEEK_OPTIONS = { weekStartsOn: 0 as const }
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function PeriodAnchorPicker({
  period,
  value,
  onChange,
  onClose,
}: PeriodAnchorPickerProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(value))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), WEEK_OPTIONS)
    const end = endOfWeek(endOfMonth(cursor), WEEK_OPTIONS)
    return eachDayOfInterval({ start, end })
  }, [cursor])

  if (period === 'year') {
    const year = value.getFullYear()
    const years = Array.from({ length: 11 }, (_, i) => year - 5 + i)
    return (
      <div className="period-picker" role="dialog" aria-label="Choose year">
        <div className="period-picker-header">
          <p className="period-picker-title">Choose year</p>
          <button type="button" className="period-picker-close" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="period-picker-year-grid">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`period-picker-chip${y === year ? ' selected' : ''}`}
              data-haptic="select"
              onClick={() => {
                onChange(new Date(y, value.getMonth(), 1))
                onClose()
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (period === 'month') {
    const year = cursor.getFullYear()
    return (
      <div className="period-picker" role="dialog" aria-label="Choose month">
        <div className="period-picker-header">
          <button
            type="button"
            className="period-picker-nav"
            data-haptic="select"
            onClick={() => setCursor((d) => subYears(d, 1))}
            aria-label="Previous year"
          >
            ‹
          </button>
          <p className="period-picker-title">{year}</p>
          <button
            type="button"
            className="period-picker-nav"
            data-haptic="select"
            onClick={() => setCursor((d) => addYears(d, 1))}
            aria-label="Next year"
          >
            ›
          </button>
          <button type="button" className="period-picker-close" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="period-picker-month-grid">
          {Array.from({ length: 12 }, (_, index) => {
            const month = new Date(year, index, 1)
            const selected = isSameMonth(month, value) && isSameYear(month, value)
            return (
              <button
                key={index}
                type="button"
                className={`period-picker-chip${selected ? ' selected' : ''}`}
                data-haptic="select"
                onClick={() => {
                  onChange(month)
                  onClose()
                }}
              >
                {format(month, 'MMM')}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="period-picker" role="dialog" aria-label={period === 'week' ? 'Choose week' : 'Choose day'}>
      <div className="period-picker-header">
        <button
          type="button"
          className="period-picker-nav"
          data-haptic="select"
          onClick={() => setCursor((d) => subMonths(d, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="period-picker-title">{format(cursor, 'MMMM yyyy')}</p>
        <button
          type="button"
          className="period-picker-nav"
          data-haptic="select"
          onClick={() => setCursor((d) => addMonths(d, 1))}
          aria-label="Next month"
        >
          ›
        </button>
        <button type="button" className="period-picker-close" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="period-picker-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="period-picker-grid">
        {days.map((day) => {
          const outside = !isSameMonth(day, cursor)
          const selected =
            period === 'week'
              ? isSameDay(day, startOfWeek(value, WEEK_OPTIONS)) ||
                (day >= startOfWeek(value, WEEK_OPTIONS) &&
                  day <= endOfWeek(value, WEEK_OPTIONS))
              : isSameDay(day, value)
          const inSelectedWeek =
            period === 'week' &&
            day >= startOfWeek(value, WEEK_OPTIONS) &&
            day <= endOfWeek(value, WEEK_OPTIONS)
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`period-picker-day${outside ? ' outside' : ''}${selected || inSelectedWeek ? ' selected' : ''}`}
              data-haptic="select"
              onClick={() => {
                onChange(day)
                onClose()
              }}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
      {period === 'week' && (
        <p className="period-picker-hint">Tap any day to jump to that week</p>
      )}
    </div>
  )
}
