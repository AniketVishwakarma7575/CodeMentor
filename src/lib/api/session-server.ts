import { serverFetch } from "./server";
import type { SessionUser } from "./auth";

/* ============================================================================
   The signed-in user, resolved during server rendering.

   A thin wrapper over `serverFetch`, which forwards the request's cookies —
   see the note there about why that is load-bearing. This used to carry its
   own copy of that logic, which is how `serverFetch` went un-fixed: one of the
   two paths worked, so the session looked fine while every data fetch on the
   same page came back empty.

   `null` means "render signed out". The middleware has already turned away
   anyone with no session cookie at all, so reaching here with null means the
   access token expired — which only the client can refresh, and does.
   ========================================================================== */

export async function currentUser(): Promise<SessionUser | null> {
  return serverFetch<SessionUser>("/auth/me");
}
