"use client";

import * as React from "react";

/* ============================================================================
   Which branch of the active project to analyse.

   Stored per repository, so switching projects does not carry a branch name
   across to a repo that has never heard of it — "feat/invoice-pdf" selected on
   one project would otherwise fail every run on the next.

   `null` means the working tree as it is on disk, including uncommitted
   changes. That is the default and the common case: this tool is pointed at
   the folder you are working in, and the code you are editing is the code you
   usually want checked.
   ========================================================================== */

const KEY = "codementor.activeBranch";

type Stored = Record<string, string>;

function read(): Stored {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Stored) : {};
  } catch {
    // Private mode, or a value some earlier version wrote in another shape.
    // Working with no selection is a supported state, so there is nothing to
    // recover — and throwing here would take down whatever rendered the hook.
    return {};
  }
}

export function useActiveBranch(
  repoId: string | null
): [string | null, (branch: string | null) => void] {
  // Always starts null so the server and the first client render agree.
  const [branch, setBranch] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!repoId) {
      setBranch(null);
      return;
    }
    setBranch(read()[repoId] ?? null);
  }, [repoId]);

  const select = React.useCallback(
    (next: string | null) => {
      setBranch(next);
      if (!repoId) return;
      try {
        const all = read();
        if (next === null) delete all[repoId];
        else all[repoId] = next;
        window.localStorage.setItem(KEY, JSON.stringify(all));
      } catch {
        // Selection still applies for this session.
      }
    },
    [repoId]
  );

  return [branch, select];
}

export function resetActiveBranches(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Branch choice is a convenience. If storage is unavailable, there is no
    // persisted value to clear.
  }
}
