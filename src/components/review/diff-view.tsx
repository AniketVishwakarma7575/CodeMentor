"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Columns2, Rows3 } from "lucide-react";
import type { TokenLine } from "@/lib/highlight";
import type { DiffLine, FixPatch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { diffLine as diffLineVariants } from "@/lib/motion";

/* ============================================================================
   Diff renderer.

   Custom rather than react-diff-view, for one reason: we need the severity
   gutter, the line numbers and the Shiki tokens to share a single grid. A
   third-party diff component owns its own row markup and fights every one of
   those. ~120 lines of our own is cheaper than the workarounds.
   ========================================================================== */

export function DiffView({
  patch,
  tokens,
  reveal,
  className,
}: {
  patch: FixPatch;
  tokens?: TokenLine[];
  /** Animate the patch in line by line — used when a fix is applied. */
  reveal?: boolean;
  className?: string;
}) {
  const [mode, setMode] = React.useState<"unified" | "split">("unified");
  const reduce = useReducedMotion();

  const body = React.useMemo(() => patch.lines.filter((l) => l.type !== "hunk"), [patch.lines]);
  const hunk = patch.lines.find((l) => l.type === "hunk");

  return (
    <div className={cn("overflow-hidden rounded-md border border-subtle bg-inset", className)}>
      <div className="flex h-7 items-center gap-2 border-b border-subtle bg-surface px-2">
        <span className="truncate font-mono text-2xs text-fg-faint">{hunk?.text ?? "suggested fix"}</span>
        <div className="ml-auto flex items-center gap-1">
          {patch.autoFixable ? (
            <span className="rounded-sm border border-subtle px-1 text-2xs text-fg-muted">
              eslint --fix
            </span>
          ) : null}
          <div className="flex overflow-hidden rounded-md border border-subtle" role="group" aria-label="Diff layout">
            <button
              onClick={() => setMode("unified")}
              aria-pressed={mode === "unified"}
              title="Unified"
              className={cn(
                "flex h-5 w-6 items-center justify-center",
                mode === "unified" ? "bg-active text-fg" : "text-fg-faint hover:bg-hover"
              )}
            >
              <Rows3 size={11} aria-hidden />
              <span className="sr-only">Unified diff</span>
            </button>
            <button
              onClick={() => setMode("split")}
              aria-pressed={mode === "split"}
              title="Split"
              className={cn(
                "flex h-5 w-6 items-center justify-center border-l border-subtle",
                mode === "split" ? "bg-active text-fg" : "text-fg-faint hover:bg-hover"
              )}
            >
              <Columns2 size={11} aria-hidden />
              <span className="sr-only">Split diff</span>
            </button>
          </div>
        </div>
      </div>

      <div className="scroll-x max-h-[280px] overflow-y-auto">
        {mode === "unified" ? (
          <Unified body={body} tokens={tokens} reveal={!!reveal && !reduce} />
        ) : (
          <Split body={body} tokens={tokens} reveal={!!reveal && !reduce} />
        )}
      </div>
    </div>
  );
}

/* -- rows ------------------------------------------------------------------- */

function Tokens({ line, tokens }: { line: DiffLine; tokens?: TokenLine }) {
  if (!tokens || tokens.length === 0) {
    return <>{line.text || " "}</>;
  }
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: `var(--code-${t.v})`, fontStyle: t.i ? "italic" : undefined }}>
          {t.c}
        </span>
      ))}
    </>
  );
}

const SIGN: Record<DiffLine["type"], string> = { add: "+", del: "−", ctx: " ", hunk: "" };

function rowStyle(type: DiffLine["type"]) {
  if (type === "add") return "bg-[var(--diff-add-bg)]";
  if (type === "del") return "bg-[var(--diff-del-bg)]";
  return "";
}

