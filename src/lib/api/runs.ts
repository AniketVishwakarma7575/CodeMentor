import type { Dimension, QualityGate, RunStage } from "@/lib/types";
import { apiFetch } from "./client";
import { serverFetch } from "./server";

/* ============================================================================
   Runs.

   Mirrors codementor-backend/src/modules/runs/runs.controller.ts.

   Findings moved to ./findings.ts: the backend serves them from /findings as
   their own resource, not from under a run, because the review screen filters
   them by repository and file as often as by run.
   ========================================================================== */

export interface CreateRunResponse {
  runId: string;
  status: "running" | "queued";
  mode: "snippet" | "local" | "repo";
  eventsUrl: string;
}

export type CreateRunBody =
  | { mode: "local"; repoId: string }
  | { mode: "repo"; repoId: string; branch?: string; commitSha?: string }
  | { mode: "snippet"; source: string; language?: string; filename?: string };

export interface RunDetail {
  id: string;
  repoId: string;
  status: "queued" | "running" | "complete" | "failed" | "cancelled";
  branch: string;
  commitSha: string;
  stages: RunStage[];
  score: number | null;
  rating: string | null;
  gate: QualityGate | null;
  dimensions: Dimension[];
  debtMinutes: number | null;
  debtRatio: number | null;
  coverage: number | null;
  duplication: number | null;
  loc: number | null;
  findingCounts: Record<string, number>;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

/* -- browser ---------------------------------------------------------------- */

export function createRun(body: CreateRunBody): Promise<CreateRunResponse> {
  return apiFetch<CreateRunResponse>("/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getRun(runId: string): Promise<RunDetail> {
  return apiFetch<RunDetail>(`/runs/${runId}`);
}

export function listRuns(repoId?: string): Promise<RunDetail[]> {
  const qs = repoId ? `?repoId=${encodeURIComponent(repoId)}` : "";
  return apiFetch<RunDetail[]>(`/runs${qs}`);
}

/** Newest run for a repository, or null if it has never been analysed. */
export function latestRun(repoId: string): Promise<RunDetail | null> {
  return apiFetch<RunDetail | null>(`/runs/latest?repoId=${encodeURIComponent(repoId)}`);
}

/** Cancel. A plain DELETE, per the SSE contract's one-directional design. */
export function cancelRun(runId: string): Promise<void> {
  return apiFetch<void>(`/runs/${runId}`, { method: "DELETE" });
}

/* -- server ----------------------------------------------------------------- */

export function latestRunServer(repoId: string): Promise<RunDetail | null> {
  return serverFetch<RunDetail>(`/runs/latest?repoId=${encodeURIComponent(repoId)}`);
}

export function getRunServer(runId: string): Promise<RunDetail | null> {
  return serverFetch<RunDetail>(`/runs/${runId}`);
}
