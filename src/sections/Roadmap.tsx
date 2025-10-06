import './Roadmap.css'

const phases = [
  {
    id: 'phase1',
    title: 'Phase 1 · Foundation (0-6 months)',
    bullets: [
      'Launch merchant intelligence MVP with 10-15 partners.',
      'Deploy synthetic data sandbox and secure model governance.',
      'Stand up analyst copilot with explainability guardrails.',
    ],
  },
  {
    id: 'phase2',
    title: 'Phase 2 · Differentiation (6-12 months)',
    bullets: [
      'Expand to 100+ merchants with self-serve portal and APIs.',
      'Integrate federated learning for cross-merchant fraud intel.',
      'Automate partnership recommendations with ROI simulation.',
    ],
  },
  {
    id: 'phase3',
    title: 'Phase 3 · Industry Leadership (12-24 months)',
    bullets: [
      'Commercialize ecosystem insights ($50M+ ARR).',
      'Operationalize behavioral biometrics and invisible authentication.',
      'Launch MAS-aligned governance toolkit and compliance dashboards.',
    ],
  },
]

export function Roadmap() {
  return (
    <section className="roadmap" id="roadmap">
      <header>
        <h2>Implementation Blueprint</h2>
        <p>Sequencing impact across Productivity, Protection, and Growth</p>
      </header>
      <div className="roadmap__grid">
        {phases.map((phase) => (
          <article key={phase.id}>
            <h3>{phase.title}</h3>
            <ul>
              {phase.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
