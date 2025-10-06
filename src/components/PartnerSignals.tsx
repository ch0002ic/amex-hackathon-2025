import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { PartnerSignal, PartnerSignalInput, PartnerSignalStats } from '../types'
import './PartnerSignals.css'

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'
type ToastTone = 'success' | 'error'
export type SignalFilter = PartnerSignalInput['signalType'] | 'all'
type StatusFilter = PartnerSignal['status'] | 'all'
type DraftPersistenceState = 'idle' | 'saving' | 'saved'
type MetadataPresetKey = 'regionPilot' | 'paidMediaPlay' | 'riskMitigation'
const METADATA_HINT_SESSION_KEY = 'amex.partnerSignalMetadataHintDismissed'

interface ToastState {
  id: number
  message: string
  tone: ToastTone
}

interface PartnerSignalsProps {
  signals: PartnerSignal[]
  onSubmit: (input: PartnerSignalInput) => Promise<PartnerSignal>
  onInspect: (signal: PartnerSignal) => void
  onStatusChange: (id: string, status: PartnerSignal['status']) => Promise<PartnerSignal | null>
  activeFilter: SignalFilter
  activeStatusFilter: StatusFilter
  onFilterChange: (filter: SignalFilter) => void
  onStatusFilterChange: (status: StatusFilter) => void
  filterCounts: Record<SignalFilter, number>
  isFilterLoading: boolean
  stats: PartnerSignalStats | null
  canModerate: boolean
}

const signalTypeOptions: Array<{ value: PartnerSignalInput['signalType']; label: string }> = [
  { value: 'growth', label: 'Growth' },
  { value: 'risk', label: 'Risk' },
  { value: 'retention', label: 'Retention' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'compliance', label: 'Compliance' },
]

const filterSequence: SignalFilter[] = [
  'all',
  ...signalTypeOptions.map((option) => option.value),
]

const statusFilterSequence: StatusFilter[] = ['all', 'pending', 'approved', 'archived']

const metadataPresets: Record<MetadataPresetKey, { label: string; description: string; value: Record<string, unknown> }> = {
  regionPilot: {
    label: 'Regional Pilot Launch',
    description: 'Track geography rollout details with aligned analyst owners.',
    value: {
      region: 'APAC',
      pilotMarkets: ['Singapore', 'Hong Kong'],
      partnerLead: 'ecosystem-labs-analyst',
      rolloutPhase: 'beta',
    },
  },
  paidMediaPlay: {
    label: 'Paid Media Performance',
    description: 'Capture CTR/CVR uplift for co-funded campaigns.',
    value: {
      campaign: 'travel-summer-boost',
      metrics: {
        ctr: 0.041,
        cvr: 0.012,
        spend: 12000,
      },
      attributionWindowDays: 14,
    },
  },
  riskMitigation: {
    label: 'Risk Mitigation Flag',
    description: 'Log controls added after anomaly detection.',
    value: {
      trigger: 'velocity-spike',
      mitigationSteps: ['rate-limit commerce API', 'enable step-up auth'],
      owner: 'risk-ops-latam',
      reviewDate: new Date().toISOString().slice(0, 10),
    },
  },
}

function calculateHintDuration(textLength: number): number {
  const MIN_DURATION = 3500
  const MAX_DURATION = 6500
  if (!Number.isFinite(textLength) || textLength <= 0) {
    return MIN_DURATION
  }

  const adaptiveDuration = 2200 + textLength * 8
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, adaptiveDuration))
}

function createInitialFormState(): PartnerSignalInput {
  return {
    partnerId: '',
    partnerName: '',
    merchantId: '',
    merchantName: '',
    signalType: 'growth',
    description: '',
    confidence: 0.5,
    metadata: undefined,
  }
}

const FORM_STORAGE_KEY = 'amex.partnerSignalDraft'

