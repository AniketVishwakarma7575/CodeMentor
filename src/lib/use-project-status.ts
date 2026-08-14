"use client";

import * as React from "react";
import { type RepositorySummary } from "@/lib/api/repositories";
import { latestRun, type RunDetail } from "@/lib/api/runs";
import { useActiveProject, selectProject } from "@/lib/active-project";
import { useRepositories } from "@/lib/repositories-store";
import { USE_FIXTURES } from "@/lib/api/config";

/* ============================================================================
   The shell's view of the active project: which repository, and how its last
   analysis went.

   Lives here rather than in the top bar because the shell is not the only
   consumer — anything chrome-level that names the current project needs the
   same two reads, and duplicating them would mean two requests and two
   answers that can disagree mid-render.

   That promise is kept by the two stores this hook composes, NOT by the hook
   itself: it has three call sites in the shell alone, so anything held in
   `useState` here is three copies and three requests. The repository list
   lives in `repositories-store`, the selection in `active-project`, and the
   latest run in the small store below.

   ── WHY `null` IS A REAL ANSWER ──

   `repo: null` means no project is selected, and `run: null` means it has
   never been analysed. Neither is an error, and neither should be papered
   over: the shell renders nothing in those states rather than a placeholder,
   because a top bar that always shows a repository name teaches the user to
   read it as decoration.
   ========================================================================== */

export interface ProjectStatus {
  repo: RepositorySummary | null;
  run: RunDetail | null;
  repos: RepositorySummary[];
  loading: boolean;
  select: (id: string | null) => void;
}

/* -- the latest run, shared ------------------------------------------------- */

/** The run, and the project it belongs to — kept together so a stale repo's
 *  run can never be rendered under a newly selected project's name. */
let runState: { repoId: string | null; run: RunDetail | null } = { repoId: null, run: null };

const runListeners = new Set<() => void>();
let runInflight: string | null = null;

function subscribeRun(listener: () => void): () => void {
  runListeners.add(listener);
  return () => {
    runListeners.delete(listener);
  };
}

const getRunSnapshot = () => runState;
const SERVER_RUN: typeof runState = { repoId: null, run: null };
const getServerRunSnapshot = () => SERVER_RUN;

function setRunState(repoId: string | null, run: RunDetail | null): void {
  runState = { repoId, run };
  for (const listener of runListeners) listener();
}

export function resetProjectStatus(): void {
  runInflight = null;
  setRunState(null, null);
}

export function useProjectStatus(): ProjectStatus {
  const [activeProjectId] = useActiveProject();
  const { repos, loading, error } = useRepositories();
  const runSnapshot = React.useSyncExternalStore(
    subscribeRun,
    getRunSnapshot,
    getServerRunSnapshot
  );

  React.useEffect(() => {
    if (loading || error || !activeProjectId) return;
    if (!repos.some((r) => r.id === activeProjectId)) selectProject(null);
  }, [activeProjectId, error, loading, repos]);

  React.useEffect(() => {
    if (USE_FIXTURES) return;

    if (!activeProjectId) {
      if (runState.repoId !== null || runState.run !== null) setRunState(null, null);
      return;
    }

    // Already have it, or already asking for it. Without these two guards the
    // three shell consumers would each fire the same request on every mount.
    if (runState.repoId === activeProjectId || runInflight === activeProjectId) return;

    runInflight = activeProjectId;
    void latestRun(activeProjectId)
      .then((r) => {
        // The user may have switched projects while this was in flight; that
        // newer selection has its own fetch and must not be overwritten.
        if (runInflight === activeProjectId) setRunState(activeProjectId, r);
      })
      .catch(() => {
        if (runInflight === activeProjectId) setRunState(activeProjectId, null);
      })
      .finally(() => {
        if (runInflight === activeProjectId) runInflight = null;
      });
  }, [activeProjectId]);

  const repo = React.useMemo(
    () => repos.find((r) => r.id === activeProjectId) ?? null,
    [repos, activeProjectId]
  );

  // Only this project's run. While a switch is in flight the previous
  // project's run is still in the store, and showing it would attribute one
  // project's score to another.
  const run = runSnapshot.repoId === activeProjectId ? runSnapshot.run : null;

  return { repo, run, repos, loading, select: selectProject };
}
