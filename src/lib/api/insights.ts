import type { Dimension, QualityGate } from "@/lib/types";
import { apiFetch } from "./client";

/* ============================================================================
   Insights — the dashboard, in one round-trip.

   Mirrors codementor-backend/src/modules/insights/insights.service.ts.

   One endpoint, not five, and the client keeps it that way: score, gate, trend
   and offenders are one reading of one run. Five requests would produce five
   loading states finishing at different times, which reads as jank rather than
   as progress.

   ── WHAT THIS TYPE DOES NOT HAVE ──

   No `coverage`, and no standalone `duplication`. The backend does not measure
   either yet (`orchestrator.service.ts` passes `coverage: null` into the gate
   and hardcodes duplication to 0), so there is no field to read. The dashboard
   renders those tiles as "not measured" rather than inventing a number — see
   the note on `Stat` in the insights page.
   ========================================================================== */

export interface TrendPoint {
  runId: string;
  /** "c01", "c02" — a run's position in the window, not a commit sha. */
  commit: string;
  sha: string;
  score: number;
  idx: number;
  createdAt: string;
}

export interface SeverityTrendPoint {
  idx: number;
  commit: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface TopOffender {
  path: string;
  findings: number;
  critical: number;
  /** Remediation minutes, summed over the file's findings. */
  debt: number;
  trend: "better" | "flat" | "worse";
}

export interface InsightsOverview {
  score: number | null;
  rating: string | null;
  /** Against the PREVIOUS run, not against a branch. 0 on a first analysis. */
  delta: number;
  gate: QualityGate | null;
  dimensions: Dimension[];
  debtMinutes: number | null;
  debtRatio: number | null;
  loc: number | null;
  findingCounts: Record<string, number>;
  trend: TrendPoint[];
  severityTrend: SeverityTrendPoint[];
  topOffenders: TopOffender[];
  /** Null when the repo has never been analysed — the page shows an empty state. */
  latestRunId: string | null;
}

/* -- browser ---------------------------------------------------------------- */

export function insightsOverview(repoId: string): Promise<InsightsOverview> {
  return apiFetch<InsightsOverview>(`/insights?repoId=${encodeURIComponent(repoId)}`);
}