function loadFormDraft(): { form: PartnerSignalInput; metadata: string; savedAt: string | null } {
  const baseForm = createInitialFormState()

  if (typeof window === 'undefined') {
    return { form: baseForm, metadata: '', savedAt: null }
  }

  const raw = window.localStorage.getItem(FORM_STORAGE_KEY)
  if (!raw) {
    return { form: baseForm, metadata: '', savedAt: null }
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const draftForm: PartnerSignalInput = { ...baseForm }
      const maybeForm = (parsed as Record<string, unknown>).form

      if (maybeForm && typeof maybeForm === 'object') {
        const formRecord = maybeForm as Record<string, unknown>
        const allowedTypes = new Set(signalTypeOptions.map((option) => option.value))

        if (typeof formRecord.partnerId === 'string') {
          draftForm.partnerId = formRecord.partnerId
        }
        if (typeof formRecord.partnerName === 'string') {
          draftForm.partnerName = formRecord.partnerName
        }
        if (typeof formRecord.merchantId === 'string') {
          draftForm.merchantId = formRecord.merchantId
        }
        if (typeof formRecord.merchantName === 'string') {
          draftForm.merchantName = formRecord.merchantName
        }
        if (typeof formRecord.signalType === 'string' && allowedTypes.has(formRecord.signalType as PartnerSignalInput['signalType'])) {
          draftForm.signalType = formRecord.signalType as PartnerSignalInput['signalType']
        }
        if (typeof formRecord.description === 'string') {
          draftForm.description = formRecord.description
        }
        if (typeof formRecord.confidence === 'number' && Number.isFinite(formRecord.confidence)) {
          draftForm.confidence = Math.min(1, Math.max(0, formRecord.confidence))
        }
        if (formRecord.metadata && typeof formRecord.metadata === 'object') {
          draftForm.metadata = formRecord.metadata as Record<string, unknown>
        }
      }

      const metadata = typeof (parsed as Record<string, unknown>).metadata === 'string'
        ? ((parsed as Record<string, unknown>).metadata as string)
        : ''
      const savedAt = typeof (parsed as Record<string, unknown>).savedAt === 'string'
        ? ((parsed as Record<string, unknown>).savedAt as string)
        : null

      return { form: draftForm, metadata, savedAt }
    }
  } catch (error) {
    console.warn('Failed to load partner signal draft from storage', error)
  }

  return { form: baseForm, metadata: '', savedAt: null }
}

function formatTimestamp(timestamp: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return formatter.format(new Date(timestamp))
}

