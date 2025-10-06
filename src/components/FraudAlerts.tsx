import type { FraudAlert } from '../types'
import './FraudAlerts.css'

interface FraudAlertsProps {
  alerts: FraudAlert[]
}

export function FraudAlerts({ alerts }: FraudAlertsProps) {
  return (
    <section className="fraud-panel" id="protection">
      <header>
        <h3>Behavioral Threat Radar</h3>
        <p>Continuous monitoring across AMEX closed-loop network</p>
      </header>
      <div className="fraud-grid">
        {alerts.map((alert) => (
          <article key={alert.id}>
            <div className="confidence">Confidence {Math.round(alert.confidence * 100)}%</div>
            <h4>{alert.segment}</h4>
            <p className="anomaly">{alert.anomaly}</p>
            <p className="action">{alert.recommendedAction}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
