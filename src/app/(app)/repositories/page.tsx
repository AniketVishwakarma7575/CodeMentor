import Link from "next/link";
import { GitBranch } from "lucide-react";
import { REPO } from "@/data/repo";
import { ratingColorVar, scoreColorVar, ratingFromScore } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata = { title: "Repositories" };

const REPOS = [
  { name: "acme/checkout-service", branch: "feat/order-search", score: 34, findings: 8, loc: 48219, gate: "failed" },
  { name: "acme/identity", branch: "main", score: 88, findings: 3, loc: 22140, gate: "passed" },
  { name: "acme/pricing-engine", branch: "main", score: 71, findings: 11, loc: 61903, gate: "passed" },
  { name: "acme/web-storefront", branch: "release/24.11", score: 63, findings: 24, loc: 118442, gate: "failed" },
  { name: "acme/internal-tools", branch: "main", score: 92, findings: 1, loc: 9317, gate: "passed" },
];

export default function RepositoriesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Repositories</h1>
        <p className="mt-0.5 text-sm text-fg-muted">{REPOS.length} connected · analysed on every push</p>

        <Eyebrow className="mt-4 block">Connected</Eyebrow>
        <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
          {REPOS.map((r) => {
            const rating = ratingFromScore(r.score);
            return (
              <li key={r.name}>
                <Link
                  href={r.name === REPO.name ? "/reviews" : "/insights"}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-hover"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-subtle text-2xs font-medium"
                    style={{ color: ratingColorVar(rating) }}
                    aria-label={`Rating ${rating}`}
                  >
                    {rating}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{r.name}</p>
                    <p className="flex items-center gap-1 truncate font-mono text-2xs text-fg-muted">
                      <GitBranch size={9} aria-hidden />
                      {r.branch}
                    </p>
                  </div>
                  <span className="tnum hidden shrink-0 text-2xs text-fg-faint sm:block">
                    {r.loc.toLocaleString()} lines
                  </span>
                  <span className="tnum w-16 shrink-0 text-right text-2xs text-fg-muted">
                    {r.findings} findings
                  </span>
                  <span
                    className="tnum w-8 shrink-0 text-right text-sm font-medium"
                    style={{ color: scoreColorVar(r.score) }}
                    data-metric
                  >
                    {r.score}
                  </span>
                  <span
                    className="w-14 shrink-0 text-right text-2xs"
                    style={{
                      color: r.gate === "passed" ? "var(--sev-success-fg)" : "var(--sev-critical-fg)",
                    }}
                  >
                    {r.gate === "passed" ? "✓ gate" : "✕ gate"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
