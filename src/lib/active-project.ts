"use client";

import * as React from "react";

/* ============================================================================
   Which project the app is currently working in.

   localStorage, not a cookie or the URL: the choice is a per-machine
   preference, it must survive a refresh, and it is never needed during server
   rendering. A cookie would be sent on every request for no reason.

   ── WHY THE STATE IS MODULE-LEVEL ──

   localStorage is shared but `useState` is not. With per-hook state, the
   repositories page calling `select(id)` wrote storage and re-rendered ITSELF,
   while the top bar, nav rail and command palette kept the value they read at
   mount — six independent copies that only agreed on a fresh page load. The
   subscriber set below makes one `select` reach all of them.
   ========================================================================== */

const KEY = "codementor.activeProjectId";

// Always starts null so the server and the first client render agree. Reading
// localStorage eagerly would hydrate-mismatch whenever a value is stored.
let activeId: string | null = null;
let hydrated = false;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): string | null => activeId;
const getServerSnapshot = (): string | null => null;

function emit(): void {
  for (const listener of listeners) listener();
}

export function useActiveProject(): [string | null, (id: string | null) => void] {
  const id = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    if (hydrated) return;
    hydrated = true;
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored !== activeId) {
        activeId = stored;
        emit();
      }
    } catch {
      // Private mode, or storage disabled. Working with no active project is a
      // supported state, so there is nothing to recover from.
    }
  }, []);

  return [id, selectProject];
}

export function selectProject(next: string | null): void {
  if (next !== activeId) {
    activeId = next;
    emit();
  }
  try {
    if (next === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // Selection still applies for this session.
  }
}

export function resetActiveProject(): void {
  hydrated = false;
  selectProject(null);
}