function Unified({
  body,
  tokens,
  reveal,
}: {
  body: DiffLine[];
  tokens?: TokenLine[];
  reveal: boolean;
}) {
  return (
    <div className="min-w-max font-mono text-2xs leading-[18px]">
      {body.map((l, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={reveal ? diffLineVariants : undefined}
          initial={reveal ? "hidden" : false}
          animate={reveal ? "visible" : undefined}
          className={cn("flex min-w-max items-stretch", rowStyle(l.type))}
        >
          {/* Sign column: the diff is legible with the colour channel removed. */}
          <span
            aria-hidden
            className={cn(
              "sticky left-0 w-[76px] shrink-0 select-none px-2 text-right",
              l.type === "add"
                ? "bg-[var(--diff-add-gutter)] text-success-fg"
                : l.type === "del"
                  ? "bg-[var(--diff-del-gutter)] text-critical-fg"
                  : "bg-inset text-[var(--code-line-number)]"
            )}
          >
            <span className="tnum inline-block w-6 text-right">{l.oldLine ?? ""}</span>
            <span className="tnum inline-block w-6 text-right">{l.newLine ?? ""}</span>
            <span className="inline-block w-3 text-center font-medium">{SIGN[l.type]}</span>
          </span>
          <code className="whitespace-pre px-2 text-[var(--code-fg)]">
            <span className="sr-only">
              {l.type === "add" ? "Added: " : l.type === "del" ? "Removed: " : "Context: "}
            </span>
            <Tokens line={l} tokens={tokens?.[i]} />
          </code>
        </motion.div>
      ))}
    </div>
  );
}

function Split({ body, tokens, reveal }: { body: DiffLine[]; tokens?: TokenLine[]; reveal: boolean }) {
  // Pair deletions with insertions so a replacement reads across the gutter.
  const rows: { left?: { l: DiffLine; i: number }; right?: { l: DiffLine; i: number } }[] = [];
  let i = 0;
  while (i < body.length) {
    const l = body[i];
    if (l.type === "ctx") {
      rows.push({ left: { l, i }, right: { l, i } });
      i++;
    } else {
      const dels: { l: DiffLine; i: number }[] = [];
      const adds: { l: DiffLine; i: number }[] = [];
      while (i < body.length && body[i].type === "del") dels.push({ l: body[i], i: i++ });
      while (i < body.length && body[i].type === "add") adds.push({ l: body[i], i: i++ });
      const n = Math.max(dels.length, adds.length);
      for (let k = 0; k < n; k++) rows.push({ left: dels[k], right: adds[k] });
    }
  }

  return (
    <div className="grid min-w-max grid-cols-2 font-mono text-2xs leading-[18px]">
      {rows.map((r, ri) => (
        <React.Fragment key={ri}>
          <Side cell={r.left} side="left" tokens={tokens} reveal={reveal} rowIndex={ri} />
          <Side cell={r.right} side="right" tokens={tokens} reveal={reveal} rowIndex={ri} />
        </React.Fragment>
      ))}
    </div>
  );
}

function Side({
  cell,
  side,
  tokens,
  reveal,
  rowIndex,
}: {
  cell?: { l: DiffLine; i: number };
  side: "left" | "right";
  tokens?: TokenLine[];
  reveal: boolean;
  rowIndex: number;
}) {
  if (!cell) {
    return <div className={cn("min-w-0 bg-canvas/40", side === "right" && "border-l border-subtle")} />;
  }
  const { l, i } = cell;
  const type = side === "left" && l.type === "add" ? "ctx" : l.type;
  return (
    <motion.div
      custom={rowIndex}
      variants={reveal ? diffLineVariants : undefined}
      initial={reveal ? "hidden" : false}
      animate={reveal ? "visible" : undefined}
      className={cn("flex min-w-0 items-stretch", rowStyle(type), side === "right" && "border-l border-subtle")}
    >
      <span
        aria-hidden
        className={cn(
          "w-[42px] shrink-0 select-none px-1.5 text-right",
          type === "add"
            ? "bg-[var(--diff-add-gutter)] text-success-fg"
            : type === "del"
              ? "bg-[var(--diff-del-gutter)] text-critical-fg"
              : "text-[var(--code-line-number)]"
        )}
      >
        <span className="tnum inline-block w-6 text-right">{side === "left" ? l.oldLine ?? "" : l.newLine ?? ""}</span>
        <span className="inline-block w-2 text-center">{SIGN[type]}</span>
      </span>
      <code className="scroll-x whitespace-pre px-2 text-[var(--code-fg)]">
        <Tokens line={l} tokens={tokens?.[i]} />
      </code>
    </motion.div>
  );
}
