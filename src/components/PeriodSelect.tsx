import { useEffect, useId, useRef, useState } from 'react'
import type { ExpenseFilter } from '../lib/expensePeriods'

interface PeriodOption {
  id: ExpenseFilter
  label: string
}

interface PeriodSelectProps {
  value: ExpenseFilter
  options: PeriodOption[]
  onChange: (next: ExpenseFilter) => void
  label?: string
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label = 'Period',
}: PeriodSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.id === value)?.label ?? value

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="period-select" ref={rootRef}>
      <button
        type="button"
        className={`period-select-trigger ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${selected}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="period-select-value">{selected}</span>
        <svg
          className="period-select-chevron"
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

      {open && (
        <ul className="period-select-menu" id={listId} role="listbox" aria-label={label}>
          {options.map((option) => {
            const active = option.id === value
            return (
              <li key={option.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`period-select-option ${active ? 'active' : ''}`}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {active && (
                    <svg
                      className="period-select-check"
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
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
