import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { CONCEPTS, SKILL_HEADLINE, SKILL_SIGNALS } from "@/data/repo";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata = { title: "Learning" };

const MASTERY_LABEL: Record<string, string> = {
  "not-started": "Not started",
  learning: "Learning",
  practising: "Practising",
  mastered: "Mastered",
};

/** Four states, four filled steps out of four. Never colour alone. */
function MasteryMeter({ state }: { state: string }) {
  const level = { "not-started": 0, learning: 1, practising: 2, mastered: 3 }[state] ?? 0;
  const color =
    level === 3 ? "var(--sev-success)" : level === 0 ? "var(--text-faint)" : "var(--text-secondary)";
  return (
    <span className="flex items-center gap-1.5" title={MASTERY_LABEL[state]}>
      <span className="flex gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[3px] w-3 rounded-xs"
            style={{ background: i < level ? color : "var(--bg-active)" }}
          />
        ))}
      </span>
      <span className="text-2xs text-fg-muted">{MASTERY_LABEL[state]}</span>
    </span>
  );
}

export default function LearningPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Learning</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          What this codebase has been teaching you, and what it keeps having to repeat.
        </p>

        {/* ---- the emotional centrepiece -----------------------------------
            Left-aligned, not a centred hero. This is an application screen —
            centred marketing copy in the middle of a tool is the loudest tell
            there is. The number earns its size by being the one thing on the
            screen the user cannot get anywhere else. */}
        <section className="mt-4 rounded-lg border border-subtle bg-surface p-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="min-w-0">
              <Eyebrow>Repeat-mistake rate</Eyebrow>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span
                  className="tnum text-3xl font-semibold leading-none tracking-[-0.026em]"
                  data-metric
                  style={{ color: "var(--sev-success)" }}
                >
                  −{SKILL_HEADLINE.metric}%
                </span>
                <span className="text-md text-fg-secondary">in {SKILL_HEADLINE.window}</span>
              </p>
              <p className="mt-2 max-w-[52ch] text-sm leading-[1.6] text-fg-secondary">
                You repeat a mistake CodeMentor has already explained to you{" "}
                <span className="text-fg">{SKILL_HEADLINE.metric}% less often</span> than you did
                three months ago. {SKILL_HEADLINE.detail}
              </p>
            </div>

            {/* The proof, right next to the claim. A headline metric with no
                denominator is a marketing number. */}
            <dl className="flex shrink-0 items-end gap-6 border-l border-subtle pl-6">
              <div>
                <dt className="text-2xs text-fg-faint">Then</dt>
                <dd className="tnum text-lg font-medium text-fg-secondary" data-metric>
                  {SKILL_HEADLINE.repeatsThen}
                </dd>
                <dd className="text-2xs text-fg-faint">repeats / 100</dd>
              </div>
              <div>
                <dt className="text-2xs text-fg-faint">Now</dt>
                <dd className="tnum text-lg font-medium text-fg" data-metric>
                  {SKILL_HEADLINE.repeatsNow}
                </dd>
                <dd className="text-2xs text-fg-faint">repeats / 100</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          {/* ---- concept library ------------------------------------------- */}
          <section>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Concept library</Eyebrow>
              <span className="tnum text-2xs text-fg-faint">{CONCEPTS.length} concepts</span>
            </div>

            <ul className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CONCEPTS.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/learning/${c.id}`}
                    className="group flex h-full flex-col rounded-lg border border-subtle bg-surface p-3 hover:border-strong hover:bg-hover"
                  >
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 text-sm font-medium text-fg">{c.title}</h2>
                      <ArrowRight
                        size={13}
                        className="mt-0.5 shrink-0 text-fg-faint transition-transform duration-[120ms] group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-2xs leading-[1.5] text-fg-muted">{c.summary}</p>
                    <div className="mt-2.5 flex items-center gap-2 pt-1">
                      <MasteryMeter state={c.mastery} />
                      <span className="tnum ml-auto shrink-0 font-mono text-2xs text-fg-faint">
                        {c.difficulty} · {c.readMinutes}m
                      </span>
                    </div>
                    <p className="tnum mt-1 text-2xs text-fg-faint">
                      hit {c.timesHit}× in this repo
                      {c.relatedCwe ? ` · ${c.relatedCwe}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* ---- skill profile ---------------------------------------------- */}
          <section>
            <Eyebrow>Your patterns</Eyebrow>
            <div className="mt-1.5 rounded-lg border border-subtle bg-surface">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {SKILL_SIGNALS.map((s) => {
                  const Icon =
                    s.trend === "improving" ? TrendingDown : s.trend === "regressing" ? TrendingUp : Minus;
                  const color =
                    s.trend === "improving"
                      ? "var(--sev-success)"
                      : s.trend === "regressing"
                        ? "var(--sev-critical)"
                        : "var(--text-faint)";
                  return (
                    <li key={s.conceptId}>
                      <Link href={`/learning/${s.conceptId}`} className="flex items-center gap-2 px-3 py-2 hover:bg-hover">
                        <Icon size={12} style={{ color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                          {s.concept}
                        </span>
                        <span className="tnum shrink-0 text-2xs text-fg-faint">{s.occurrences}×</span>
                        <span
                          className="tnum w-11 shrink-0 text-right text-2xs font-medium"
                          style={{ color }}
                        >
                          {s.changePct > 0 ? "+" : s.changePct < 0 ? "−" : "±"}
                          {Math.abs(s.changePct)}%
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-subtle px-3 py-2 text-2xs leading-[1.5] text-fg-muted">
                <span className="text-fg-secondary">N+1 queries</span> is the one moving the wrong
                way — five occurrences this quarter against four last. Everything else is trending
                down.
              </p>
            </div>

            <div className={cn("mt-3 rounded-lg border border-subtle bg-surface p-3")}>
              <Eyebrow>Next up</Eyebrow>
              <p className="mt-1 text-sm leading-[1.55] text-fg-secondary">
                Read <span className="text-fg">N+1 queries</span> — 6 minutes. It is the only concept
                you are getting worse at, and it accounts for{" "}
                <span className="tnum text-fg">45 minutes</span> of the current debt.
              </p>
              <Link
                href="/learning/n-plus-one"
                className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-sm font-medium text-fg-inverse hover:opacity-90"
              >
                Open concept
                <ArrowRight size={12} aria-hidden />
              </Link>
            </div>
          </section>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
