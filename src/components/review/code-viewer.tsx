"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import type { TokenLine } from "@/lib/highlight";
import type { Finding } from "@/lib/types";
import { cn, severityMeta, severityVar } from "@/lib/utils";
import { SeverityGlyph } from "@/components/severity";

/* ============================================================================
   Code viewer.

   Built as a CSS grid rather than a <pre>, because the gutter has to carry a
   severity bar and the line flow has to be interrupted by inline finding
   markers. You cannot do either inside markup Shiki generated for you.

   Layout per row:  [3px severity bar][48px line no · sticky][code · scrolls x]

   The line-number column is sticky at left: 0, so a 428-character line scrolls
   horizontally *underneath* it. Losing your place in the gutter while scrolling
   a minified line is the classic failure here.
   ========================================================================== */

const LINE_HEIGHT = 20; // px — 13px mono at 1.5

export function CodeViewer({
  tokens,
  findings,
  selectedId,
  onSelect,
  filePath,
  className,
}: {
  tokens: TokenLine[];
  findings: Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filePath: string;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /** line number -> findings anchored at that line */
  const byLine = React.useMemo(() => {
    const map = new Map<number, Finding[]>();
    for (const f of findings) {
      if (f.status === "dismissed") continue;
      const arr = map.get(f.line) ?? [];
      arr.push(f);
      map.set(f.line, arr);
    }
    return map;
  }, [findings]);

  /** lines covered by a finding's range, for the tinted band */
  const coverage = React.useMemo(() => {
    const map = new Map<number, Finding>();
    for (const f of findings) {
      if (f.status === "dismissed") continue;
      for (let l = f.line; l <= (f.endLine ?? f.line); l++) {
        const existing = map.get(l);
        // Worst severity wins the gutter when ranges overlap.
        if (!existing || severityMeta[f.severity].rank < severityMeta[existing.severity].rank) {
          map.set(l, f);
        }
      }
    }
    return map;
  }, [findings]);

  // Scroll the selected finding into view. `block: center` because the reader
  // needs the surrounding code, not the line pinned to the top edge.
  React.useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-finding-anchor="${selectedId}"]`);
    el?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [selectedId]);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col bg-inset", className)}>
      <div
        ref={scrollRef}
        className="scroll-x min-h-0 flex-1 overflow-y-auto"
        role="region"
        aria-label={`Source of ${filePath}`}
      >
        <div className="min-w-max pb-16 font-mono text-xs leading-5">
          {tokens.map((line, i) => {
            const lineNo = i + 1;
            const anchored = byLine.get(lineNo);
            const covering = coverage.get(lineNo);
            const isSelectedLine =
              !!selectedId && (anchored?.some((f) => f.id === selectedId) ?? false);

            return (
              <React.Fragment key={lineNo}>
                <div
                  className={cn(
                    "group flex min-w-max items-stretch",
                    isSelectedLine && "bg-[var(--code-line-highlight)]"
                  )}
                  style={
                    covering && !isSelectedLine
                      ? {
                          background: `color-mix(in oklab, ${severityVar[covering.severity]} 7%, transparent)`,
                        }
                      : undefined
                  }
                >
                  {/* severity bar — 3px, full row height */}
                  <span
                    aria-hidden
                    className="w-[3px] shrink-0"
                    style={{ background: covering ? severityVar[covering.severity] : "transparent" }}
                  />
                  {/* sticky gutter */}
                  <span
                    className={cn(
                      "sticky left-0 z-10 w-[52px] shrink-0 select-none pr-2.5 text-right",
                      "text-[var(--code-line-number)]",
                      covering ? "bg-transparent" : "bg-inset"
                    )}
                    style={
                      covering
                        ? {
                            background: `color-mix(in oklab, ${severityVar[covering.severity]} 7%, var(--bg-inset))`,
                          }
                        : undefined
                    }
                    aria-hidden
                  >
                    {lineNo}
                  </span>
                  {/* code */}
                  <code className="whitespace-pre pl-3 pr-8 text-[var(--code-fg)]">
                    {line.length === 0 ? " " : null}
                    {line.map((t, ti) => (
                      <span
                        key={ti}
                        style={{ color: `var(--code-${t.v})`, fontStyle: t.i ? "italic" : undefined }}
                      >
                        {t.c}
                      </span>
                    ))}
                  </code>
                </div>

                {anchored?.map((f) => (
                  <InlineMarker
                    key={f.id}
                    finding={f}
                    selected={f.id === selectedId}
                    onSelect={() => onSelect(f.id)}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The finding *at* its line — a one-row marker, not the full card.
 *
 * Rendering the whole detail card inline was the obvious first idea and it is
 * wrong: it pushes 400px of prose between two adjacent statements and destroys
 * the reason you are reading the file. The marker carries enough to triage
 * (severity, title, rule, confidence); the card lives in the right pane.
 */
function InlineMarker({
  finding,
  selected,
  onSelect,
}: {
  finding: Finding;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-finding-anchor={finding.id}
      className="sticky left-0 flex min-w-0 max-w-full items-stretch"
      style={{ width: "min(100%, 860px)" }}
    >
      <span aria-hidden className="w-[3px] shrink-0" style={{ background: severityVar[finding.severity] }} />
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "my-0.5 ml-[52px] flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border px-2 text-left",
          "transition-colors duration-[120ms]",
          selected
            ? "border-strong bg-elevated"
            : "border-subtle bg-surface hover:border-strong hover:bg-hover"
        )}
      >
        <SeverityGlyph severity={finding.severity} size={11} />
        <span className="truncate font-sans text-sm text-fg">{finding.title}</span>
        <span className="ml-auto hidden shrink-0 items-center gap-2 font-mono text-2xs text-fg-faint md:flex">
          <span>{finding.ruleKey}</span>
          <span className="tnum">{finding.confidence}%</span>
        </span>
        <ChevronRight size={12} className="shrink-0 text-fg-faint" aria-hidden />
      </button>
    </div>
  );
}

export { LINE_HEIGHT };
