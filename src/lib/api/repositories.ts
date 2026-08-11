import { apiFetch, apiRequest } from "./client";
import { USE_FIXTURES } from "./config";

/* ============================================================================
   Repositories — connected projects, local and hosted.

   Mirrors codementor-backend/src/modules/repositories/repositories.service.ts.
   A local folder and a GitHub repo are the SAME shape on purpose: no screen in
   this app should branch on `provider` to decide how to draw a row.
   ========================================================================== */

export type RepoProvider = "github" | "gitlab" | "bitbucket" | "local";

export interface RepositorySummary {
  id: string;
  provider: RepoProvider;
  name: string;
  branch: string;
  /** Null until scanned. Render "—", never 0 — they mean different things. */
  loc: number | null;
  files: number | null;
  language: string | null;
  /** The scan hit its file ceiling; the counts are a floor, not a total. */
  truncated: boolean;
  /** Null until a run has scored it. */
  score: number | null;
  findings: number | null;
  gate: "passed" | "failed" | null;
  localPath: string | null;
  /** False for a folder connected on a different machine. */
  available: boolean;
  scannedAt: string | null;
  connectedAt: string;
}

export interface DirEntry {
  name: string;
  path: string;
  isRepo: boolean;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: DirEntry[];
  roots: string[];
}

/* -- fixtures --------------------------------------------------------------- */

/**
 * The five `acme/*` rows that used to be hardcoded in the page.
 *
 * Kept, not deleted — they are the offline/design mode the rest of the app
 * already has via USE_FIXTURES, and this screen should not be the one place
 * that goes blank when the backend is down.
 */
export const FIXTURE_REPOS: RepositorySummary[] = [
  { name: "acme/checkout-service", branch: "feat/order-search", score: 34, findings: 8, loc: 48219, gate: "failed" },
  { name: "acme/identity", branch: "main", score: 88, findings: 3, loc: 22140, gate: "passed" },
  { name: "acme/pricing-engine", branch: "main", score: 71, findings: 11, loc: 61903, gate: "passed" },
  { name: "acme/web-storefront", branch: "release/24.11", score: 63, findings: 24, loc: 118442, gate: "failed" },
  { name: "acme/internal-tools", branch: "main", score: 92, findings: 1, loc: 9317, gate: "passed" },
].map((r, i) => ({
  ...r,
  id: `fixture-${i}`,
  provider: "github" as const,
  files: null,
  language: "javascript",
  truncated: false,
  gate: r.gate as "passed" | "failed",
  localPath: null,
  available: true,
  scannedAt: null,
  connectedAt: new Date().toISOString(),
}));

/* -- fetchers --------------------------------------------------------------- */

export async function listRepositories(): Promise<RepositorySummary[]> {
  if (USE_FIXTURES) return FIXTURE_REPOS;
  const { data } = await apiRequest<RepositorySummary[]>("/repositories");
  return data;
}

/**
 * Enumerate sub-directories of `path` (or the home directory when omitted).
 *
 * The server does this, not the browser: `<input type="file" webkitdirectory>`
 * yields relative names and a sandboxed handle, never `D:\projects\thing`, and
 * an absolute path is exactly what the backend needs. The API runs on the same
 * machine, so it can read the real filesystem — which is also why the endpoint
 * is loopback-only.
 */
export function browseLocal(path?: string): Promise<BrowseResult> {
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  return apiFetch<BrowseResult>(`/repositories/local/browse${qs}`);
}

export function connectLocalFolder(path: string, displayName?: string): Promise<RepositorySummary> {
  return apiFetch<RepositorySummary>("/repositories/local", {
    method: "POST",
    body: JSON.stringify({ path, ...(displayName ? { displayName } : {}) }),
    // A cold folder walk is bounded server-side at 20s. Allow for it.
    timeoutMs: 30_000,
  });
}

export function rescanRepository(id: string): Promise<RepositorySummary> {
  return apiFetch<RepositorySummary>(`/repositories/${id}/rescan`, {
    method: "POST",
    timeoutMs: 30_000,
  });
}

/** Removes the CONNECTION. The folder on disk is never touched. */
export function disconnectRepository(id: string): Promise<void> {
  return apiFetch<void>(`/repositories/${id}`, { method: "DELETE" });
}
