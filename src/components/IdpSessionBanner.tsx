import { useAuth } from '../auth/AuthContext'
import './IdpSessionBanner.css'

export function IdpSessionBanner() {
  const { idToken, setIdToken } = useAuth()

  const handleConnect = () => {
    const token = window.prompt('Paste the signed IdP access token issued for this session')
    if (token && token.trim().length > 0) {
      setIdToken(token.trim())
    }
  }

  const handleDisconnect = () => {
    setIdToken(null)
  }

  const truncated = idToken ? `${idToken.slice(0, 12)}…${idToken.slice(-6)}` : null

  return (
    <section className="idp-banner" aria-live="polite">
      {idToken ? (
        <>
          <div className="idp-banner__status">
            <span className="idp-banner__dot idp-banner__dot--connected" aria-hidden="true" />
            <span>IdP session active</span>
            <span className="idp-banner__token" title={idToken}>
              {truncated}
            </span>
          </div>
          <div className="idp-banner__actions">
            <button type="button" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="idp-banner__status">
            <span className="idp-banner__dot" aria-hidden="true" />
            <span>No IdP token detected</span>
          </div>
          <div className="idp-banner__actions">
            <button type="button" onClick={handleConnect}>
              Connect IdP Session
            </button>
          </div>
        </>
      )}
    </section>
  )
}