function formatRelativeTimestamp(timestamp: string): string {
  const target = new Date(timestamp).getTime()
  if (!Number.isFinite(target)) {
    return ''
  }

  const now = Date.now()
  const diffMs = Math.max(0, now - target)
  const diffSeconds = Math.round(diffMs / 1000)

  if (diffSeconds < 30) {
    return 'just now'
  }

  if (diffSeconds < 90) {
    return '1 minute ago'
  }

  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  const diffWeeks = Math.round(diffDays / 7)
  if (diffWeeks < 5) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  }

  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`
  }

  const diffYears = Math.round(diffDays / 365)
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function PartnerSignals({
  signals,
  onSubmit,
  onInspect,
  onStatusChange,
  activeFilter,
  activeStatusFilter,
  onFilterChange,
  onStatusFilterChange,
  filterCounts,
  isFilterLoading,
  stats,
  canModerate,
}: PartnerSignalsProps) {
  const initialDraft = useMemo(loadFormDraft, [])
  const [formState, setFormState] = useState<PartnerSignalInput>(initialDraft.form)
  const [metadataInput, setMetadataInput] = useState(initialDraft.metadata)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const metadataTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const metadataErrorId = metadataError ? 'partner-signals-metadata-error' : undefined
  const metadataInlineTooltipId = 'partner-signals-metadata-preset-hint'
  const [metadataHintDismissed, setMetadataHintDismissed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    try {
      return window.sessionStorage.getItem(METADATA_HINT_SESSION_KEY) === '1'
    } catch (error) {
      console.warn('Unable to read preset hint dismissal state', error)
      return false
    }
  })
  const [metadataShowTooltip, setMetadataShowTooltip] = useState(false)
  const [metadataHintAnimationKey, setMetadataHintAnimationKey] = useState(0)
  const [metadataHintDurationMs, setMetadataHintDurationMs] = useState(() =>
    calculateHintDuration(initialDraft.metadata.length),
  )
  const [status, setStatus] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<Record<string, PartnerSignal['status']>>({})
  const shouldClearDraft = useRef(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(initialDraft.savedAt)
  const [draftSavedLabel, setDraftSavedLabel] = useState<string | null>(
    initialDraft.savedAt ? formatRelativeTimestamp(initialDraft.savedAt) : null,
  )
  const [draftStatus, setDraftStatus] = useState<DraftPersistenceState>(
    initialDraft.savedAt ? 'saved' : 'idle',
  )
  const lastPersistedSnapshot = useRef<string>(
    JSON.stringify({ form: initialDraft.form, metadata: initialDraft.metadata }),
  )
  const persistTimeout = useRef<number | null>(null)

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timeout = window.setTimeout(() => {
        setStatus('idle')
        setErrorMessage(null)
      }, 4000)

      return () => window.clearTimeout(timeout)
    }

    return undefined
  }, [status])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (persistTimeout.current !== null) {
      window.clearTimeout(persistTimeout.current)
      persistTimeout.current = null
    }

    if (shouldClearDraft.current) {
      window.localStorage.removeItem(FORM_STORAGE_KEY)
      shouldClearDraft.current = false
      lastPersistedSnapshot.current = JSON.stringify({
        form: createInitialFormState(),
        metadata: '',
      })
      setDraftSavedAt(null)
      setDraftSavedLabel(null)
      setDraftStatus('idle')
      return
    }

    const serialized = JSON.stringify({ form: formState, metadata: metadataInput })
    if (serialized === lastPersistedSnapshot.current) {
      return
    }

    setDraftStatus('saving')

    const timeoutId = window.setTimeout(() => {
      const timestamp = new Date().toISOString()
      lastPersistedSnapshot.current = serialized
      persistTimeout.current = null

      try {
        window.localStorage.setItem(
          FORM_STORAGE_KEY,
          JSON.stringify({ form: formState, metadata: metadataInput, savedAt: timestamp }),
        )
        setDraftSavedAt(timestamp)
        setDraftSavedLabel(formatRelativeTimestamp(timestamp))
        setDraftStatus('saved')
      } catch (error) {
        console.warn('Unable to persist partner signal draft', error)
        setDraftStatus('idle')
      }
    }, 500)

    persistTimeout.current = timeoutId

    return () => {
      if (persistTimeout.current !== null) {
        window.clearTimeout(persistTimeout.current)
        persistTimeout.current = null
      }
    }
  }, [formState, metadataInput])

  useEffect(() => {
    if (!draftSavedAt) {
      setDraftSavedLabel(null)
      return
    }

    const updateLabel = () => {
      setDraftSavedLabel(formatRelativeTimestamp(draftSavedAt))
    }

    updateLabel()

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    let intervalId: number | null = null

    const clearIntervalIfNeeded = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const resumeInterval = () => {
      clearIntervalIfNeeded()
      intervalId = window.setInterval(updateLabel, 30000)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearIntervalIfNeeded()
      } else {
        updateLabel()
        resumeInterval()
      }
    }

    if (document.visibilityState !== 'hidden') {
      resumeInterval()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearIntervalIfNeeded()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [draftSavedAt])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timeout = window.setTimeout(() => {
      setToast(null)
    }, 3600)

    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return
      }

      const index = Number.parseInt(event.key, 10)
      if (!Number.isNaN(index) && index >= 1 && index <= filterSequence.length) {
        event.preventDefault()
        onFilterChange(filterSequence[index - 1])
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onFilterChange])

  useEffect(() => {
    if (metadataHintDismissed) {
      setMetadataShowTooltip(false)
      setMetadataHintAnimationKey((value) => value + 1)
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    setMetadataShowTooltip(true)
    setMetadataHintAnimationKey((value) => value + 1)
    const nextTimeoutMs = Number.isFinite(metadataHintDurationMs)
      ? Math.min(6500, Math.max(3500, metadataHintDurationMs))
      : 4000
    const timeout = window.setTimeout(() => {
      setMetadataShowTooltip(false)
      setMetadataHintAnimationKey((value) => value + 1)
    }, nextTimeoutMs)

    return () => window.clearTimeout(timeout)
  }, [metadataHintDismissed, metadataHintDurationMs])

  useEffect(() => {
    if (metadataHintDismissed) {
      return
    }

    const nextDuration = calculateHintDuration(metadataInput.length)
    setMetadataHintDurationMs((current) => (current === nextDuration ? current : nextDuration))
  }, [metadataInput, metadataHintDismissed])

  const hasSignals = signals.length > 0
  const statusStats = stats?.status ?? { pending: 0, approved: 0, archived: 0 }
  const totalStats = stats?.total ?? 0
  const statusOptions: PartnerSignal['status'][] = ['pending', 'approved', 'archived']
  const statusFilterCounts: Record<StatusFilter, number> = {
    all: totalStats,
    pending: statusStats.pending,
    approved: statusStats.approved,
    archived: statusStats.archived,
  }

  async function handleStatusUpdate(signal: PartnerSignal, nextStatus: PartnerSignal['status']) {
    if (signal.status === nextStatus) {
      return
    }

    if (!canModerate) {
      setToast({
        id: Date.now(),
        tone: 'error',
        message: 'Status updates require a colleague moderator persona.',
      })
      return
    }

    setStatusUpdating((current) => ({ ...current, [signal.id]: nextStatus }))

    try {
      await onStatusChange(signal.id, nextStatus)
      setToast({ id: Date.now(), tone: 'success', message: `${signal.partnerName} marked as ${nextStatus}` })
    } catch (error) {
      console.error(error)
      setToast({ id: Date.now(), tone: 'error', message: 'Unable to update status. Please try again.' })
    } finally {
      setStatusUpdating((current) => {
        const next = { ...current }
        delete next[signal.id]
        return next
      })
    }
  }

  const hasDraft = useMemo(() => {
    if (metadataInput.trim().length > 0) {
      return true
    }

    return (
      formState.partnerId.trim().length > 0 ||
      formState.partnerName.trim().length > 0 ||
      formState.merchantId.trim().length > 0 ||
      formState.merchantName.trim().length > 0 ||
      formState.signalType !== 'growth' ||
      formState.description.trim().length > 0 ||
      Math.abs(formState.confidence - 0.5) > 0.0001 ||
      (formState.metadata && Object.keys(formState.metadata).length > 0)
    )
  }, [formState, metadataInput])

  function handleDiscardDraft() {
    shouldClearDraft.current = true
    setFormState(createInitialFormState())
    setMetadataInput('')
    setMetadataError(null)
    setStatus('idle')
    setErrorMessage(null)
    setToast({ id: Date.now(), tone: 'success', message: 'Draft cleared' })
    setDraftSavedAt(null)
    setDraftStatus('idle')
    setDraftSavedLabel(null)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target

    if (name === 'confidence') {
      setFormState((prev) => ({
        ...prev,
        confidence: Number.parseFloat(value) || 0,
      }))
      return
    }

    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function handleMetadataChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const { value } = event.target
    setMetadataInput(value)
    setErrorMessage(null)

    if (!value.trim()) {
      setMetadataError(null)
      return
    }

    try {
      const parsed = JSON.parse(value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setMetadataError('Metadata must be a JSON object (e.g., {"region": "APAC"}).')
      } else {
        setMetadataError(null)
      }
    } catch {
      setMetadataError('Invalid JSON syntax — keep editing until the object is balanced.')
    }
  }

  function handleMetadataPresetApply(key: MetadataPresetKey) {
    const preset = metadataPresets[key]
    const serialized = `${JSON.stringify(preset.value, null, 2)}\n`
    setMetadataInput(serialized)
    setMetadataError(null)
    setErrorMessage(null)
    setMetadataHintDurationMs(calculateHintDuration(serialized.length))
    if (metadataTextareaRef.current) {
      metadataTextareaRef.current.focus()
    }
  }

  function handleMetadataHintDismiss() {
    setMetadataHintDismissed(true)
    setMetadataShowTooltip(false)

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(METADATA_HINT_SESSION_KEY, '1')
      } catch (error) {
        console.warn('Unable to persist preset hint dismissal', error)
      }
    }
  }

  function handleMetadataPresetFocus() {
    if (!metadataHintDismissed) {
      setMetadataShowTooltip(true)
      setMetadataHintAnimationKey((value) => value + 1)
    }
  }

  function handleMetadataPresetBlur() {
    if (!metadataHintDismissed) {
      setMetadataShowTooltip(false)
      setMetadataHintAnimationKey((value) => value + 1)
    }
  }

  function handleMetadataPresetMouseEnter() {
    if (!metadataHintDismissed) {
      setMetadataShowTooltip(true)
      setMetadataHintAnimationKey((value) => value + 1)
      setMetadataHintDurationMs(calculateHintDuration(metadataInput.length))
    }
  }

  function handleMetadataPresetMouseLeave() {
    if (!metadataHintDismissed) {
      setMetadataShowTooltip(false)
      setMetadataHintAnimationKey((value) => value + 1)
    }
  }

  function handleMetadataHintReset() {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(METADATA_HINT_SESSION_KEY)
      } catch (error) {
        console.warn('Unable to reset preset hint dismissal', error)
      }
    }

    setMetadataHintDismissed(false)
    setMetadataShowTooltip(true)
    setMetadataHintDurationMs(calculateHintDuration(metadataInput.length))
    setMetadataHintAnimationKey((value) => value + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (metadataError) {
      setStatus('error')
      setErrorMessage(metadataError)
      setToast({ id: Date.now(), tone: 'error', message: metadataError })
      return
    }

    let metadata: PartnerSignalInput['metadata'] = undefined

    if (metadataInput.trim()) {
      try {
        const parsed = JSON.parse(metadataInput)
        if (parsed && typeof parsed === 'object') {
          metadata = parsed as Record<string, unknown>
        } else {
          throw new Error('Metadata must be a JSON object')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Metadata must be valid JSON'
        setErrorMessage(message)
        setToast({ id: Date.now(), message, tone: 'error' })
        setStatus('error')
        return
      }
    }

    try {
      setStatus('submitting')
      const created = await onSubmit({
        ...formState,
        metadata,
      })
      shouldClearDraft.current = true
      setFormState(createInitialFormState())
      setMetadataInput('')
    setMetadataError(null)
      setDraftSavedAt(null)
    setDraftSavedLabel(null)
      setDraftStatus('idle')
      setStatus('success')
      setToast({
        id: Date.now(),
        tone: 'success',
        message: `Signal from ${created.partnerName} captured`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to submit partner signal'
      setErrorMessage(message)
      setToast({ id: Date.now(), tone: 'error', message })
      setStatus('error')
    }
  }

  return (
    <div className="partner-signals">
      {toast && (
        <div className={`partner-signals__toast partner-signals__toast--${toast.tone}`}>
          {toast.message}
        </div>
      )}
      <div className="partner-signals__intro">
        <p>
          Track the freshest partner intelligence across AMEX&apos;s ecosystem. Submit field
          signals when you encounter innovation plays, risk events, or retention wins worth
          amplifying across the network.
        </p>
      </div>

      <form className="partner-signals__form" onSubmit={handleSubmit}>
        <div className="partner-signals__header">
          <h3>Submit Partner Intelligence</h3>
          <p>New entries propagate instantly across the partner signal backlog.</p>
        </div>

        <div className="partner-signals__grid">
          <label>
            <span>Partner ID</span>
            <input
              required
              name="partnerId"
              value={formState.partnerId}
              onChange={handleInputChange}
              placeholder="ecosystem-labs"
            />
            <small>Use the partner&apos;s canonical short identifier.</small>
          </label>

          <label>
            <span>Partner Name</span>
            <input
              required
              name="partnerName"
              value={formState.partnerName}
              onChange={handleInputChange}
              placeholder="Ecosystem Labs"
            />
            <small>Displayed across dashboards for quick recognition.</small>
          </label>

          <label>
            <span>Merchant ID</span>
            <input
              required
              name="merchantId"
              value={formState.merchantId}
              onChange={handleInputChange}
              placeholder="mkt-4721"
            />
            <small>Matches the merchant identifier in AMEX systems.</small>
          </label>

          <label>
            <span>Merchant Name</span>
            <input
              required
              name="merchantName"
              value={formState.merchantName}
              onChange={handleInputChange}
              placeholder="LuxeStay Collection"
            />
            <small>Appears in the backlog and downstream alerts.</small>
          </label>

          <label>
            <span>Signal Type</span>
            <select
              name="signalType"
              value={formState.signalType}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  signalType: event.target.value as PartnerSignalInput['signalType'],
                }))
              }
            >
              {signalTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Anchor the signal in a core operating theme.</small>
          </label>

          <label>
            <span>Confidence</span>
            <input
              type="number"
              name="confidence"
              min="0"
              max="1"
              step="0.01"
              value={formState.confidence}
              onChange={handleInputChange}
            />
            <small>
              {`Confidence ${Math.round(formState.confidence * 100)}% · quantify conviction between 0 and 100%.`}
            </small>
          </label>
        </div>

        <label className="partner-signals__description">
          <span>Insight Description</span>
          <textarea
            required
            name="description"
            minLength={20}
            rows={4}
            value={formState.description}
            onChange={handleInputChange}
            placeholder="Summarize the partner intelligence and the measurable outcome."
          />
          <small>
            {formState.description.trim().length >= 20
              ? 'Looks great — keep it punchy and outcome-led.'
              : `Add ${20 - formState.description.trim().length} more characters for a clear summary.`}
          </small>
        </label>

        <label className="partner-signals__metadata">
          <span>Metadata (JSON)</span>
          <div
            className="partner-signals__metadata-presets"
            role="group"
            aria-label="Insert structured metadata"
            aria-describedby={metadataHintDismissed ? undefined : metadataInlineTooltipId}
          >
            {Object.entries(metadataPresets).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMetadataPresetApply(key as MetadataPresetKey)}
                disabled={status === 'submitting'}
                title={preset.description}
                onFocus={handleMetadataPresetFocus}
                onBlur={handleMetadataPresetBlur}
                onMouseEnter={handleMetadataPresetMouseEnter}
                onMouseLeave={handleMetadataPresetMouseLeave}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {metadataHintDismissed && (
            <button
              type="button"
              className="partner-signals__metadata-hint-reset"
              onClick={handleMetadataHintReset}
            >
              Show preset guidance
            </button>
          )}
          {!metadataHintDismissed && (
            <small
              key={metadataHintAnimationKey}
              id={metadataInlineTooltipId}
              className="partner-signals__metadata-hint"
              data-visible={metadataShowTooltip ? 'true' : 'false'}
            >
              Presets replace existing JSON; adjust the fields after inserting to match your insight.
              <button type="button" onClick={handleMetadataHintDismiss} aria-label="Dismiss preset guidance">
                Got it
              </button>
            </small>
          )}
          <textarea
            name="metadata"
            rows={3}
            value={metadataInput}
            ref={metadataTextareaRef}
            onChange={handleMetadataChange}
            placeholder='{"region": "APAC", "pilotMarkets": ["Singapore"]}'
            aria-invalid={metadataError ? 'true' : 'false'}
            aria-describedby={metadataErrorId ?? (metadataHintDismissed ? undefined : metadataInlineTooltipId)}
            data-invalid={metadataError ? 'true' : undefined}
          />
          {metadataError ? (
            <small
              id={metadataErrorId}
              className="partner-signals__metadata-error"
              aria-live="polite"
              role="alert"
            >
              {metadataError}
            </small>
          ) : (
            <small>Optional: enrich with experiment metrics or segmentation as JSON.</small>
          )}
        </label>

        <div className="partner-signals__actions">
          <button type="submit" disabled={status === 'submitting' || Boolean(metadataError)}>
            {status === 'submitting' ? 'Publishing…' : 'Publish Signal'}
          </button>
          <button
            type="button"
            className="partner-signals__discard"
            onClick={handleDiscardDraft}
            disabled={!hasDraft || status === 'submitting'}
          >
            Discard Draft
          </button>
          {draftStatus === 'saving' && (
            <span className="partner-signals__draft-indicator" aria-live="polite">
              Saving draft…
            </span>
          )}
          {draftStatus === 'saved' && draftSavedAt && (
            <span className="partner-signals__draft-indicator" aria-live="polite">
              Draft saved {draftSavedLabel ?? formatTimestamp(draftSavedAt)}
              {draftSavedLabel && (
                <>
                  {' '}
                  <time dateTime={draftSavedAt}>
                    ({formatTimestamp(draftSavedAt)})
                  </time>
                </>
              )}
            </span>
          )}
          {status === 'success' && <span className="partner-signals__status">Signal captured.</span>}
          {status === 'error' && errorMessage && (
            <span className="partner-signals__status partner-signals__status--error">{errorMessage}</span>
          )}
        </div>
      </form>

      <div
        className="partner-signals__list"
        data-empty={!hasSignals && !isFilterLoading}
        aria-busy={isFilterLoading}
      >
        <header>
          <div>
            <h3>Partner Signal Backlog</h3>
            <p>Sorted by most recent submissions from the ecosystem network.</p>
          </div>
          <div className="partner-signals__filters" role="tablist" aria-label="Filter partner signals">
            {filterSequence.map((filterValue) => {
              const label =
                filterValue === 'all'
                  ? 'All'
                  : signalTypeOptions.find((option) => option.value === filterValue)?.label ??
                    filterValue

              return (
                <button
                  key={filterValue}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filterValue}
                  className="partner-signals__filter"
                  data-active={activeFilter === filterValue}
                  data-loading={isFilterLoading}
                  onClick={() => onFilterChange(filterValue)}
                  disabled={isFilterLoading && activeFilter !== filterValue}
                >
                  <span>{label}</span>
                  <small>{filterCounts[filterValue]}</small>
                </button>
              )
            })}
          </div>
          <div
            className="partner-signals__status-filters"
            role="tablist"
            aria-label="Filter partner signals by review status"
          >
            {statusFilterSequence.map((statusValue) => {
              const label =
                statusValue === 'all'
                  ? 'All statuses'
                  : statusValue.charAt(0).toUpperCase() + statusValue.slice(1)

              return (
                <button
                  key={statusValue}
                  type="button"
                  role="tab"
                  aria-selected={activeStatusFilter === statusValue}
                  className="partner-signals__status-filter"
                  data-active={activeStatusFilter === statusValue}
                  data-loading={isFilterLoading}
                  onClick={() => onStatusFilterChange(statusValue)}
                  disabled={isFilterLoading && activeStatusFilter !== statusValue}
                >
                  <span>{label}</span>
                  <small>{statusFilterCounts[statusValue]}</small>
                </button>
              )
            })}
          </div>
          <p className="partner-signals__filters-hint" aria-hidden="true">
            Press 1-6 to toggle type filters instantly.
          </p>
          <div className="partner-signals__stats" aria-live="polite">
            <div>
              <span>Total</span>
              <strong>{totalStats}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{statusStats.pending}</strong>
            </div>
            <div>
              <span>Approved</span>
              <strong>{statusStats.approved}</strong>
            </div>
            <div>
              <span>Archived</span>
              <strong>{statusStats.archived}</strong>
            </div>
          </div>
        </header>

        {hasSignals ? (
          <ul>
            {signals.map((signal) => {
              const reviewerRoleLabel = signal.assignedReviewerRole
                ? `${signal.assignedReviewerRole.charAt(0).toUpperCase()}${signal.assignedReviewerRole.slice(1)}`
                : null
              const assignedReviewerLabel = signal.assignedReviewerName
                ? reviewerRoleLabel
                  ? `${signal.assignedReviewerName} (${reviewerRoleLabel})`
                  : signal.assignedReviewerName
                : 'Unassigned'
              const assignedSince = signal.assignedReviewerName && signal.assignedAt
                ? formatRelativeTimestamp(signal.assignedAt)
                : null

              return (
                <li key={signal.id}>
                  <article>
                    <header>
                      <div>
                        <h4>{signal.merchantName}</h4>
                        <p>
                          From <strong>{signal.partnerName}</strong> · {signal.partnerId}
                        </p>
                      </div>
                      <div className="partner-signals__card-tags">
                        <span
                          className={`partner-signals__status-pill partner-signals__status-pill--${signal.status}`}
                        >
                          {signal.status}
                        </span>
                        <div className={`partner-signals__badge partner-signals__badge--${signal.signalType}`}>
                          {signal.signalType}
                        </div>
                      </div>
                    </header>
                    <p className="partner-signals__description-text">{signal.description}</p>
                    <dl>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{formatConfidence(signal.confidence)}</dd>
                      </div>
                      <div>
                        <dt>Submitted</dt>
                        <dd>{formatTimestamp(signal.submittedAt)}</dd>
                      </div>
                    </dl>
                    <div className="partner-signals__assignment">
                      <span>Assigned reviewer</span>
                      <strong>{assignedReviewerLabel}</strong>
                      {assignedSince && <small>Assigned {assignedSince}</small>}
                    </div>
                    <div className="partner-signals__status-actions" role="group" aria-label="Update status">
                      {statusOptions.map((statusOption) => {
                        const isActive = statusOption === signal.status
                        const loadingState = statusUpdating[signal.id]
                        const isLoading = Boolean(loadingState)
                        const moderationLocked = !canModerate
                        const isDisabled = moderationLocked || isActive || isLoading
                        return (
                          <button
                            key={statusOption}
                            type="button"
                            className="partner-signals__status-button"
                            data-active={isActive}
                            data-loading={isLoading && loadingState === statusOption}
                            onClick={() => handleStatusUpdate(signal, statusOption)}
                            disabled={isDisabled}
                            data-disabled={moderationLocked ? 'true' : undefined}
                            title={moderationLocked ? 'Switch to a colleague persona to moderate' : undefined}
                          >
                            {statusOption}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className="partner-signals__detail-button"
                      onClick={() => onInspect(signal)}
                    >
                      View details
                    </button>
                    {signal.metadata && Object.keys(signal.metadata).length > 0 && (
                      <div className="partner-signals__metadata-view">
                        <span>Metadata</span>
                        <ul>
                          {Object.entries(signal.metadata).map(([key, value]) => (
                            <li key={key}>
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        ) : isFilterLoading ? (
          <div className="partner-signals__empty">Loading partner signals…</div>
        ) : (
          <div className="partner-signals__empty">
            {activeFilter === 'all'
              ? 'No partner signals submitted yet.'
              : `No ${activeFilter} insights yet—share the first breakthrough.`}
          </div>
        )}
      </div>
    </div>
  )
}
