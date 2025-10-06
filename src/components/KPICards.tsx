import type { PlatformKPI } from '../types'
import './KPICards.css'

interface KPICardsProps {
  data: PlatformKPI[]
}

const trendCopy: Record<PlatformKPI['trend'], string> = {
  up: '▲',
  down: '▼',
  steady: '■',
}

export function KPICards({ data }: KPICardsProps) {
  return (
    <div className="kpi-grid">
      {data.map((kpi) => (
        <article key={kpi.id} className="kpi-card">
          <header>
            <span>{kpi.label}</span>
            <strong>{trendCopy[kpi.trend]}</strong>
          </header>
          <h3>{kpi.value}</h3>
          <p>
            Δ {kpi.delta}% vs baseline · Target: {kpi.target}
          </p>
        </article>
      ))}
    </div>
  )
}
