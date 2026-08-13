import type { SpendingBar } from '../lib/expensePeriods'

interface SpendingBarChartProps {
  bars: SpendingBar[]
  density?: 'week' | 'month' | 'year'
}

export function SpendingBarChart({ bars, density = 'week' }: SpendingBarChartProps) {
  const max = Math.max(...bars.map((bar) => bar.total), 0)
  const showEveryLabel = density !== 'month'
  const labelStep = density === 'month' ? Math.ceil(bars.length / 7) : 1

  return (
    <div className={`spending-chart spending-chart-${density}`} role="img" aria-label="Spending chart">
      <div className="spending-chart-bars">
        {bars.map((bar, index) => {
          const height = max > 0 ? Math.max((bar.total / max) * 100, bar.total > 0 ? 8 : 0) : 0
          const showLabel =
            showEveryLabel || index === 0 || index === bars.length - 1 || index % labelStep === 0
          return (
            <div key={bar.key} className={`spending-chart-col${bar.active ? ' active' : ''}`}>
              <div className="spending-chart-track">
                <div
                  className="spending-chart-fill"
                  style={{ height: `${height}%` }}
                  title={`$${bar.total.toFixed(2)}`}
                />
              </div>
              <span className={`spending-chart-label${showLabel ? '' : ' muted'}`}>
                {showLabel ? bar.label : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
