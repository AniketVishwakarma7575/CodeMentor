import type { Finding, FindingStatus, Severity } from "@/lib/types";
import { apiFetch, apiRequest } from "./client";
import { USE_FIXTURES } from "./config";
import { FINDINGS } from "@/data/findings";

/* ============================================================================
   Findings — the review screen's data.

   Mirrors codementor-backend/src/modules/findings/findings.controller.ts.
   ========================================================================== */

export interface FindingFilters {
  runId?: string;
  repoId?: string;
  severity?: Severity[];
  status?: FindingStatus[];
  file?: string;
  q?: string;
  limit?: number;
}

export interface FileSummaryRow {
  file: string;
  findings: number;
  worst: Severity;
}

function toQuery(filters: FindingFilters): string {
  const qs = new URLSearchParams();
  if (filters.runId) qs.set("runId", filters.runId);
  if (filters.repoId) qs.set("repoId", filters.repoId);
  if (filters.severity?.length) qs.set("severity", filters.severity.join(","));
  if (filters.status?.length) qs.set("status", filters.status.join(","));
  if (filters.file) qs.set("file", filters.file);
  if (filters.q) qs.set("q", filters.q);
  if (filters.limit) qs.set("limit", String(filters.limit));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* -- browser ---------------------------------------------------------------- */

export async function listFindings(
  filters: FindingFilters = {}
): Promise<{ findings: Finding[]; total: number }> {
  if (USE_FIXTURES) return { findings: FINDINGS, total: FINDINGS.length };
  const { data, meta } = await apiRequest<Finding[]>(`/findings${toQuery(filters)}`);
  return { findings: data, total: meta?.total ?? data.length };
}

/**
 * Triage a finding.
 *
 * ⚠️ This does NOT change the run's score, by design — the backend treats a
 *    score as a fact about a moment in time. The UI must not imply otherwise
 *    by optimistically recomputing one.
 */
export function setFindingStatus(
  id: string,
  status: FindingStatus,
  options: { reason?: string; snoozeUntil?: Date } = {}
): Promise<Finding> {
  return apiFetch<Finding>(`/findings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ...(options.reason ? { reason: options.reason } : {}),
      ...(options.snoozeUntil ? { snoozeUntil: options.snoozeUntil.toISOString() } : {}),
    }),
  });
}

/* -- server ----------------------------------------------------------------- */


