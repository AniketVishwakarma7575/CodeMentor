import "server-only";

import type { Finding } from "@/lib/types";
import type { BranchInfo } from "./branches";
import type { EngineInfo } from "./engines";
import type { InsightsOverview } from "./insights";
import type { Concept } from "@/lib/types";
import type { RepositorySummary } from "./repositories";
import type { RunDetail } from "./runs";
import type { ActiveSession, SessionUser } from "./auth";
import type { FindingFilters } from "./findings";
import { serverFetch } from "./server";

/* ============================================================================
   Every server-side read, in one module.

   ── WHY THEY ARE NOT NEXT TO THEIR CLIENT COUNTERPARTS ──

   `serverFetch` imports `next/headers`, which is how it forwards the session
   cookie. Next refuses to bundle that into a client component — and a module
   is pulled into the client bundle if ANY client component imports ANYTHING
   from it. `runs.ts` exports `createRun` (used by the run screen) alongside
   `getRunServer`, so keeping both in one file drags `next/headers` into the
   browser build and the compile fails outright:

     You're importing a component that needs "next/headers".

   Splitting by RUNTIME rather than by resource is what fixes it. `import
   "server-only"` at the top makes the mistake loud: importing this from a
   client component is a build error naming this file, instead of a confusing
   one naming a Next.js internal.

   The `type` imports are safe in both directions — types are erased, so they
   carry no runtime dependency.
   ========================================================================== */

/* -- session ---------------------------------------------------------------- */

export function currentUserServer(): Promise<SessionUser | null> {
  return serverFetch<SessionUser>("/auth/me");
}

/**
 * Live sessions for the account screen.
 *
 * Fetched on the server so the list is already there on first paint — this is
 * a security surface, and a spinner where "which devices can reach my account"
 * belongs is the wrong first impression. Null when the API did not answer, and
 * the screen says so rather than rendering an empty list, which would read as
 * "no other devices".
 */
export function sessionsServer(): Promise<ActiveSession[] | null> {
  return serverFetch<ActiveSession[]>("/auth/sessions");
}

/* -- repositories ----------------------------------------------------------- */

/**
 * One repository, for server components that need its identity.
 *
 * The backend has no `GET /repositories/:id` that takes a name, so this filters
 * the list. Cheap — one document per connected folder.
 */
export async function repositoryServer(id: string): Promise<RepositorySummary | null> {
  const all = await serverFetch<RepositorySummary[]>("/repositories");
  return all?.find((r) => r.id === id) ?? null;
}

export function branchesServer(repoId: string): Promise<BranchInfo[] | null> {
  return serverFetch<BranchInfo[]>(`/repositories/${encodeURIComponent(repoId)}/branches`);
}

/* -- runs ------------------------------------------------------------------- */

export function latestRunServer(repoId: string): Promise<RunDetail | null> {
  return serverFetch<RunDetail>(`/runs/latest?repoId=${encodeURIComponent(repoId)}`);
}

export function getRunServer(runId: string): Promise<RunDetail | null> {
  return serverFetch<RunDetail>(`/runs/${encodeURIComponent(runId)}`);
}

/* -- findings --------------------------------------------------------------- */

export function listFindingsServer(filters: FindingFilters = {}): Promise<Finding[] | null> {
  const qs = new URLSearchParams();
  if (filters.runId) qs.set("runId", filters.runId);
  if (filters.repoId) qs.set("repoId", filters.repoId);
  if (filters.severity?.length) qs.set("severity", filters.severity.join(","));
  if (filters.status?.length) qs.set("status", filters.status.join(","));
  if (filters.file) qs.set("file", filters.file);
  if (filters.q) qs.set("q", filters.q);
  if (filters.limit) qs.set("limit", String(filters.limit));
  const s = qs.toString();
  return serverFetch<Finding[]>(`/findings${s ? `?${s}` : ""}`);
}

/* -- insights, learning, engines -------------------------------------------- */

export function insightsOverviewServer(repoId: string): Promise<InsightsOverview | null> {
  return serverFetch<InsightsOverview>(`/insights?repoId=${encodeURIComponent(repoId)}`);
}

export function conceptsServer(): Promise<Concept[] | null> {
  return serverFetch<Concept[]>("/learning");
}

export function conceptServer(id: string): Promise<Concept | null> {
  return serverFetch<Concept>(`/learning/${encodeURIComponent(id)}`);
}

export function skillSignalsServer(
  repoId: string
): Promise<import("./learning").SkillSignal[] | null> {
  return serverFetch<import("./learning").SkillSignal[]>(
    `/learning/signals?repoId=${encodeURIComponent(repoId)}`
  );
}

export function enginesServer(): Promise<EngineInfo[] | null> {
  return serverFetch<EngineInfo[]>("/engines");
}
