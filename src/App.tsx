import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchEcosystemTrends,
  fetchFraudAlerts,
  fetchGrowthOpportunities,
  fetchPlatformKPIs,
  fetchWorkflowPlaybooks,
  fetchInnovationIdeas,
  fetchPartnerSignals,
  createPartnerSignal,
  fetchPartnerSignalStats,
  fetchPartnerSignalDetail,
  updatePartnerSignalStatus,
} from './api/mockApi'
import { FraudAlerts } from './components/FraudAlerts'
import { GrowthOpportunities } from './components/GrowthOpportunities'
import { Hero } from './components/Hero'
import { KPICards } from './components/KPICards'
import { InnovationIdeas } from './components/InnovationIdeas'
import { PartnerSignalDetail } from './components/PartnerSignalDetail'
import { TopNav } from './components/TopNav'
import { TrendChart } from './components/TrendChart'
import { WorkflowPlaybooks } from './components/WorkflowPlaybooks'
import { LiveAnalytics } from './components/LiveAnalytics'
import { PartnerSignals, type SignalFilter } from './components/PartnerSignals'
import { IdpSessionBanner } from './components/IdpSessionBanner'
import { Roadmap } from './sections/Roadmap'
import { useAuth } from './auth/AuthContext'
import { withWebSpan } from './telemetry/spans'
import type {
  EcosystemTrend,
  FraudAlert,
  GrowthOpportunity,
  PlatformKPI,
  WorkflowPlaybook,
  InnovationIdea,
  PartnerSignal,
  PartnerSignalInput,
  PartnerSignalStats,
} from './types'
import './App.css'

const SIGNAL_FILTER_STORAGE_KEY = 'amex.partnerSignalFilter'
const STATUS_FILTER_STORAGE_KEY = 'amex.partnerSignalStatusFilter'

type StatusFilter = PartnerSignal['status'] | 'all'

function createInitialCounts(): Record<SignalFilter, number> {
  return {
    all: 0,
    growth: 0,
    risk: 0,
    retention: 0,
    innovation: 0,
    compliance: 0,
  }
}

function createInitialStats(): PartnerSignalStats {
  return {
    total: 0,
    status: {
      pending: 0,
      approved: 0,
      archived: 0,
    },
    signalType: {
      growth: 0,
      risk: 0,
      retention: 0,
      innovation: 0,
      compliance: 0,
    },
  }
}

function countsFromStats(stats: PartnerSignalStats | null): Record<SignalFilter, number> {
  if (!stats) {
    return createInitialCounts()
  }

  return {
    all: stats.total,
    growth: stats.signalType.growth,
    risk: stats.signalType.risk,
    retention: stats.signalType.retention,
    innovation: stats.signalType.innovation,
    compliance: stats.signalType.compliance,
  }
}

function matchesTypeFilter(filter: SignalFilter, signal: PartnerSignal): boolean {
  return filter === 'all' || signal.signalType === filter
}

function matchesStatusFilter(filter: StatusFilter, signal: PartnerSignal): boolean {
  return filter === 'all' || signal.status === filter
}

function applyActiveFilters(
  signals: PartnerSignal[],
  typeFilter: SignalFilter,
  statusFilter: StatusFilter,
): PartnerSignal[] {
  return signals.filter(
    (signal) => matchesTypeFilter(typeFilter, signal) && matchesStatusFilter(statusFilter, signal),
  )
}

