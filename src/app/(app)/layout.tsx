import { AppShell } from "@/components/shell/app-shell";
import { AuthProvider } from "@/lib/auth-context";
import { currentUserServer as currentUser } from "@/lib/api/server-fetchers";

/**
 * Every screen behind the wall.
 *
 * The session is resolved HERE, on the server, and handed to the provider as
 * its initial value. The alternative — letting the client fetch `/auth/me` on
 * mount — renders the whole shell signed-out for one frame on every cold load,
 * which reads as a flicker in the account menu and the project switcher.
 *
 * The middleware has already redirected anyone without a session cookie, so
 * `user` being null here means the cookie exists but the API disagreed: an
 * expired access token the client will silently refresh, or a backend that is
 * down. Neither should blank the page, so the shell renders either way.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <AuthProvider initialUser={user}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
