import { useMemo } from 'react'
import type { EcosystemTrend } from '../types'
import './TrendChart.css'

interface TrendChartProps {
  trends: EcosystemTrend[]
}

export function TrendChart({ trends }: TrendChartProps) {
  const normalized = useMemo(
    () =>
      trends.map((trend) => {
        const maxValue = Math.max(...trend.values)
        return {
          ...trend,
          percentages: trend.values.map((value) => (value / maxValue) * 100),
        }
      }),
    [trends],
  )

  return (
    <div className="trend-panel">
      <header>
        <h3>Ecosystem Runway Explorer</h3>
        <p>Tracking monthly momentum vs FY24 baseline</p>
      </header>
      <div className="trend-grid">
        {normalized.map((trend) => (
          <article key={trend.id}>
            <div className="trend-badge">Baseline {trend.baseline}%</div>
            <h4>{trend.label}</h4>
            <div className="bars">
              {trend.percentages.map((percentage, index) => (
                <span
                  key={index}
                  className="bar"
                  style={{
                    height: `${percentage}%`,
                    animationDelay: `${index * 0.08}s`,
                  }}
                  aria-label={`month ${index + 1}: ${trend.values[index]} index points`}
                />
              ))}
            </div>
            <footer>
              <strong>{trend.values.at(-1)}</strong>
              <span>vs {trend.values[0]} six months prior</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  )
}
