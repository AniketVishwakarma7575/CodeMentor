import { RepositoriesClient } from "./repositories-client";

export const metadata = { title: "Repositories" };

/**
 * Server shell only.
 *
 * The list itself is client-rendered: it reads localStorage for the active
 * project and mutates on connect / rescan / disconnect, none of which survives
 * a server component. Fetching on the server would also send the request from
 * the Next process rather than the browser, and the local-folder endpoints are
 * loopback-scoped — same machine, but a different caller than intended.
 *
 * The five hardcoded `acme/*` rows that used to live here now sit in
 * lib/api/repositories.ts as FIXTURE_REPOS, behind NEXT_PUBLIC_USE_FIXTURES.
 */
export default function RepositoriesPage() {
  return <RepositoriesClient />;
}
