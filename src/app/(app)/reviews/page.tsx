import { tokenizeCode } from "@/lib/highlight";
import { ORDERS_SOURCE } from "@/data/source";
import { FINDINGS } from "@/data/findings";
import { ReviewWorkspace } from "@/components/review/review-workspace";

export const metadata = { title: "Review · src/routes/orders.js" };

/**
 * Server component. All syntax highlighting happens here, once, and the client
 * receives plain token arrays. Shiki never enters the browser bundle.
 *
 * The selected finding is read from `searchParams` on the server rather than
 * with `useSearchParams` in the workspace. That matters: the hook opts the
 * whole subtree out of prerendering, which would have meant this screen — the
 * one that has to feel instant — shipping a skeleton on every cold load and
 * painting the code only after hydration.
 */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ finding?: string; file?: string }>;
}) {
  const { finding, file } = await searchParams;
  const sourceTokens = await tokenizeCode(ORDERS_SOURCE, "javascript");

  // Tokenise each patch as a single unit so multi-line string state carries
  // across rows the way it does in the real file.
  const fixTokens: Record<string, Awaited<ReturnType<typeof tokenizeCode>>> = {};
  for (const f of FINDINGS) {
    if (!f.fix) continue;
    const body = f.fix.lines.filter((l) => l.type !== "hunk");
    fixTokens[f.id] = await tokenizeCode(body.map((l) => l.text).join("\n"), f.fix.language);
  }

  return (
    <ReviewWorkspace
      sourceTokens={sourceTokens}
      fixTokens={fixTokens}
      initialFinding={finding ?? null}
      initialFile={file ?? "src/routes/orders.js"}
    />
  );
}
