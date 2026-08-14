import { apiRequest } from "./client";

/* ============================================================================
   Branches.

   Mirrors codementor-backend/src/modules/repositories/git.service.ts.

   ── WHAT SELECTING A BRANCH DOES, AND DOES NOT DO ──

   It does NOT check the branch out in the user's folder. The backend creates a
   detached worktree in a temp directory, analyses that, and removes it — the
   working tree, the index and every uncommitted change stay exactly as they
   were. This matters for how the UI words things: this is a picker for "which
   code to analyse", never "switch my branch".

   `null` branch means the working tree as it is on disk, uncommitted edits
   included. That is the default because it is what a developer pointing a tool
   at their own folder almost always means.
   ========================================================================== */

export interface BranchInfo {
  name: string;
  /** The branch checked out in the user's working tree right now. */
  current: boolean;
  remote: boolean;
  sha: string;
  subject: string;
  committedAt: string | null;
}

export interface BranchListing {
  branches: BranchInfo[];
  /** False when git is missing or the folder is not a repository. */
  available: boolean;
  current: string | null;
}

export async function listBranches(repoId: string): Promise<BranchListing> {
  const { data, meta } = await apiRequest<BranchInfo[]>(
    `/repositories/${encodeURIComponent(repoId)}/branches`
  );
  const m = meta as unknown as { available?: boolean; current?: string | null } | undefined;
  return {
    branches: data,
    available: m?.available ?? false,
    current: m?.current ?? null,
  };
}

