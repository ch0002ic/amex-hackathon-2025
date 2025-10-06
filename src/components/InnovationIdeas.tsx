import type { InnovationIdea } from '../types'
import './InnovationIdeas.css'

interface InnovationIdeasProps {
  ideas: InnovationIdea[]
}

export function InnovationIdeas({ ideas }: InnovationIdeasProps) {
  return (
    <section className="innovation-ideas" id="innovation">
      <header className="innovation-ideas__header">
        <div>
          <h2>Innovation Portfolio Radar</h2>
          <p>
            Curated AMEX initiatives scored across novelty, feasibility, applicability, and overall
            impact to guide the next wave of merchant and colleague experiences.
          </p>
        </div>
        <div className="innovation-ideas__legend">
          <span>Overall</span>
          <span>Novelty</span>
          <span>Feasibility</span>
          <span>AMEX Fit</span>
        </div>
      </header>
      <div className="innovation-ideas__grid">
        {ideas.map((idea) => (
          <article key={idea.id} className="innovation-ideas__card">
            <header>
              <div>
                <h3>{idea.name}</h3>
                <p className="innovation-ideas__category">{idea.category}</p>
              </div>
              <dl className="innovation-ideas__scores">
                <div>
                  <dt>Overall</dt>
                  <dd>{idea.overallScore.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Novelty</dt>
                  <dd>{idea.noveltyScore}</dd>
                </div>
                <div>
                  <dt>Feasibility</dt>
                  <dd>{idea.feasibilityScore}</dd>
                </div>
                <div>
                  <dt>Applicability</dt>
                  <dd>{idea.amexApplicability}</dd>
                </div>
              </dl>
            </header>
            <p className="innovation-ideas__description">{idea.description}</p>
            <section className="innovation-ideas__lists">
              <div>
                <h4>Innovation Factors</h4>
                <ul>
                  {idea.innovationFactors.map((factor) => (
                    <li key={factor}>{factor}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Limitations Addressed</h4>
                <ul>
                  {idea.limitationsAddressed.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </div>
            </section>
            <footer>
              <span className={`complexity complexity--${idea.implementationComplexity.toLowerCase().replace(/\s+/g, '-')}`}>
                {idea.implementationComplexity} Complexity
              </span>
              <span className="time">{idea.timeToMarket} to market</span>
              <span className="technical-depth">Technical Depth {idea.technicalDepth}/10</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
