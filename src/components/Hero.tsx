import './Hero.css'

export function Hero() {
  return (
    <section className="hero" id="vision">
      <div className="hero__pillars">
        <span>Productivity</span>
        <span>Protection</span>
        <span>Growth</span>
      </div>
      <h1>
        AI-Powered Ecosystem Intelligence Platform
        <span>Unlock AMEX&apos;s closed-loop advantage with explainable GenAI.</span>
      </h1>
      <p>
        Transform real-time merchant, card member, and risk signals into actions that unlock
        new revenue, defend AMEX&apos;s trust moat, and supercharge colleague productivity.
      </p>
      <div className="hero__stats">
        <div>
          <h3>$100M+</h3>
          <p>New ARR Potential</p>
        </div>
        <div>
          <h3>97%</h3>
          <p>Behavioral Fraud Catch Rate</p>
        </div>
        <div>
          <h3>5.6k</h3>
          <p>Analyst Hours Saved Monthly</p>
        </div>
      </div>
    </section>
  )
}
