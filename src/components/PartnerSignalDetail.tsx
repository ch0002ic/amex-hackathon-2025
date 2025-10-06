import { useEffect, useMemo, useState } from 'react'
import type { PartnerSignal } from '../types'
import './PartnerSignalDetail.css'

type DetailStatus = 'idle' | 'updating' | 'error'

interface PartnerSignalDetailProps {
  signal: PartnerSignal | null
  isOpen: boolean
  onClose: () => void
  isLoading: boolean
  error: string | null
  onStatusChange: (id: string, status: PartnerSignal['status']) => Promise<PartnerSignal | null>
  canModerate: boolean
}

export function PartnerSignalDetail({
  signal,
  isOpen,
  onClose,
  isLoading,
  error,
  onStatusChange,
  canModerate,
}: PartnerSignalDetailProps) {
  const [statusState, setStatusState] = useState<DetailStatus>('idle')
  const [statusError, setStatusError] = useState<string | null>(null)

  const statusOptions = useMemo<PartnerSignal['status'][]>(() => ['pending', 'approved', 'archived'], [])

  useEffect(() => {
    if (isOpen) {
      setStatusState('idle')
      setStatusError(null)
    }
  }, [isOpen, signal?.id])

  if (!isOpen || !signal) {
    return null
  }

  const handleStatusUpdate = async (nextStatus: PartnerSignal['status']) => {
    if (signal.status === nextStatus) {
      return
    }

    if (!canModerate) {
      setStatusError('Switch to a colleague persona to update status.')
      setStatusState('error')
      return
    }

    setStatusState('updating')
    setStatusError(null)

    try {
      const updated = await onStatusChange(signal.id, nextStatus)
      if (!updated) {
        throw new Error('Partner signal not found')
      }
      setStatusState('idle')
    } catch (updateError) {
      console.error(updateError)
      setStatusError('Unable to update status. Please try again.')
      setStatusState('error')
    }
  }

  const metadataEntries = signal.metadata ? Object.entries(signal.metadata) : []
  const reviewerRoleLabel = signal.assignedReviewerRole
    ? `${signal.assignedReviewerRole.charAt(0).toUpperCase()}${signal.assignedReviewerRole.slice(1)}`
    : null
  const assignedReviewerLabel = signal.assignedReviewerName
    ? reviewerRoleLabel
      ? `${signal.assignedReviewerName} (${reviewerRoleLabel})`
      : signal.assignedReviewerName
    : 'Unassigned'
  const assignedTimestamp = signal.assignedReviewerName && signal.assignedAt
    ? new Date(signal.assignedAt).toLocaleString()
    : null

  return (
    <div className="partner-signal-detail" role="dialog" aria-modal="true" aria-labelledby="partner-detail-title">
      <button type="button" className="partner-signal-detail__backdrop" aria-label="Close" onClick={onClose} />
      <div className="partner-signal-detail__panel">
        <header className="partner-signal-detail__header">
          <div>
            <span className="partner-signal-detail__status" data-status={signal.status}>
              {signal.status}
            </span>
            <h3 id="partner-detail-title">{signal.merchantName}</h3>
            <p>
              Submitted by <strong>{signal.partnerName}</strong> · {signal.partnerId}
            </p>
          </div>
          <button type="button" className="partner-signal-detail__close" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="partner-signal-detail__body">
          {isLoading ? (
            <div className="partner-signal-detail__loading">Loading full insight…</div>
          ) : (
            <>
              {error && <div className="partner-signal-detail__error">{error}</div>}
              <div className="partner-signal-detail__row">
                <h4>Insight Summary</h4>
                <p>{signal.description}</p>
              </div>
              <div className="partner-signal-detail__grid">
                <div>
                  <span>Merchant ID</span>
                  <strong>{signal.merchantId}</strong>
                </div>
                <div>
                  <span>Partner ID</span>
                  <strong>{signal.partnerId}</strong>
                </div>
                <div>
                  <span>Confidence</span>
                  <strong>{Math.round(signal.confidence * 100)}%</strong>
                </div>
                <div>
                  <span>Submitted</span>
                  <strong>{new Date(signal.submittedAt).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Signal Type</span>
                  <strong>{signal.signalType}</strong>
                </div>
              </div>
              <div className="partner-signal-detail__row partner-signal-detail__assignment">
                <h4>Reviewer assignment</h4>
                {signal.assignedReviewerName ? (
                  <p>
                    Assigned to <strong>{assignedReviewerLabel}</strong>
                    {assignedTimestamp ? ` on ${assignedTimestamp}` : ''}
                  </p>
                ) : (
                  <p>Not yet assigned to a reviewer.</p>
                )}
              </div>
              {metadataEntries.length > 0 && (
                <div className="partner-signal-detail__row">
                  <h4>Metadata</h4>
                  <ul>
                    {metadataEntries.map(([key, value]) => (
                      <li key={key}>
                        <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="partner-signal-detail__footer">
          <div className="partner-signal-detail__status-actions" role="group" aria-label="Update status">
            {statusOptions.map((option) => (
              <button
                key={option}
                type="button"
                data-active={option === signal.status}
                onClick={() => handleStatusUpdate(option)}
                disabled={!canModerate || statusState === 'updating' || option === signal.status}
                data-disabled={!canModerate ? 'true' : undefined}
                title={!canModerate ? 'Switch to a colleague persona to moderate' : undefined}
              >
                {option}
              </button>
            ))}
          </div>
          {!canModerate && (
            <p className="partner-signal-detail__moderation-hint">
              Moderation tools are limited to colleague personas.
            </p>
          )}
          {statusState === 'error' && statusError && (
            <div className="partner-signal-detail__error" role="alert">
              {statusError}
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
