import type { GrowthOpportunity } from '../types'
import './GrowthOpportunities.css'

interface GrowthOpportunitiesProps {
  opportunities: GrowthOpportunity[]
}

export function GrowthOpportunities({ opportunities }: GrowthOpportunitiesProps) {
  return (
    <section className="growth-grid" id="intelligence">
      {opportunities.map((opportunity) => (
        <article key={opportunity.id}>
          <header>
            <span className={`badge badge--${opportunity.impact.toLowerCase()}`}>
              {opportunity.impact} Impact
            </span>
            <small>{opportunity.timeframe}</small>
          </header>
          <h3>{opportunity.name}</h3>
          <p>{opportunity.description}</p>
        </article>
      ))}
    </section>
  )
}
