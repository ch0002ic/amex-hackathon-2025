import type {
  DashboardSnapshot,
  EcosystemTrend,
  FraudAlert,
  GrowthOpportunity,
  PlatformKPI,
  WorkflowPlaybook,
  InnovationIdea,
  PartnerSignal,
  PartnerSignalInput,
  PartnerSignalStats,
  PartnerSignalAudit,
  PartnerSignalAssignment,
  LiveAnalyticsSnapshot,
} from "../types";
import { loadAuthProfile, loadIdToken } from "../auth/profile";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

function buildAuthHeaders(): Record<string, string> {
  const profile = loadAuthProfile();
  const token = loadIdToken();
  const headers: Record<string, string> = {
    "X-User-Role": profile.role,
    "X-User-Id": profile.id,
    "X-User-Name": profile.name,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-Id-Token"] = token;
  }

  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = buildAuthHeaders();
  const extraHeaders = (() => {
    if (!init?.headers) {
      return {} as Record<string, string>;
    }

    if (init.headers instanceof Headers) {
      return Object.fromEntries(init.headers.entries());
    }

    if (Array.isArray(init.headers)) {
      return Object.fromEntries(init.headers);
    }

    return init.headers as Record<string, string>;
  })();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
      ...extraHeaders,
    },
    ...init,
  });

  if (!response.ok) {
    const message = `API request failed (${response.status} ${response.statusText})`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchPlatformKPIs(): Promise<PlatformKPI[]> {
  const payload = await request<{ items: PlatformKPI[] }>("/dashboard/kpis");
  return payload.items;
}

export async function fetchEcosystemTrends(): Promise<EcosystemTrend[]> {
  const payload = await request<{ items: EcosystemTrend[] }>(
    "/dashboard/trends"
  );
  return payload.items;
}

export async function fetchGrowthOpportunities(): Promise<GrowthOpportunity[]> {
  const payload = await request<{ items: GrowthOpportunity[] }>(
    "/dashboard/opportunities"
  );
  return payload.items;
}

export async function fetchFraudAlerts(): Promise<FraudAlert[]> {
  const payload = await request<{ items: FraudAlert[] }>("/dashboard/alerts");
  return payload.items;
}

export async function fetchWorkflowPlaybooks(): Promise<WorkflowPlaybook[]> {
  const payload = await request<{ items: WorkflowPlaybook[] }>(
    "/dashboard/playbooks"
  );
  return payload.items;
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return request<DashboardSnapshot>("/dashboard/snapshot");
}

export async function fetchInnovationIdeas(): Promise<InnovationIdea[]> {
  const payload = await request<{ items: InnovationIdea[] }>(
    "/dashboard/ideas"
  );
  return payload.items;
}

export async function fetchLiveAnalyticsSnapshot(): Promise<LiveAnalyticsSnapshot> {
  return request<LiveAnalyticsSnapshot>("/dashboard/live");
}

export interface PartnerSignalQuery {
  signalType?: PartnerSignal["signalType"];
  status?: PartnerSignal["status"];
}

export async function fetchPartnerSignals(
  filters?: PartnerSignalQuery
): Promise<PartnerSignal[]> {
  const params = new URLSearchParams();
  if (filters?.signalType) {
    params.set("signalType", filters.signalType);
  }
  if (filters?.status) {
    params.set("status", filters.status);
  }
  const query = params.toString();
  const payload = await request<{ items: PartnerSignal[] }>(
    `/partners/signals${query ? `?${query}` : ""}`
  );
  return payload.items;
}

export async function createPartnerSignal(
  input: PartnerSignalInput
): Promise<PartnerSignal> {
  return request<PartnerSignal>("/partners/signals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchPartnerSignalStats(): Promise<PartnerSignalStats> {
  return request<PartnerSignalStats>("/partners/signals/stats");
}

export async function updatePartnerSignalStatus(
  id: string,
  status: PartnerSignal["status"],
  notes?: string
): Promise<PartnerSignal> {
  return request<PartnerSignal>(`/partners/signals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes }),
  });
}

export interface PartnerSignalAssignmentRequest {
  reviewerId: string;
  reviewerName: string;
  reviewerRole: "merchant" | "colleague";
  notes?: string;
}

export async function assignPartnerSignalReviewer(
  id: string,
  payload: PartnerSignalAssignmentRequest
): Promise<PartnerSignal> {
  return request<PartnerSignal>(`/partners/signals/${id}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPartnerSignalDetail(
  id: string
): Promise<PartnerSignal> {
  return request<PartnerSignal>(`/partners/signals/${id}`);
}

export async function fetchPartnerSignalAudits(
  id: string
): Promise<PartnerSignalAudit[]> {
  const payload = await request<{ items: PartnerSignalAudit[] }>(
    `/partners/signals/${id}/audits`
  );
  return payload.items;
}

export async function fetchPartnerSignalAssignments(
  id: string
): Promise<PartnerSignalAssignment[]> {
  const payload = await request<{ items: PartnerSignalAssignment[] }>(
    `/partners/signals/${id}/assignments`
  );
  return payload.items;
}
