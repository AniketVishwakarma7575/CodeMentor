import { NextResponse, type NextRequest } from "next/server";

/* ============================================================================
   Route protection.

   ── WHAT THIS IS, AND WHAT IT IS NOT ──

   This is a REDIRECT, not a security boundary. It checks for the presence of a
   session cookie and nothing more: it does not verify the signature, because
   the signing key belongs to the API and putting a copy in the Next.js runtime
   would be a second place to leak it from.

   The real authorization happens in the API, on every request, where the token
   is actually verified. Someone who forges a cookie value gets past this
   middleware and then gets a 401 from every piece of data on the page.

   What it buys is the thing an API check cannot: not rendering a whole
   application shell to someone who is signed out, and sending them somewhere
   useful with `?next=` so they land back where they were aiming.
   ========================================================================== */

const ACCESS_COOKIE = "cm_access";
const REFRESH_COOKIE = "cm_refresh";

/**
 * Reachable signed out. Everything else requires a session.
 *
 * ⚠️ The two password routes MUST be here. Someone who cannot sign in is
 *    exactly who needs them, so gating them behind a session would redirect the
 *    user to the sign-in page they came from because they could not sign in.
 */
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

/**
 * Public paths a SIGNED-IN user is still allowed to open.
 *
 * The redirect below normally bounces an authenticated visitor away from the
 * auth screens, which is right for /login. It is wrong for /reset-password:
 * someone with a live session in one tab may be following a reset link they
 * requested precisely because they think that session belongs to someone else.
 * Bouncing them into the app would make the link unusable for the one person
 * who most needs it.
 */
const PUBLIC_EVEN_WHEN_SIGNED_IN = ["/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ⚠️ The ACCESS cookie expires every 15 minutes while the session is still
  //    perfectly valid — the refresh cookie is the one that says "this person
  //    has a session". Redirecting on a missing access cookie alone would
  //    bounce users to /login every quarter of an hour, and the client's silent
  //    refresh would never get the chance to run.
  const hasSession =
    request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) {
    const alwaysAllowed = PUBLIC_EVEN_WHEN_SIGNED_IN.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    // Already signed in and heading for the sign-in page — send them to the app
    // rather than showing a form that would immediately redirect anyway.
    if (hasSession && !alwaysAllowed) {
      return NextResponse.redirect(new URL("/repositories", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    // Carry the destination so the user lands where they meant to go. Read
    // back through `safeNext` in the form, which rejects anything off-origin.
    url.searchParams.set("next", `${pathname}${search}`);
    url.searchParams.set("reason", "required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's own assets and the public report route.
   *
   * `/report/:id` is deliberately outside the wall — it is the shareable
   * artefact, meant to be opened by someone who does not have an account. It
   * is also why that route takes an unguessable run id rather than a
   * sequential one.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|report|tokens|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)"],
};
