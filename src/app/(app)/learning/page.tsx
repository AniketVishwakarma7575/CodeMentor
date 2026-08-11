import Link from "next/link";
import { ArrowRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { CONCEPTS, SKILL_HEADLINE, SKILL_SIGNALS } from "@/data/repo";
import { USE_FIXTURES } from "@/lib/api/config";
import { type SkillSignal } from "@/lib/api/learning";
import { conceptsServer, skillSignalsServer } from "@/lib/api/server-fetchers";
import { repositoryServer } from "@/lib/api/server-fetchers";
import type { Concept } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/primitives";
import { ResolveActiveProject } from "@/components/shell/resolve-active-project";

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

/**
 * Learning.
 *
 * ── WHAT IS MEASURED HERE, AND WHAT IS NOT ──
 *
 * Occurrence counts are real: `finding_history` increments once per run per
 * fingerprint, so "hit 91×" is 91 actual detections in this repository.
 *
 * MASTERY IS NOT TRACKED. Nothing records whether the user read a concept or
 * understood it, so the fixture's four-state mastery meter has no source. It
 * is replaced with the fact that does exist — how often this repository still
 * hits the concept, and which way that is moving. Rendering a "Practising"
 * badge from a seed file would be a claim about a person made from a constant.
 */
export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;

  if (USE_FIXTURES) return <FixtureLearning />;
  if (!repo) {
    return (
      <ResolveActiveProject
        path="/learning"
        description="Concepts are the same for everyone, but how often you hit them is per project. Connect a folder and analyse it."
      />
    );
  }

  const [concepts, signals, repository] = await Promise.all([
    conceptsServer(),
    skillSignalsServer(repo),
    repositoryServer(repo),
  ]);

  if (!concepts) return <Unavailable />;

  return (
    <RealLearning
      concepts={concepts}
      signals={signals ?? []}
      repoName={repository?.name ?? null}
    />
  );
}

