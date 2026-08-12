"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/client";
import { listRepositories, type RepositorySummary } from "@/lib/api/repositories";

/* ============================================================================
   The connected repositories, once, for the whole app.

   ── WHY A MODULE-LEVEL STORE AND NOT A HOOK-LOCAL `useState` ──

   The list has two kinds of reader that must never disagree: the screen that
   EDITS it (the repositories page connects and disconnects folders) and the
   chrome that DISPLAYS it (the top bar's project switcher, the nav rail).
   With per-hook state, connecting a folder updated the editing screen's copy
   and left every other copy holding the list as it was at page load — the new
   project simply did not appear in the switcher until a full reload.

   It also meant one `GET /repositories` per hook consumer. `useProjectStatus`
   alone has three call sites in the shell, so every navigation issued three
   identical requests whose three answers could resolve in any order.

   One store, one fetch, one answer. Mutations are applied here so that every
   subscriber re-renders together.
   ========================================================================== */

export interface RepositoriesState {
  repos: RepositorySummary[];
  /** True until the first fetch settles — distinct from "loaded and empty". */
  loading: boolean;
  error: string | null;
}

let state: RepositoriesState = { repos: [], loading: true, error: null };

const listeners = new Set<() => void>();

/** In-flight fetch, so concurrent mounts share one request. */
let inflight: Promise<void> | null = null;
/** Has a fetch ever settled? Guards the mount-triggered load from repeating. */
let loaded = false;

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * Replace the state object.
 *
 * A NEW object every time, deliberately: `useSyncExternalStore` compares
 * snapshots by identity, and mutating in place would render nothing.
 */
function set(next: Partial<RepositoriesState>): void {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): RepositoriesState => state;

// Stable identity, or React re-renders forever during hydration.
const SERVER_SNAPSHOT: RepositoriesState = { repos: [], loading: true, error: null };
const getServerSnapshot = (): RepositoriesState => SERVER_SNAPSHOT;

/* -- reads ------------------------------------------------------------------ */

/**
 * Subscribe to the repository list, fetching it once on first use.
 *
 * `refresh` forces a round-trip. Nothing in the normal flow needs it — the
 * mutation helpers below keep the store correct without one — but the
 * repositories page offers a Retry after a failed load.
 */
export function useRepositories(): RepositoriesState & { refresh: () => Promise<void> } {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    if (!loaded) void loadRepositories();
  }, []);

  const refresh = React.useCallback(() => loadRepositories({ force: true }), []);

  return { ...snapshot, refresh };
}

export function loadRepositories(options?: { force?: boolean }): Promise<void> {
  if (inflight && !options?.force) return inflight;

  if (options?.force && !state.loading) set({ loading: true, error: null });

  const chain: Promise<void> = listRepositories()
    .then((all) => {
      set({ repos: all, loading: false, error: null });
    })
    .catch((err: unknown) => {
      // The list stays as it was. Dropping it to empty on a transient failure
      // would make the switcher claim the user has no projects.
      set({
        loading: false,
        error: err instanceof ApiError ? err.message : "Could not load repositories.",
      });
    })
    .finally(() => {
      loaded = true;
      if (inflight === chain) inflight = null;
    });

  inflight = chain;
  return chain;
}

/* -- writes ----------------------------------------------------------------- */

/**
 * Insert a newly connected repository, or replace one that was rescanned.
 *
 * Applied locally rather than by refetching: the POST/rescan response is
 * authoritative, and a round-trip here would make the row appear a beat late.
 */
export function upsertRepository(repo: RepositorySummary): void {
  const index = state.repos.findIndex((r) => r.id === repo.id);
  if (index === -1) {
    set({ repos: [repo, ...state.repos], loading: false });
    return;
  }
  const repos = [...state.repos];
  repos[index] = repo;
  set({ repos });
}

export function removeRepository(id: string): void {
  set({ repos: state.repos.filter((r) => r.id !== id) });
}

export function resetRepositories(): void {
  state = { repos: [], loading: true, error: null };
  inflight = null;
  loaded = false;
  emit();
}
