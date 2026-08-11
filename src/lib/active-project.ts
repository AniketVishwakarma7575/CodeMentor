"use client";

import * as React from "react";

/* ============================================================================
   Which project the app is currently working in.

   localStorage, not a cookie or the URL: the choice is a per-machine
   preference, it must survive a refresh, and it is never needed during server
   rendering. A cookie would be sent on every request for no reason.
   ========================================================================== */

const KEY = "codementor.activeProjectId";

export function useActiveProject(): [string | null, (id: string | null) => void] {
  // Always starts null so the server and the first client render agree.
  // Reading localStorage during render would hydrate-mismatch every time the
  // stored value is not null.
  const [id, setId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      setId(window.localStorage.getItem(KEY));
    } catch {
      // Private mode, or storage disabled. Working with no active project is a
      // supported state, so there is nothing to recover from.
    }
  }, []);

  const select = React.useCallback((next: string | null) => {
    setId(next);
    try {
      if (next === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // Selection still applies for this session.
    }
  }, []);

  return [id, select];
}
