import { API_BASE } from "./config";
import { ApiError, apiFetch } from "./client";

/* ============================================================================
   Sessions.

   Mirrors codementor-backend/src/modules/auth/accounts.controller.ts.

   ── NOTHING IS STORED IN localStorage ──

   The backend sets httpOnly cookies, which JavaScript cannot read at all. That
   is the whole point: a cross-site script that reaches this page can call the
   API as the user (the cookie rides along) but cannot EXFILTRATE the session
   to somewhere it keeps working after the tab closes.

   Putting the token in localStorage would trade that for nothing — the app
   would gain no capability it does not already have, and any injected script
   could read the token and replay it from anywhere.

   So every request here sends `credentials: "include"` and no Authorization
   header. The tokens in the response body exist for non-browser callers.
   ========================================================================== */

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  orgId: string;
  orgName: string;
}

interface SessionResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Create an account.
 *
 * ⚠️ Returns the created user and NO session — registering does not sign you
 *    in. The flow is register → sign in, and the backend sets no cookies here,
 *    so a caller that treats this like `login` will find itself signed out on
 *    the very next request.
 */
export function register(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<SessionUser> {
  return apiFetch<SessionUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { email: string; password: string }): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function me(): Promise<SessionUser> {
  return apiFetch<SessionUser>("/auth/me");
}

/**
 * Sign out.
 *
 * Never throws. A failed sign-out that surfaces an error leaves the user
 * looking at a page they believe they have left — clearing the client's idea
 * of the session matters more than the server's acknowledgement, and the
 * endpoint is a 204 whatever happens.
 */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>("/auth/logout", { method: "POST", body: "{}" });
  } catch {
    /* Already gone, or the API is down. Either way the client signs out. */
  }
}

/* -- account --------------------------------------------------------------- */

/**
 * Change the password while signed in.
 *
 * Returns a fresh session because the server revokes every existing one,
 * including this browser's — the new cookies arrive on the response, so the
 * caller does not need to sign in again.
 */
export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/auth/password/change", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Ask for a reset link.
 *
 * ⚠️ Resolves for ANY address, including ones with no account. That is the
 *    server's contract, not an oversight, and the UI must not undo it by
 *    reporting "no account with that email" — the endpoint is unauthenticated,
 *    so a response that differed would be a free membership oracle.
 */
export function forgotPassword(email: string): Promise<void> {
  return apiFetch<void>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Redeem a reset link. No session comes back — the user signs in after. */
export function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  return apiFetch<void>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Change the display name, the email, or both. Email changes need the password. */
export function updateProfile(input: {
  displayName?: string | null;
  email?: string;
  password?: string;
}): Promise<SessionUser> {
  return apiFetch<SessionUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Close the account. Irreversible from the UI, so the server demands a password. */
export function deleteAccount(password: string): Promise<void> {
  return apiFetch<void>("/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

/* -- sessions ---------------------------------------------------------------- */

export interface ActiveSession {
  id: string;
  /** Raw user-agent. Diagnostic — never trusted, and summarised for display. */
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  /** The session making the request. The UI must not offer to end it. */
  current: boolean;
}

export function listSessions(): Promise<ActiveSession[]> {
  return apiFetch<ActiveSession[]>("/auth/sessions");
}

export function revokeSession(id: string): Promise<void> {
  return apiFetch<void>(`/auth/sessions/${id}`, { method: "DELETE" });
}

export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return apiFetch<{ revoked: number }>("/auth/sessions", { method: "DELETE" });
}

/* -- silent refresh ---------------------------------------------------------- */

/**
 * Exchange the refresh cookie for a new access cookie.
 *
 * ⚠️ Uses `fetch` directly rather than `apiFetch`, because `apiFetch` is what
 *    calls THIS on a 401. Routing it back through would recurse: refresh 401s,
 *    which triggers a refresh, which 401s.
 *
 * Returns false when there is no usable session, which is the signal for the
 * caller to send the user to /login.
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * One in-flight refresh at a time.
 *
 * ⚠️ THIS SHARED PROMISE IS LOad-BEARING. When an access token expires, every
 *    request in flight 401s at once — a dashboard can fire five. Without
 *    coalescing, all five call /auth/refresh, and because refresh tokens
 *    ROTATE, the first response invalidates the token the other four are
 *    using. The backend reads those as replay, revokes every session, and the
 *    user is thrown out mid-page-load.
 *
 *    So the first caller starts the refresh and the rest await the same
 *    promise.
 */
let inFlight: Promise<boolean> | null = null;

export function refreshOnce(): Promise<boolean> {
  inFlight ??= refreshSession().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** True when an error means "your session is gone", not "something broke". */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}