function App() {
  const { profile } = useAuth()
  const [kpis, setKpis] = useState<PlatformKPI[]>([])
  const [trends, setTrends] = useState<EcosystemTrend[]>([])
  const [opportunities, setOpportunities] = useState<GrowthOpportunity[]>([])
  const [alerts, setAlerts] = useState<FraudAlert[]>([])
  const [playbooks, setPlaybooks] = useState<WorkflowPlaybook[]>([])
  const [ideas, setIdeas] = useState<InnovationIdea[]>([])
  const [partnerSignals, setPartnerSignals] = useState<PartnerSignal[]>([])
  const [allPartnerSignals, setAllPartnerSignals] = useState<PartnerSignal[]>([])
  const [partnerSignalStats, setPartnerSignalStats] = useState<PartnerSignalStats | null>(null)
  const [partnerSignalCounts, setPartnerSignalCounts] = useState<Record<SignalFilter, number>>(countsFromStats(null))
  const [partnerSignalStatusFilter, setPartnerSignalStatusFilter] = useState<StatusFilter>(() => {
    if (typeof window === 'undefined') {
      return 'all'
    }

    const stored = window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY)
    if (stored && ['all', 'pending', 'approved', 'archived'].includes(stored)) {
      return stored as StatusFilter
    }

    return 'all'
  })
  const [inspectedSignal, setInspectedSignal] = useState<PartnerSignal | null>(null)
  const [inspectedLoading, setInspectedLoading] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [partnerSignalFilter, setPartnerSignalFilter] = useState<SignalFilter>(() => {
    if (typeof window === 'undefined') {
      return 'all'
    }

    const stored = window.localStorage.getItem(SIGNAL_FILTER_STORAGE_KEY)
    if (stored && ['all', 'growth', 'risk', 'retention', 'innovation', 'compliance'].includes(stored)) {
      return stored as SignalFilter
    }

    return 'all'
  })
  const [partnerSignalsLoading, setPartnerSignalsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const refreshPartnerSignalStats = useCallback(async () => {
    const fresh = await fetchPartnerSignalStats()
    setPartnerSignalStats(fresh)
    setPartnerSignalCounts(countsFromStats(fresh))
  }, [])

  useEffect(() => {
    async function bootstrap() {
      const [
        kpiData,
        trendData,
        oppData,
        alertData,
        playbookData,
        ideaData,
        allSignalData,
        statsData,
      ] = await Promise.all([
        fetchPlatformKPIs(),
        fetchEcosystemTrends(),
        fetchGrowthOpportunities(),
        fetchFraudAlerts(),
        fetchWorkflowPlaybooks(),
        fetchInnovationIdeas(),
        fetchPartnerSignals(),
        fetchPartnerSignalStats(),
      ])

      setKpis(kpiData)
      setTrends(trendData)
      setOpportunities(oppData)
      setAlerts(alertData)
      setPlaybooks(playbookData)
      setIdeas(ideaData)
      setAllPartnerSignals(allSignalData)
  setPartnerSignalStats(statsData)
  setPartnerSignalCounts(countsFromStats(statsData))
  setPartnerSignals(allSignalData)
      setLoading(false)
    }

    void bootstrap()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIGNAL_FILTER_STORAGE_KEY, partnerSignalFilter)
    }
  }, [partnerSignalFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STATUS_FILTER_STORAGE_KEY, partnerSignalStatusFilter)
    }
  }, [partnerSignalStatusFilter])

  useEffect(() => {
    let ignore = false

    async function loadFilteredSignals() {
      if (partnerSignalFilter === 'all' && partnerSignalStatusFilter === 'all') {
        return
      }

      setPartnerSignalsLoading(true)
      try {
        const filtered = await fetchPartnerSignals({
          signalType: partnerSignalFilter === 'all' ? undefined : partnerSignalFilter,
          status: partnerSignalStatusFilter === 'all' ? undefined : partnerSignalStatusFilter,
        })
        if (!ignore) {
          setPartnerSignals(filtered)
          setAllPartnerSignals((current) => {
            const merged = new Map(current.map((signal) => [signal.id, signal] as const))
            for (const signal of filtered) {
              merged.set(signal.id, signal)
            }
            return Array.from(merged.values()).sort(
              (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
            )
          })
        }
      } finally {
        if (!ignore) {
          setPartnerSignalsLoading(false)
        }
      }
    }

    void loadFilteredSignals()

    return () => {
      ignore = true
    }
  }, [partnerSignalFilter, partnerSignalStatusFilter])

  useEffect(() => {
    if (partnerSignalFilter === 'all' && partnerSignalStatusFilter === 'all') {
      setPartnerSignals(allPartnerSignals)
      return
    }

    setPartnerSignals(applyActiveFilters(allPartnerSignals, partnerSignalFilter, partnerSignalStatusFilter))
  }, [allPartnerSignals, partnerSignalFilter, partnerSignalStatusFilter])

  useEffect(() => {
    if (!inspectedSignal) {
      return
    }

    const latest = allPartnerSignals.find((signal) => signal.id === inspectedSignal.id)
    if (latest && latest !== inspectedSignal) {
      setInspectedSignal(latest)
    }
  }, [allPartnerSignals, inspectedSignal])

  const handleNavigate = (target: string) => {
    const section = containerRef.current?.querySelector<HTMLElement>(`#${target}`)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleInspectPartnerSignal = useCallback(async (signal: PartnerSignal) => {
    setInspectError(null)
    setInspectedSignal(signal)
    setInspectedLoading(true)

    try {
      const detail = await withWebSpan(
        'ui.partner_signal.inspect',
        () => fetchPartnerSignalDetail(signal.id),
        {
          attributes: {
            'partner.signal.id': signal.id,
            'partner.signal.type': signal.signalType,
          },
        },
      )
      setInspectedSignal(detail)
    } catch (error) {
      console.error(error)
      setInspectError('Unable to load partner signal details. Please try again.')
    } finally {
      setInspectedLoading(false)
    }
  }, [])

  const handleDismissPartnerSignal = useCallback(() => {
    setInspectError(null)
    setInspectedSignal(null)
    setInspectedLoading(false)
  }, [])

  const handleCreatePartnerSignal = async (input: PartnerSignalInput): Promise<PartnerSignal> => {
    const optimisticId = globalThis.crypto?.randomUUID?.() ?? `temp-${Date.now()}`
    const optimisticSignal: PartnerSignal = {
      ...input,
      id: optimisticId,
      submittedAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
      status: 'pending',
      assignedReviewerId: input.assignedReviewerId ?? null,
      assignedReviewerName: input.assignedReviewerName ?? null,
      assignedReviewerRole: input.assignedReviewerRole ?? null,
      assignedAt: input.assignedReviewerId ? new Date().toISOString() : null,
    }

    const typeMatches = matchesTypeFilter(partnerSignalFilter, optimisticSignal)
    const statusMatches = matchesStatusFilter(partnerSignalStatusFilter, optimisticSignal)
    const filterMatches = typeMatches && statusMatches

    if (filterMatches) {
      setPartnerSignals((current) => [optimisticSignal, ...current])
    }

    setAllPartnerSignals((current) => [optimisticSignal, ...current])
    setPartnerSignalCounts((counts) => ({
      ...counts,
      all: counts.all + 1,
      [optimisticSignal.signalType]: counts[optimisticSignal.signalType] + 1,
    }))
    setPartnerSignalStats((stats) => {
      const base = stats ?? createInitialStats()
      return {
        total: base.total + 1,
        status: {
          ...base.status,
          pending: base.status.pending + 1,
        },
        signalType: {
          ...base.signalType,
          [optimisticSignal.signalType]: base.signalType[optimisticSignal.signalType] + 1,
        },
      }
    })

    try {
      const created = await withWebSpan(
        'ui.partner_signal.create',
        () => createPartnerSignal(input),
        {
          attributes: {
            'partner.signal.type': input.signalType,
            'partner.signal.optimistic_id': optimisticId,
          },
        },
      )
      const createdMatches =
        matchesTypeFilter(partnerSignalFilter, created) &&
        matchesStatusFilter(partnerSignalStatusFilter, created)
      if (createdMatches) {
        setPartnerSignals((current) =>
          current.map((signal) => (signal.id === optimisticSignal.id ? created : signal)),
        )
      } else {
        setPartnerSignals((current) =>
          current.filter((signal) => signal.id !== optimisticSignal.id),
        )
      }
      setAllPartnerSignals((current) =>
        current.map((signal) => (signal.id === optimisticSignal.id ? created : signal)),
      )
      void refreshPartnerSignalStats()
      return created
    } catch (error) {
      if (filterMatches) {
        setPartnerSignals((current) =>
          current.filter((signal) => signal.id !== optimisticSignal.id),
        )
      }
      setAllPartnerSignals((current) =>
        current.filter((signal) => signal.id !== optimisticSignal.id),
      )
      setPartnerSignalCounts((counts) => ({
        ...counts,
        all: Math.max(0, counts.all - 1),
        [optimisticSignal.signalType]: Math.max(
          0,
          counts[optimisticSignal.signalType] - 1,
        ),
      }))
      setPartnerSignalStats((stats) => {
        const base = stats ?? createInitialStats()
        return {
          total: Math.max(0, base.total - 1),
          status: {
            ...base.status,
            pending: Math.max(0, base.status.pending - 1),
          },
          signalType: {
            ...base.signalType,
            [optimisticSignal.signalType]: Math.max(
              0,
              base.signalType[optimisticSignal.signalType] - 1,
            ),
          },
        }
      })
      throw error
    }
  }

  const handlePartnerSignalStatusChange = useCallback(
    async (id: string, status: PartnerSignal['status']): Promise<PartnerSignal | null> => {
      const existing = allPartnerSignals.find((signal) => signal.id === id)
      if (!existing) {
        return null
      }

      if (existing.status === status) {
        return existing
      }

      const previousStatus = existing.status

      const rewriteList = (list: PartnerSignal[], nextStatus: PartnerSignal['status']) =>
        list.map((signal) => (signal.id === id ? { ...signal, status: nextStatus } : signal))

      const rewriteVisible = (list: PartnerSignal[], nextStatus: PartnerSignal['status']) =>
        applyActiveFilters(rewriteList(list, nextStatus), partnerSignalFilter, partnerSignalStatusFilter)

      const adjustStats = (from: PartnerSignal['status'], to: PartnerSignal['status']) => {
        if (from === to) {
          return
        }

        setPartnerSignalStats((stats) => {
          const base = stats ?? createInitialStats()
          return {
            ...base,
            status: {
              ...base.status,
              [from]: Math.max(0, base.status[from] - 1),
              [to]: base.status[to] + 1,
            },
          }
        })
      }

      setPartnerSignals((list) => rewriteVisible(list, status))
      setAllPartnerSignals((list) => rewriteList(list, status))
      adjustStats(previousStatus, status)

      try {
        const updated = await withWebSpan(
          'ui.partner_signal.status_change',
          () => updatePartnerSignalStatus(id, status),
          {
            attributes: {
              'partner.signal.id': id,
              'partner.signal.previous_status': previousStatus,
              'partner.signal.new_status': status,
            },
          },
        )
        setPartnerSignals((list) =>
          applyActiveFilters(
            list.map((signal) => (signal.id === id ? updated : signal)),
            partnerSignalFilter,
            partnerSignalStatusFilter,
          ),
        )
        setAllPartnerSignals((list) =>
          list.map((signal) => (signal.id === id ? updated : signal)),
        )
        setInspectedSignal((current) => (current?.id === id ? updated : current))
        void refreshPartnerSignalStats()
        return updated
      } catch (error) {
    setPartnerSignals((list) => rewriteVisible(list, previousStatus))
    setAllPartnerSignals((list) => rewriteList(list, previousStatus))
        setInspectedSignal((current) =>
          current?.id === id ? { ...current, status: previousStatus } : current,
        )
        adjustStats(status, previousStatus)
        throw error
      }
    },
    [allPartnerSignals, refreshPartnerSignalStats, partnerSignalFilter, partnerSignalStatusFilter],
  )

  const handlePartnerFilterChange = useCallback(
    (next: SignalFilter) => {
      setPartnerSignalFilter(next)
      if (next === 'all' && partnerSignalStatusFilter === 'all') {
        setPartnerSignals(allPartnerSignals)
        setPartnerSignalsLoading(false)
      } else {
        setPartnerSignalsLoading(true)
      }
    },
    [allPartnerSignals, partnerSignalStatusFilter],
  )

  const handlePartnerStatusFilterChange = useCallback(
    (next: StatusFilter) => {
      setPartnerSignalStatusFilter(next)
      if (partnerSignalFilter === 'all' && next === 'all') {
        setPartnerSignals(allPartnerSignals)
        setPartnerSignalsLoading(false)
      } else {
        setPartnerSignalsLoading(true)
      }
    },
    [allPartnerSignals, partnerSignalFilter],
  )

  const canModerate = profile.role === 'colleague'

  return (
    <div className="app-shell">
      <TopNav onNavigate={handleNavigate} />
      <IdpSessionBanner />
      <main ref={containerRef}>
        <Hero />
        {loading ? (
          <div className="loading">Calibrating ecosystem insights…</div>
        ) : (
          <>
            <section className="panel" id="partner-signals">
              <header className="panel__header">
                <h2>Partner Signal Operations</h2>
                <p>Persist real-time partner intelligence and broadcast it across portfolio squads.</p>
              </header>
              <PartnerSignals
                signals={partnerSignals}
                onSubmit={handleCreatePartnerSignal}
                onInspect={handleInspectPartnerSignal}
                onStatusChange={handlePartnerSignalStatusChange}
                activeFilter={partnerSignalFilter}
                activeStatusFilter={partnerSignalStatusFilter}
                onFilterChange={handlePartnerFilterChange}
                onStatusFilterChange={handlePartnerStatusFilterChange}
                filterCounts={partnerSignalCounts}
                isFilterLoading={partnerSignalsLoading}
                stats={partnerSignalStats}
                canModerate={canModerate}
              />
            </section>

            <section className="panel" id="intelligence">
              <h2>Cross-Loop Signal Pulse</h2>
              <KPICards data={kpis} />
            </section>

            <section className="panel">
              <TrendChart trends={trends} />
            </section>

            <section className="panel" id="live-analytics">
              <header className="panel__header">
                <h2>Live Network Telemetry</h2>
                <p>Streaming instrumentation marrying partner spend velocity with risk defenses.</p>
              </header>
              <LiveAnalytics />
            </section>

            <section className="panel">
              <header className="panel__header">
                <h2>Top Merchant Growth Plays</h2>
                <p>
                  AI-curated recommendations derived from AMEX&apos;s closed-loop visibility
                  across merchants and card members.
                </p>
              </header>
              <GrowthOpportunities opportunities={opportunities} />
            </section>

            <section className="panel" id="protection">
              <FraudAlerts alerts={alerts} />
            </section>

            <section className="panel" id="productivity">
              <header className="panel__header">
                <h2>Colleague Copilot Playbooks</h2>
                <p>Designed to unblock analysts, risk strategists, and partnership teams.</p>
              </header>
              <WorkflowPlaybooks playbooks={playbooks} />
            </section>

            <section className="panel" id="innovation">
              <InnovationIdeas ideas={ideas} />
            </section>

            <section className="panel" id="roadmap">
              <Roadmap />
            </section>
          </>
        )}
      </main>
      <footer className="footer">
        <p>
          Built for AMEX GenAI Hackathon 2025 · Privacy-first, compliant, and scalable by
          design.
        </p>
      </footer>
      <PartnerSignalDetail
        signal={inspectedSignal}
        isOpen={Boolean(inspectedSignal)}
        onClose={handleDismissPartnerSignal}
        isLoading={inspectedLoading}
        error={inspectError}
        onStatusChange={handlePartnerSignalStatusChange}
        canModerate={canModerate}
      />
    </div>
  )
}

export default App
