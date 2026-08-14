import Link from "next/link";
import { FileSearch } from "lucide-react";
import { tokenizeCode } from "@/lib/highlight";
import { ORDERS_SOURCE } from "@/data/source";
import { FINDINGS } from "@/data/findings";
import { USE_FIXTURES } from "@/lib/api/config";
import { loadReviewData } from "@/lib/api/review-data";
import type { Finding } from "@/lib/types";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { Button } from "@/components/ui/primitives";

export const metadata = { title: "Review" };

/**
 * Server component. All syntax highlighting happens here, once, and the client
 * receives plain token arrays — Shiki never enters the browser bundle.
 *
 * The repository, file, and selected finding are read from `searchParams` on
 * the server rather than with `useSearchParams` in the workspace. That matters:
 * the hook opts the whole subtree out of prerendering, which would mean this
 * screen — the one that has to feel instant — shipping a skeleton on every cold
 * load and painting the code only after hydration.
 *
 * `?repo=<id>` is what makes the screen real. Without it (or with
 * NEXT_PUBLIC_USE_FIXTURES=true) it renders the designed sample review, which
 * is the offline and design mode the rest of the app already has.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ finding?: string; file?: string; repo?: string }>;
}) {
  const { finding, file, repo } = await searchParams;

  if (!repo && !USE_FIXTURES) return <NoProjectSelected />;

  if (repo && !USE_FIXTURES) {
    const data = await loadReviewData(repo, file);
    if (!data) return <NotAnalysedYet repoId={repo} />;

    const sourceTokens = await tokenizeCode(data.file.content, data.file.language);
    const fixTokens = await tokenizeFixes(data.findings);

    return (
      <ReviewWorkspace
        sourceTokens={sourceTokens}
        sourceFile={data.file.path}
        sourceUnavailable={data.fileUnavailable}
        fixTokens={fixTokens}
        initialFinding={finding ?? null}
        initialFile={data.file.path}
        subject={{
          repoId: data.repoId,
          findings: data.findings,
          fileTree: data.fileTree,
          loc: data.file.lines,
          // Every file in the folder, not just the ones with findings — the
          // sidebar is a project tree now, and a count of flagged files under
          // a heading that says "Files" would contradict what is under it.
          fileCount: data.fileCount,
          filesTruncated: data.filesTruncated,
          // Verbatim, so "no findings here" is backed by the stages that
          // actually ran — including the ones that came back degraded.
          stages: data.run.stages,
          runDurationMs: data.run.durationMs,
          score: data.run.score ?? 0,
          // The backend only reports a delta when there is a previous run to
          // compare against, so this is 0 on a first analysis — which the
          // header renders as no delta rather than as "−0".
          scoreDelta: 0,
          scoreBaseline: data.run.branch,
        }}
      />
    );
  }

  // Fixture mode — the designed sample review. Only one file's source is in the
  // bundle, so `sourceFile` is pinned to it while the tree selection roams.
  const sourceTokens = await tokenizeCode(ORDERS_SOURCE, "javascript");
  const fixTokens = await tokenizeFixes(FINDINGS);

  return (
    <ReviewWorkspace
      sourceTokens={sourceTokens}
      sourceFile="src/routes/orders.js"
      fixTokens={fixTokens}
      initialFinding={finding ?? null}
      initialFile={file ?? "src/routes/orders.js"}
    />
  );
}

/**
 * Tokenise each patch as a single unit so multi-line string state carries
 * across rows the way it does in the real file.
 */
async function tokenizeFixes(findings: Finding[]) {
  const out: Record<string, Awaited<ReturnType<typeof tokenizeCode>>> = {};
  for (const f of findings) {
    if (!f.fix) continue;
    const body = f.fix.lines.filter((l) => l.type !== "hunk");
    out[f.id] = await tokenizeCode(body.map((l) => l.text).join("\n"), f.fix.language);
  }
  return out;
}

/**
 * `/reviews` with no `?repo=`, on an install that is not in fixture mode.
 *
 * ⚠️ THIS USED TO FALL THROUGH TO THE SAMPLE REVIEW, and that was a trap
 *    rather than a nicety.
 *
 *    The screen filled with a fake project — orders.js, 4,218 lines, 8
 *    findings, score 34 — under the real header showing the user's actual repo
 *    name and branch. Nothing on it said "sample". Every control worked well
 *    enough to look real: Apply reported "Fix applied" against a file that
 *    exists on no disk, and the code pane never changed because there was
 *    nothing to change.
 *
 *    The root redirect lands here (`app/page.tsx`), so this is the first screen
 *    of the product for anyone who has not picked a project. It has to say what
 *    it is. The designed sample is still one env var away — that is what
 *    NEXT_PUBLIC_USE_FIXTURES is for — but it is no longer what a real install
 *    shows by accident.
 */
function NoProjectSelected() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <FileSearch size={22} className="mx-auto text-fg-faint" aria-hidden />
        <h1 className="mt-3 text-sm font-medium text-fg">No project selected</h1>
        <p className="mt-1 text-2xs text-fg-muted">
          A review is always scoped to one project. Choose one to see its findings — or
          connect a folder if you have not added one yet.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="primary" asChild>
            <Link href="/repositories">Choose a project</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Connected, but never analysed.
 *
 * Deliberately not an error and not an empty workspace: the user did nothing
 * wrong, there is exactly one thing to do next, and this says what it is.
 */
function NotAnalysedYet({ repoId }: { repoId: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <FileSearch size={22} className="mx-auto text-fg-faint" aria-hidden />
        <h1 className="mt-3 text-sm font-medium text-fg">Nothing to review yet</h1>
        <p className="mt-1 text-2xs text-fg-muted">
          This project has not been analysed. Run the analysis and the findings will appear
          here — nothing leaves your machine.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="primary" asChild>
            <Link href={`/runs?repo=${encodeURIComponent(repoId)}`}>Analyse now</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/repositories">Back to repositories</Link>
          </Button>
        </div>
        <p className="mt-3 font-mono text-2xs text-fg-faint">{repoId}</p>
      </div>
    </div>
  );
}
