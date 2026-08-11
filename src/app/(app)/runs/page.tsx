import { RunScreen } from "@/components/run/run-screen";

export const metadata = { title: "Run" };

/**
 * `?repo=<id>` names the project to analyse.
 *
 * Read here on the server rather than with `useSearchParams`, matching
 * `reviews/page.tsx` — the hook opts the whole subtree out of prerendering.
 *
 * The parameter exists because the run screen posts a run on mount, and the
 * stored active project is a per-machine preference, not an instruction. When
 * the user says "analyse THIS repository" the id belongs in the URL, where it
 * cannot go stale: without it, a mount carrying a leftover selection silently
 * analyses the previous project and reports a score under its name.
 *
 * Still optional. The sidebar and the command palette link here with no repo,
 * meaning "the project I am working in" — that is what the fallback is for.
 */
export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string; branch?: string }>;
}) {
  const { repo, branch } = await searchParams;
  return <RunScreen repoId={repo ?? null} branch={branch ?? null} />;
}
