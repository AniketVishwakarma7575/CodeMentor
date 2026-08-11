"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Lightbulb,
  Minus,
  Scale,
  Sparkle,
  TrendingUp,
  X,
} from "lucide-react";
import type { Finding, ImprovementNote, VerificationCheck } from "@/lib/types";
import {
  cn,
  engineLabel,
  formatDebt,
  issueTypeLabel,
  severityVar,
} from "@/lib/utils";
import { expandCollapse, transition } from "@/lib/motion";
import { Button, Eyebrow, Kbd } from "@/components/ui/primitives";
import { SeverityPill } from "@/components/severity";
import { DiffView } from "./diff-view";
import type { TokenLine } from "@/lib/highlight";

/* ============================================================================
   THE finding card.

   It carries a lot: provenance, three explanations, a patch, four verification
   results, a trade-off, a linked concept and four actions. The thing that keeps
   it scannable is not spacing — it is a strict rhythm of eyebrow + content, and
   a hard rule that nothing below the diff is prose longer than two lines
   unless the reader asked for it.

   Progressive disclosure, in order of how often it is wanted:
     always      meta · title · three columns · diff · verification · actions
     one click   deep dive (the "why", at length)
     one click   data-flow trace (source → sink)
   ========================================================================== */

export function FindingCard({
  finding,
  fixTokens,
  expanded,
  onToggleExpand,
  onApply,
  onDismiss,
  onSnooze,
  revealDiff,
}: {
  finding: Finding;
  fixTokens?: TokenLine[];
  expanded: boolean;
  onToggleExpand: () => void;
  onApply: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  revealDiff: boolean;
}) {
  const [showFlow, setShowFlow] = React.useState(false);
  const reduce = useReducedMotion();
  const applied = finding.status === "applied";

  return (
    <motion.article
      key={finding.id}
      layout={reduce ? false : "position"}
      transition={transition.layout}
      aria-labelledby={`finding-title-${finding.id}`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ---- 1. provenance row ------------------------------------------ */}
        <header className="border-b border-subtle px-4 pb-3 pt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <SeverityPill severity={finding.severity} />
            <MetaSep />
            <span className="text-2xs text-fg-secondary">{finding.category}</span>
            {finding.cwe ? (
              <>
                <MetaSep />
                <abbr
                  title={finding.cwe.title}
                  className="font-mono text-2xs text-fg-secondary no-underline decoration-dotted underline-offset-2 hover:underline"
                >
                  {finding.cwe.id}
                </abbr>
              </>
            ) : null}
            <MetaSep />
            <span className="tnum font-mono text-2xs text-fg-secondary">line {finding.line}</span>
            <MetaSep />
            <span className="tnum text-2xs text-fg-secondary">
              {finding.confidence}% confidence
            </span>

            <span className="ml-auto flex items-center gap-1.5">
              {finding.isNew ? (
                <span className="rounded-sm border border-info-bd bg-info-bg px-1 text-2xs font-medium text-info-fg">
                  New in this PR
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-2xs text-fg-faint">
                <Clock3 size={10} aria-hidden />
                <span className="tnum">{formatDebt(finding.effortMinutes)}</span>
              </span>
            </span>
          </div>

          {/* ---- 2. title -------------------------------------------------- */}
          <h2
            id={`finding-title-${finding.id}`}
            className="mt-2 text-md font-medium leading-[1.35] tracking-[-0.008em] text-fg"
          >
            {finding.title}
          </h2>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-fg-faint">
            <span>{engineLabel[finding.engine]}</span>
            <MetaSep />
            <span className="truncate">{finding.ruleKey}</span>
            <MetaSep />
            <span>{issueTypeLabel[finding.type]}</span>
            {finding.owasp ? (
              <>
                <MetaSep />
                <span>{finding.owasp}</span>
              </>
            ) : null}
          </div>
        </header>

        {/* ---- 3. three columns ------------------------------------------- */}
        <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] border-b border-subtle xl:grid-cols-3 xl:divide-x xl:divide-y-0">
          <Column label="What's wrong" text={finding.whatsWrong} />
          <Column label="Why it matters" text={finding.whyItMatters} />
          <Column label="If ignored" text={finding.ifIgnored} accent={severityVar[finding.severity]} />
        </div>

        {/* ---- expandable: the long explanation ---------------------------- */}
        {finding.deepDive ? (
          <div className="border-b border-subtle">
            <button
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-controls={`deep-${finding.id}`}
              className="flex h-8 w-full items-center gap-1.5 px-4 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg"
            >
              <ChevronDown
                size={13}
                aria-hidden
                className={cn("shrink-0 transition-transform duration-[180ms]", expanded && "rotate-180")}
              />
              {expanded ? "Hide full explanation" : "Explain in full"}
              <Kbd className="ml-auto">e</Kbd>
            </button>
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  id={`deep-${finding.id}`}
                  variants={expandCollapse}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  className="overflow-hidden"
                >
                  <div className="prose-explain px-4 pb-3">
                    {finding.deepDive.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        {/* ---- expandable: taint trace (Checkmarx-style) ------------------- */}
        {finding.dataFlow?.length ? (
          <div className="border-b border-subtle">
            <button
              onClick={() => setShowFlow((v) => !v)}
              aria-expanded={showFlow}
              className="flex h-8 w-full items-center gap-1.5 px-4 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg"
            >
              <ChevronDown
                size={13}
                aria-hidden
                className={cn("shrink-0 transition-transform duration-[180ms]", showFlow && "rotate-180")}
              />
              Data flow
              <span className="tnum ml-1 text-2xs text-fg-faint">
                {finding.dataFlow.length} steps · source → sink
              </span>
            </button>
            <AnimatePresence initial={false}>
              {showFlow ? (
                <motion.div
                  variants={expandCollapse}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  className="overflow-hidden"
                >
                  <ol className="px-4 pb-3">
                    {finding.dataFlow.map((step, i) => (
                      <li key={i} className="relative flex gap-2.5 pb-2 last:pb-0">
                        <span className="relative flex w-3 shrink-0 justify-center">
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                              background:
                                step.kind === "sink"
                                  ? severityVar[finding.severity]
                                  : step.kind === "sanitizer"
                                    ? "var(--sev-success)"
                                    : "var(--text-faint)",
                            }}
                          />
                          {i < finding.dataFlow!.length - 1 ? (
                            <span className="absolute left-1/2 top-3 h-[calc(100%-4px)] w-px -translate-x-1/2 bg-[var(--border-subtle)]" />
                          ) : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xs font-medium uppercase tracking-[0.04em] text-fg-muted">
                              {step.kind}
                            </span>
                            <span className="tnum truncate font-mono text-2xs text-fg-faint">
                              {step.file}:{step.line}
                            </span>
                          </div>
                          <code className="mt-0.5 block truncate font-mono text-2xs text-[var(--code-fg)]">
                            {step.snippet}
                          </code>
                        </div>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}

        {/* ---- 3b. the better approach ------------------------------------- */}
        {/* Above the diff, not below it. The diff answers "what edit"; this
            answers "why that edit" — and a reader who disagrees with the
            reasoning should not have to scroll past the patch to find it.
            Renders on its own when there is no committable patch, which for a
            contextual finding is the common case. */}
        {finding.betterApproach ? (
          <section className="border-b border-subtle px-4 py-3">
            <div className="flex gap-2.5">
              <Lightbulb size={13} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0">
                <Eyebrow>Better approach</Eyebrow>
                <p className="mt-0.5 text-sm leading-[1.5] text-fg-secondary">
                  {finding.betterApproach}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* ---- 4. the fix -------------------------------------------------- */}
        {finding.fix ? (
          <section className="border-b border-subtle px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Eyebrow>Suggested fix</Eyebrow>
              {finding.fix.committable ? (
                <span className="rounded-sm border border-subtle px-1 text-2xs text-fg-muted">
                  committable
                </span>
              ) : (
                <span className="rounded-sm border border-medium-bd bg-medium-bg px-1 text-2xs text-medium-fg">
                  needs an import
                </span>
              )}
            </div>
            <DiffView patch={finding.fix} tokens={fixTokens} reveal={revealDiff} />

            {/* ---- 5. verification ----------------------------------------- */}
            <VerificationRow checks={finding.verification} />
          </section>
        ) : null}

        {/* ---- 5b. what fixing it buys ------------------------------------- */}
        {/* Sits between the fix and the trade-off on purpose: gain, then cost,
            in the order someone deciding whether to do the work reads them. */}
        {finding.improvements?.length ? (
          <section className="border-b border-subtle px-4 py-3">
            <div className="flex gap-2.5">
              <TrendingUp size={13} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <Eyebrow>What this fixes</Eyebrow>
                <ul className="mt-1 space-y-1">
                  {finding.improvements.map((note, i) => (
                    <li key={i} className="flex min-w-0 gap-2 text-sm leading-[1.5]">
                      {/* The label is the same axis the dashboard scores, so a
                          reader can connect the claim to the number it moves. */}
                      <span className="mt-px w-[92px] shrink-0 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                        {DIMENSION_LABEL[note.dimension]}
                      </span>
                      <span className="min-w-0 flex-1 text-fg-secondary">{note.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {/* ---- 6. trade-off ------------------------------------------------ */}
        {finding.tradeOff ? (
          <section className="border-b border-subtle px-4 py-3">
            <div className="flex gap-2.5">
              <Scale size={13} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0">
                <Eyebrow>Trade-off</Eyebrow>
                <p className="mt-0.5 text-sm leading-[1.5] text-fg-secondary">{finding.tradeOff}</p>
              </div>
            </div>
          </section>
        ) : null}

        {/* ---- 7. learning teaser ------------------------------------------ */}
        {finding.learning ? (
          <Link
            href={`/learning/${finding.learning.conceptId}`}
            className="group flex items-center gap-2.5 border-b border-subtle px-4 py-2.5 hover:bg-hover"
          >
            <BookOpen size={14} className="shrink-0 text-fg-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{finding.learning.concept}</p>
              <p className="tnum truncate text-2xs text-fg-muted">
                {finding.learning.difficulty} · {finding.learning.readMinutes} min read ·{" "}
                <span className="text-fg-secondary">
                  {ordinal(finding.learning.occurrence)} time you&apos;ve hit this
                </span>
              </p>
            </div>
            <Kbd>l</Kbd>
            <ArrowRight
              size={13}
              className="shrink-0 text-fg-faint transition-transform duration-[120ms] group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : null}

        <div className="h-2" />
      </div>

      {/* ---- 8. actions — pinned, always reachable ------------------------- */}
      <footer className="flex shrink-0 items-center gap-1.5 border-t border-subtle bg-surface px-3 py-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onApply}
          disabled={applied || !finding.fix}
          className="gap-1.5"
        >
          {applied ? <Check size={13} aria-hidden /> : <Sparkle size={13} aria-hidden />}
          {applied ? "Fix applied" : "Apply fix"}
          {!applied ? <Kbd className="ml-0.5 border-transparent bg-transparent text-fg-inverse/60">a</Kbd> : null}
        </Button>
        <Button variant="secondary" size="sm" onClick={onToggleExpand}>
          Explain more
          <Kbd className="ml-0.5">e</Kbd>
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onSnooze}>
            Snooze
            <Kbd className="ml-0.5">s</Kbd>
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not an issue
            <Kbd className="ml-0.5">x</Kbd>
          </Button>
        </div>
      </footer>
    </motion.article>
  );
}

/**
 * Dimension keys → the labels the dashboard already uses.
 *
 * Written out rather than title-cased from the key so the card and the score
 * panel can never drift into calling the same axis two different things.
 */
const DIMENSION_LABEL: Record<ImprovementNote["dimension"], string> = {
  security: "Security",
  reliability: "Reliability",
  performance: "Performance",
  maintainability: "Maintainability",
  readability: "Readability",
};

/* -- pieces ----------------------------------------------------------------- */

function MetaSep() {
  return (
    <span aria-hidden className="text-fg-faint">
      ·
    </span>
  );
}

function Column({ label, text, accent }: { label: string; text: string; accent?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-1.5">
        {accent ? (
          <span aria-hidden className="h-2 w-[2px] rounded-xs" style={{ background: accent }} />
        ) : null}
        <Eyebrow>{label}</Eyebrow>
      </div>
      <p className="mt-1 text-sm leading-[1.5] text-fg-secondary">{text}</p>
    </div>
  );
}

/**
 * Verification.
 * A tick is never the only signal — the state also changes the glyph and the
 * label prefix, so a failed check is unmistakable in greyscale.
 */
function VerificationRow({ checks }: { checks: VerificationCheck[] }) {
  const failed = checks.filter((c) => c.state === "failed");

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.id} className="flex items-center gap-1 text-2xs">
            <CheckGlyph state={c.state} />
            <span
              className={cn(
                c.state === "passed"
                  ? "text-fg-secondary"
                  : c.state === "failed"
                    ? "text-critical-fg"
                    : "text-fg-faint"
              )}
            >
              {c.label}
            </span>
            {c.detail && c.state !== "failed" ? (
              <span className="tnum text-fg-faint">· {c.detail}</span>
            ) : null}
          </span>
        ))}
      </div>

      {failed.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 rounded-md border border-critical-bd bg-critical-bg px-2 py-1.5">
          {failed.map((c) => (
            <li key={c.id} className="text-2xs leading-[1.5] text-critical-fg">
              <span className="font-medium">{c.label} failed</span>
              {c.detail ? <span className="text-fg-secondary"> — {c.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CheckGlyph({ state }: { state: VerificationCheck["state"] }) {
  if (state === "passed") {
    return <Check size={11} aria-hidden style={{ color: "var(--sev-success)" }} />;
  }
  if (state === "failed") {
    return <X size={11} aria-hidden style={{ color: "var(--sev-critical)" }} />;
  }
  if (state === "running") {
    return (
      <span
        aria-hidden
        className="h-[7px] w-[7px] rounded-full border border-fg-muted border-t-transparent motion-safe:animate-spin"
      />
    );
  }
  return <Minus size={11} aria-hidden className="text-fg-faint" />;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
