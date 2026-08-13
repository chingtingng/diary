import type { CategorySlice } from '../lib/expensePeriods'

interface CategoryPieChartProps {
  slices: CategorySlice[]
  totalLabel: string
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

function describeSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle
  if (sweep <= 0) return ''

  // Full circle needs two arcs — SVG can't draw a full circle as one arc.
  if (sweep >= 359.999) {
    const top = polarToCartesian(cx, cy, outer, 0)
    const bottom = polarToCartesian(cx, cy, outer, 180)
    const topInner = polarToCartesian(cx, cy, inner, 0)
    const bottomInner = polarToCartesian(cx, cy, inner, 180)
    return [
      `M ${top.x} ${top.y}`,
      `A ${outer} ${outer} 0 1 1 ${bottom.x} ${bottom.y}`,
      `A ${outer} ${outer} 0 1 1 ${top.x} ${top.y}`,
      `L ${topInner.x} ${topInner.y}`,
      `A ${inner} ${inner} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${inner} ${inner} 0 1 0 ${topInner.x} ${topInner.y}`,
      'Z',
    ].join(' ')
  }

  const startOuter = polarToCartesian(cx, cy, outer, startAngle)
  const endOuter = polarToCartesian(cx, cy, outer, endAngle)
  const startInner = polarToCartesian(cx, cy, inner, endAngle)
  const endInner = polarToCartesian(cx, cy, inner, startAngle)
  const largeArc = sweep > 180 ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

export function CategoryPieChart({ slices, totalLabel }: CategoryPieChartProps) {
  if (slices.length === 0) return null

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const outer = 96
  const inner = 58

  let angle = 0
  const paths = slices.map((slice) => {
    const sweep = (slice.percent / 100) * 360
    const start = angle
    const end = angle + sweep
    angle = end
    return {
      ...slice,
      d: describeSlice(cx, cy, outer, inner, start, end),
    }
  })

  return (
    <div className="expense-pie" aria-label="Spending by category">
      <div className="expense-pie-chart">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden>
          {paths.map((slice) => (
            <path key={slice.id} d={slice.d} fill={slice.color} />
          ))}
        </svg>
        <div className="expense-pie-center">
          <span className="expense-pie-center-label">Total</span>
          <span className="expense-pie-center-value">{totalLabel}</span>
        </div>
      </div>

      <ul className="expense-pie-legend">
        {slices.map((slice) => (
          <li key={slice.id}>
            <span className="expense-pie-swatch" style={{ background: slice.color }} aria-hidden />
            <span className="expense-pie-legend-label">{slice.label}</span>
            <span className="expense-pie-legend-meta">
              {slice.percent.toFixed(0)}% ·{' '}
              {slice.total.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
