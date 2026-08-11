"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { isAuthError, logout as apiLogout, me, type SessionUser } from "@/lib/api/auth";

/* ============================================================================
   Who is signed in.

   ── WHY THE SESSION IS FETCHED, NOT READ ──

   The tokens live in httpOnly cookies, so this app CANNOT read them. That is
   deliberate (see `api/auth.ts`), and it means the only way to know who is
   signed in is to ask the API. `GET /auth/me` is that question.

   The upside of not being able to read the token is that this state can never
   disagree with the server. There is no locally-decoded JWT to go stale, no
   "logged in according to the client" while the account is disabled.
   ========================================================================== */

interface AuthState {
  user: SessionUser | null;
  /** True until the first `/auth/me` settles. Not the same as signed out. */
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Context = React.createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  /**
   * Resolved on the server when the page was rendered.
   *
   * Passing it avoids the flash where the shell renders signed-out, `/auth/me`
   * comes back, and everything re-renders — on every navigation.
   */
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = React.useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = React.useState(initialUser === null);
  const router = useRouter();

  const load = React.useCallback(async () => {
    try {
      setUser(await me());
    } catch (err) {
      // A 401 is the answer "nobody", not a failure. Anything else — the API
      // being down, say — leaves the previous value alone rather than
      // signing the user out because of a network blip.
      if (isAuthError(err)) setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialUser) {
      setLoading(false);
      return;
    }
    void load();
  }, [initialUser, load]);

  const signOut = React.useCallback(async () => {
    await apiLogout();
    setUser(null);
    // `replace`, not `push`: the page behind is one the user can no longer
    // see, and Back should not appear to return to it.
    router.replace("/login");
    // The App Router caches rendered segments per route. Without this, going
    // back to a page visited while signed in would serve it from cache.
    router.refresh();
  }, [router]);

  const value = React.useMemo<AuthState>(
    () => ({ user, loading, signOut, refresh: load }),
    [user, loading, signOut, load]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
