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
 *
 * ⚠️ It also is NOT how a fix gets applied. Sending `status: "applied"` here
 *    records a claim and touches no file — that is exactly the bug this pair of
 *    functions was split to prevent. Use `applyFinding` below, which writes the
 *    patch first and sets the status only once the write succeeded.
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

/**
 * Apply a finding's patch to the file on disk.
 *
 * The server anchors the patch against the file's current bytes and refuses if
 * anything moved, so the failure modes are informative rather than mysterious:
 *
 *   VERIFICATION_FAILED  the patch was already tried on a copy and rejected
 *   PATCH_DRIFTED        the file changed since the analysis — re-run it
 *   NO_FIX_AVAILABLE     the rule had no honest patch to offer
 *
 * Every one arrives as an `ApiError` whose `message` is written for the reader,
 * so surface it verbatim rather than substituting "something went wrong".
 */
export function applyFinding(id: string): Promise<Finding> {
  return apiFetch<Finding>(`/findings/${id}/apply`, { method: "POST" });
}

/* -- server ----------------------------------------------------------------- */


