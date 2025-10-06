import { useAuth } from '../auth/AuthContext'
import './TopNav.css'

interface TopNavProps {
  onNavigate: (target: string) => void
}

const navItems = [
  { id: 'vision', label: 'Vision' },
  { id: 'partner-signals', label: 'Partner Signals' },
  { id: 'intelligence', label: 'Merchant Intelligence' },
  { id: 'protection', label: 'Protection Alerts' },
  { id: 'productivity', label: 'Colleague Copilot' },
  { id: 'innovation', label: 'Innovation Portfolio' },
  { id: 'roadmap', label: 'Roadmap' },
]

export function TopNav({ onNavigate }: TopNavProps) {
  const { profile, switchRole } = useAuth()

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <div className="brand">
          <span>AMEX GenAI Ecosystem Intelligence</span>
        </div>
        <nav>
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onNavigate(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="top-nav__persona" role="group" aria-label="Switch persona">
          <button
            type="button"
            className={profile.role === 'merchant' ? 'active' : ''}
            onClick={() => switchRole('merchant')}
          >
            Merchant
          </button>
          <button
            type="button"
            className={profile.role === 'colleague' ? 'active' : ''}
            onClick={() => switchRole('colleague')}
          >
            Colleague
          </button>
        </div>
      </div>
    </header>
  )
}