function RealLearning({
  concepts,
  signals,
  repoName,
}: {
  concepts: Concept[];
  signals: SkillSignal[];
  repoName: string | null;
}) {
  const byConcept = new Map(signals.map((s) => [s.conceptId, s]));

  // Aggregate the two comparison windows. Percentages hide their denominators,
  // and "−50%" over 4→2 is a very different fact from 400→200.
  const recent = signals.reduce((a, s) => a + s.recent, 0);
  const prior = signals.reduce((a, s) => a + s.prior, 0);
  const totalHits = signals.reduce((a, s) => a + s.occurrences, 0);
  const changePct = prior === 0 ? null : Math.round(((recent - prior) / prior) * 100);

  // Worst first: the concept this repository hits most is the one to read.
  const ranked = [...signals].sort((a, b) => b.occurrences - a.occurrences);
  const nextUp = ranked.find((s) => s.trend === "regressing") ?? ranked[0] ?? null;
  const nextUpConcept = nextUp ? concepts.find((c) => c.id === nextUp.conceptId) : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Learning</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          What {repoName ?? "this codebase"} has been teaching you, and what it keeps having to
          repeat.
        </p>

        {/* ---- the headline, with its denominator ---------------------------- */}
        <section className="mt-4 rounded-lg border border-subtle bg-surface p-5">
          {signals.length === 0 ? (
            <div className="min-w-0">
              <Eyebrow>Repeat-mistake rate</Eyebrow>
              <p className="mt-1.5 text-lg font-medium text-fg-secondary">Nothing to compare yet</p>
              <p className="mt-2 max-w-[52ch] text-sm leading-[1.6] text-fg-secondary">
                No finding in this project has been mapped to a concept yet. The rate appears once
                a run produces one.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div className="min-w-0">
                <Eyebrow>Repeat-mistake rate</Eyebrow>
                {changePct === null ? (
                  <>
                    <p className="mt-1.5 flex items-baseline gap-2">
                      <span
                        className="tnum text-3xl font-semibold leading-none tracking-[-0.026em] text-fg"
                        data-metric
                      >
                        {totalHits}
                      </span>
                      <span className="text-md text-fg-secondary">repeats recorded</span>
                    </p>
                    <p className="mt-2 max-w-[52ch] text-sm leading-[1.6] text-fg-secondary">
                      All of them fall inside the last 30 days, so there is no earlier window to
                      compare against yet. A direction of travel appears once this project has
                      more than a month of history.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1.5 flex items-baseline gap-2">
                      <span
                        className="tnum text-3xl font-semibold leading-none tracking-[-0.026em]"
                        data-metric
                        style={{
                          color: changePct <= 0 ? "var(--sev-success)" : "var(--sev-critical)",
                        }}
                      >
                        {changePct > 0 ? "+" : "−"}
                        {Math.abs(changePct)}%
                      </span>
                      <span className="text-md text-fg-secondary">in 30 days</span>
                    </p>
                    <p className="mt-2 max-w-[52ch] text-sm leading-[1.6] text-fg-secondary">
                      You repeat a mistake CodeMentor has already explained{" "}
                      <span className="text-fg">
                        {Math.abs(changePct)}% {changePct > 0 ? "more" : "less"}
                      </span>{" "}
                      often than in the previous 30 days.
                    </p>
                  </>
                )}
              </div>

              {/* The proof, right next to the claim. A headline metric with no
                  denominator is a marketing number. */}
              <dl className="flex shrink-0 items-end gap-6 border-l border-subtle pl-6">
                <div>
                  <dt className="text-2xs text-fg-faint">Previous 30d</dt>
                  <dd className="tnum text-lg font-medium text-fg-secondary" data-metric>
                    {prior}
                  </dd>
                  <dd className="text-2xs text-fg-faint">occurrences</dd>
                </div>
                <div>
                  <dt className="text-2xs text-fg-faint">Last 30d</dt>
                  <dd className="tnum text-lg font-medium text-fg" data-metric>
                    {recent}
                  </dd>
                  <dd className="text-2xs text-fg-faint">occurrences</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          {/* ---- concept library ------------------------------------------- */}
          <section>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Concept library</Eyebrow>
              <span className="tnum text-2xs text-fg-faint">
                {pluralize(concepts.length, "concept")}
              </span>
            </div>

            <ul className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {concepts.map((c) => {
                const signal = byConcept.get(c.id);
                return (
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
                      <p className="mt-1 line-clamp-2 text-2xs leading-[1.5] text-fg-muted">
                        {c.summary}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 pt-1">
                        <TrendChip signal={signal} />
                        <span className="tnum ml-auto shrink-0 font-mono text-2xs text-fg-faint">
                          {c.difficulty} · {c.readMinutes}m
                        </span>
                      </div>
                      <p className="tnum mt-1 text-2xs text-fg-faint">
                        {signal
                          ? `hit ${signal.occurrences}× in this repo`
                          : "not hit in this repo"}
                        {c.relatedCwe ? ` · ${c.relatedCwe}` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ---- skill profile ---------------------------------------------- */}
          <section>
            <Eyebrow>Your patterns</Eyebrow>
            <div className="mt-1.5 rounded-lg border border-subtle bg-surface">
              {signals.length === 0 ? (
                <p className="px-3 py-3 text-2xs leading-[1.5] text-fg-muted">
                  No concept has been hit in this project yet.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {ranked.map((s) => {
                      const { Icon, color } = TREND_STYLE[s.trend];
                      return (
                        <li key={s.conceptId}>
                          <Link
                            href={`/learning/${s.conceptId}`}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-hover"
                          >
                            <Icon size={12} style={{ color }} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                              {s.concept}
                            </span>
                            <span className="tnum shrink-0 text-2xs text-fg-faint">
                              {s.occurrences}×
                            </span>
                            <span
                              className="tnum w-11 shrink-0 text-right text-2xs font-medium"
                              style={{ color }}
                            >
                              {s.prior === 0
                                ? "new"
                                : `${s.changePct > 0 ? "+" : s.changePct < 0 ? "−" : "±"}${Math.abs(s.changePct)}%`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="border-t border-subtle px-3 py-2 text-2xs leading-[1.5] text-fg-muted">
                    {summarise(ranked)}
                  </p>
                </>
              )}
            </div>

            {nextUp && nextUpConcept ? (
              <div className={cn("mt-3 rounded-lg border border-subtle bg-surface p-3")}>
                <Eyebrow>Next up</Eyebrow>
                <p className="mt-1 text-sm leading-[1.55] text-fg-secondary">
                  Read <span className="text-fg">{nextUpConcept.title}</span> —{" "}
                  {nextUpConcept.readMinutes} minutes.{" "}
                  {nextUp.trend === "regressing"
                    ? "It is the concept you are getting worse at."
                    : `It is the one this project hits most — ${nextUp.occurrences} times so far.`}
                </p>
                <Link
                  href={`/learning/${nextUpConcept.id}`}
                  className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-sm font-medium text-fg-inverse hover:opacity-90"
                >
                  Open concept
                  <ArrowRight size={12} aria-hidden />
                </Link>
              </div>
            ) : null}
          </section>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

const TREND_STYLE = {
  improving: { Icon: TrendingDown, color: "var(--sev-success)" },
  regressing: { Icon: TrendingUp, color: "var(--sev-critical)" },
  flat: { Icon: Minus, color: "var(--text-faint)" },
} as const;

/**
 * Per-concept status, in place of the mastery meter.
 *
 * Says what was counted, not what the user supposedly knows. "New" rather than
 * "±0%" when there is no prior window: a first appearance is not a flat trend,
 * and drawing it as one implies a comparison that was never made.
 */
function TrendChip({ signal }: { signal?: SkillSignal }) {
  if (!signal) {
    return <span className="text-2xs text-fg-faint">Not hit here</span>;
  }
  const { Icon, color } = TREND_STYLE[signal.trend];
  const label =
    signal.prior === 0 ? "New in this window" : signal.trend === "flat" ? "Flat" : signal.trend;
  return (
    <span className="flex items-center gap-1.5">
      <Icon size={11} style={{ color }} aria-hidden />
      <span className="text-2xs capitalize text-fg-muted">{label}</span>
    </span>
  );
}

function summarise(signals: SkillSignal[]): string {
  const worst = signals.find((s) => s.trend === "regressing");
  if (worst) {
    return `${worst.concept} is moving the wrong way — ${worst.recent} occurrences in the last 30 days against ${worst.prior} before.`;
  }
  const improving = signals.filter((s) => s.trend === "improving").length;
  if (improving > 0) {
    return `${pluralize(improving, "concept")} trending down, none getting worse.`;
  }
  return `${pluralize(signals.length, "concept")} tracked in this project. None has a previous window to compare against yet.`;
}

function Unavailable() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[420px] text-center">
        <h1 className="text-sm font-medium text-fg">Learning unavailable</h1>
        <p className="mt-1 text-2xs text-fg-muted">
          The API did not respond. Nothing is shown rather than sample content.
        </p>
      </div>
    </div>
  );
}

/* -- design mode ------------------------------------------------------------- */

/** The sample profile, for NEXT_PUBLIC_USE_FIXTURES=true. */
function FixtureLearning() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Learning</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          What this codebase has been teaching you, and what it keeps having to repeat.
        </p>

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
                    <p className="mt-1 line-clamp-2 text-2xs leading-[1.5] text-fg-muted">
                      {c.summary}
                    </p>
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

          <section>
            <Eyebrow>Your patterns</Eyebrow>
            <div className="mt-1.5 rounded-lg border border-subtle bg-surface">
              <ul className="divide-y divide-[var(--border-subtle)]">
                {SKILL_SIGNALS.map((s) => {
                  const { Icon, color } = TREND_STYLE[s.trend];
                  return (
                    <li key={s.conceptId}>
                      <Link
                        href={`/learning/${s.conceptId}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-hover"
                      >
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
