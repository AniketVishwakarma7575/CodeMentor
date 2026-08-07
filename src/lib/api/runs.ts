import type { Finding, RunStage, Severity } from "@/lib/types";
import { apiFetch, apiRequest } from "./client";
import { USE_FIXTURES } from "./config";
import { FINDINGS } from "@/data/findings";

/* ============================================================================
   Runs + findings.

   Every fetcher honours USE_FIXTURES so the whole app still renders with the
   backend down — the fixtures in src/data/ are too good to delete and double
   as the offline/design mode.
   ========================================================================== */

export interface CreateRunResponse {
  runId: string;
  status: "running" | "queued";
  mode: "snippet" | "repo";
  eventsUrl: string;
}

export type CreateRunBody =
  | { mode: "snippet"; source: string; language?: string; filename?: string }
  | { mode: "repo"; repoId: string; branch?: string; commitSha?: string };

export function createRun(body: CreateRunBody): Promise<CreateRunResponse> {
  return apiFetch<CreateRunResponse>("/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface RunDetail {
  id: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  stages: RunStage[];
  score: number | null;
}

export function getRun(runId: string): Promise<RunDetail> {
  return apiFetch<RunDetail>(`/runs/${runId}`);
}

export interface FindingFilters {
  severity?: Severity[];
  status?: string[];
  file?: string;
}

export async function getFindings(
  runId: string,
  filters: FindingFilters = {}
): Promise<{ findings: Finding[]; total: number }> {
  if (USE_FIXTURES) return { findings: FINDINGS, total: FINDINGS.length };

  const qs = new URLSearchParams();
  if (filters.severity?.length) qs.set("severity", filters.severity.join(","));
  if (filters.status?.length) qs.set("status", filters.status.join(","));
  if (filters.file) qs.set("file", filters.file);

  const suffix = qs.toString() ? `?${qs}` : "";
  const { data, meta } = await apiRequest<Finding[]>(`/runs/${runId}/findings${suffix}`);
  return { findings: data, total: meta?.total ?? data.length };
}

/** README: "cancel, which is a plain DELETE". */
export function cancelRun(runId: string): Promise<void> {
  return apiFetch<void>(`/runs/${runId}`, { method: "DELETE" });
}
