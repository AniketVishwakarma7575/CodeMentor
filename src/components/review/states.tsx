"use client";

import Link from "next/link";
import { AlertTriangle, Check, RotateCcw, ShieldCheck } from "lucide-react";
import { Button, Eyebrow, Skeleton } from "@/components/ui/primitives";

/* ============================================================================
   Empty state.

   "No issues found" is the moment the user decides whether to trust the tool.
   A blank page with a grey icon says "we did not look". So this state shows the
   *evidence*: what ran, how long it took, how much it covered, and what it
   deliberately did not check. It reads as a verdict with a signature on it.
   ========================================================================== */

export function NoFindings({
  file,
  onRerun,
}: {
  file: string;
  onRerun?: () => void;
}) {
  const engines = [
    { name: "Semgrep", rules: 1_284, time: "6.2s" },
    { name: "Checkmarx SAST", rules: 412, time: "18.9s" },
    { name: "ESLint", rules: 176, time: "2.1s" },
    { name: "SonarQube", rules: 631, time: "11.4s" },
    { name: "CodeMentor AI", rules: 0, time: "23.8s" },
  ];

  return (
    <div className="flex h-full flex-col items-start justify-center px-8 py-10">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--sev-success)" }} aria-hidden />
          <h2 className="text-md font-medium text-fg">No findings in this file</h2>
        </div>

        <p className="mt-1.5 text-sm leading-[1.6] text-fg-secondary">
          <span className="font-mono text-xs text-fg">{file}</span> was analysed against 2,503 rules
          across five engines. Nothing above the <span className="text-fg">info</span> threshold was
          reachable.
        </p>

        <dl className="mt-4 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
          {engines.map((e) => (
            <div key={e.name} className="flex h-8 items-center gap-2 px-3">
              <Check size={12} style={{ color: "var(--sev-success)" }} aria-hidden />
              <dt className="text-sm text-fg-secondary">{e.name}</dt>
              <dd className="tnum ml-auto flex items-center gap-3 font-mono text-2xs text-fg-faint">
                {e.rules > 0 ? <span>{e.rules.toLocaleString()} rules</span> : <span>full-file review</span>}
                <span className="w-10 text-right">{e.time}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 rounded-lg border border-subtle bg-canvas px-3 py-2.5">
          <Eyebrow>Not covered</Eyebrow>
          <p className="mt-1 text-sm leading-[1.5] text-fg-muted">
            Runtime behaviour, third-party service configuration, and anything behind a feature flag
            that was off at analysis time. A clean file is not a proof.
          </p>
        </div>

        {onRerun ? (
          <div className="mt-4 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRerun}>
              <RotateCcw size={12} aria-hidden />
              Re-run analysis
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/insights">See repository trend</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -- nothing selected ------------------------------------------------------- */

export function NoSelection({ count }: { count: number }) {
  return (
    <div className="flex h-full flex-col items-start justify-center px-6">
      <p className="text-sm text-fg-secondary">
        {count} findings in this file.
      </p>
      <p className="mt-1 text-sm text-fg-muted">
        Pick one in the code, or press <kbd className="font-mono text-fg">j</kbd> to start at the
        most severe.
      </p>
    </div>
  );
}

/* -- error ------------------------------------------------------------------ */

export function AnalyzerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} style={{ color: "var(--sev-high)" }} aria-hidden />
          <h2 className="text-md font-medium text-fg">Could not load this finding</h2>
        </div>
        <p className="mt-1.5 text-sm leading-[1.6] text-fg-secondary">
          The detail service returned <span className="font-mono text-xs">503</span> after 3
          attempts. The findings list is served from cache and is still accurate as of the last
          successful run.
        </p>
        <div className="mt-3 rounded-md border border-subtle bg-inset px-3 py-2 font-mono text-2xs leading-[1.6] text-fg-muted">
          <div>trace_id 9f2c14be-7ad0-4c11</div>
          <div>upstream findings-detail.prod</div>
          <div>last_ok 2026-08-06T09:14:22Z</div>
        </div>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            <RotateCcw size={12} aria-hidden />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* -- loading ---------------------------------------------------------------- */
/* Shaped like the finding card it replaces: meta row, title, three columns,
   diff block, verification row. A spinner here would tell the user nothing. */

export function FindingSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading finding detail</span>
      <div className="border-b border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[20px] w-16 rounded-sm" />
          <Skeleton className="h-[10px] w-20" />
          <Skeleton className="h-[10px] w-14" />
        </div>
        <Skeleton className="mt-2.5 h-4 w-[70%]" />
        <Skeleton className="mt-1.5 h-[10px] w-[45%]" />
      </div>
      <div className="grid grid-cols-1 border-b border-subtle xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5 px-4 py-3">
            <Skeleton className="h-[9px] w-16" />
            <Skeleton className="h-[11px] w-full" />
            <Skeleton className="h-[11px] w-[85%]" />
          </div>
        ))}
      </div>
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-[9px] w-20" />
        <Skeleton className="h-[120px] w-full rounded-md" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[10px] w-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
