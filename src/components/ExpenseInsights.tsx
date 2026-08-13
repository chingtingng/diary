import { useMemo, useState } from 'react'
import {
  INSIGHT_PERIODS,
  filterExpenses,
  formatPeriodLabel,
  isCurrentPeriod,
  periodEyebrow,
  shiftPeriod,
  summarizeCategories,
  type ExpenseFilter,
  type ExpensePeriod,
} from '../lib/expensePeriods'
import type { Expense } from '../types/expense'
import { CategoryPieChart } from './CategoryPieChart'
import { PeriodSelect } from './PeriodSelect'

interface ExpenseInsightsProps {
  expenses: Expense[]
  onClose: () => void
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ExpenseInsights({ expenses, onClose }: ExpenseInsightsProps) {
  const [period, setPeriod] = useState<ExpenseFilter>('month')
  const [anchor, setAnchor] = useState(() => new Date())

  const scoped = useMemo(
    () => filterExpenses(expenses, period, anchor),
    [expenses, period, anchor]
  )
  const total = useMemo(
    () => scoped.reduce((sum, expense) => sum + expense.amount, 0),
    [scoped]
  )
  const slices = useMemo(() => summarizeCategories(scoped), [scoped])
  const current = period === 'all' ? true : isCurrentPeriod(anchor, period)

  const handlePeriodChange = (next: ExpenseFilter) => {
    setPeriod(next)
    setAnchor(new Date())
  }

  return (
    <div className="expenses-view insights-view">
      <div className="insights-header">
        <button type="button" className="insights-close" onClick={onClose} aria-label="Close insights">
          ✕
        </button>
        <h2 className="insights-title">Insights</h2>
        <span className="insights-header-spacer" aria-hidden />
      </div>

      <div className="insights-toolbar">
        <div className="insights-period-copy">
          <p className="eyebrow">{periodEyebrow(period, current)}</p>
          <p className="insights-period-title">
            {period === 'all'
              ? 'All spending'
              : formatPeriodLabel(anchor, period as ExpensePeriod)}
          </p>
        </div>
        <div className="expenses-toolbar-controls">
          <PeriodSelect
            value={period}
            options={INSIGHT_PERIODS}
            onChange={handlePeriodChange}
          />
        </div>
        {period !== 'all' && (
          <div className="calendar-nav expenses-period-nav">
            <button
              type="button"
              onClick={() => setAnchor((value) => shiftPeriod(value, period as ExpensePeriod, -1))}
              aria-label={`Previous ${period}`}
            >
              ←
            </button>
            <button
              type="button"
              className={`today-btn${current ? ' current' : ''}`}
              onClick={() => setAnchor(new Date())}
              disabled={current}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAnchor((value) => shiftPeriod(value, period as ExpensePeriod, 1))}
              aria-label={`Next ${period}`}
            >
              →
            </button>
          </div>
        )}
      </div>

      {slices.length === 0 ? (
        <p className="empty-list">No spending in this period yet.</p>
      ) : (
        <>
          <section className="insights-chart-panel" aria-labelledby="insights-chart-heading">
            <h3 id="insights-chart-heading" className="visually-hidden">
              Category split
            </h3>
            <CategoryPieChart
              slices={slices}
              totalLabel={formatMoney(total)}
              showLegend={false}
            />
            <ul className="expense-pie-legend insights-inline-legend">
              {slices.map((slice) => (
                <li key={slice.id}>
                  <span className="expense-pie-swatch" style={{ background: slice.color }} aria-hidden />
                  <span className="expense-pie-legend-label">{slice.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="insights-breakdown" aria-labelledby="insights-breakdown-heading">
            <h3 id="insights-breakdown-heading" className="eyebrow">
              Breakdown
            </h3>
            <ul>
              {slices.map((slice) => (
                <li key={slice.id}>
                  <span className="expense-pie-swatch" style={{ background: slice.color }} aria-hidden />
                  <span className="insights-breakdown-label">{slice.label}</span>
                  <span className="insights-breakdown-meta">{slice.percent.toFixed(0)}%</span>
                  <span className="insights-breakdown-amount">{formatMoney(slice.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
