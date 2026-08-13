import type { SpendingBar } from '../lib/expensePeriods'

interface SpendingBarChartProps {
  bars: SpendingBar[]
  density?: 'week' | 'month' | 'year'
}

export function SpendingBarChart({ bars, density = 'week' }: SpendingBarChartProps) {
  const max = Math.max(...bars.map((bar) => bar.total), 0)
  const showEveryLabel = density !== 'month'
  const labelStep = density === 'month' ? Math.ceil(bars.length / 6) : 1

  return (
    <div className={`spending-chart spending-chart-${density}`} role="img" aria-label="Spending chart">
      <div className="spending-chart-bars">
        {bars.map((bar, index) => {
          // Empty days still get a short stub so the week/month silhouette matches the mockup.
          const ratio = max > 0 ? bar.total / max : 0
          const height = bar.total > 0 ? Math.max(ratio * 100, 14) : density === 'month' ? 6 : 10
          const showLabel =
            showEveryLabel || index === 0 || index === bars.length - 1 || index % labelStep === 0
          return (
            <div
              key={bar.key}
              className={`spending-chart-col${bar.active ? ' active' : ''}${bar.total > 0 ? ' has-value' : ''}`}
            >
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
