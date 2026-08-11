"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import type { RunStage } from "@/lib/types";

/* ============================================================================
   Stage status glyph.

   Shared by the run screen (a stage list that is still moving) and the review
   screen's empty state (the same list, after the fact). One definition, because
   these are the marks that say whether an engine actually ran — if "degraded"
   looked like a tick in one place and a warning in the other, the two screens
   would be telling the user different things about the same run.
   ========================================================================== */

export function StageGlyph({ status }: { status: RunStage["status"] }) {
  if (status === "complete") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <Check size={12} style={{ color: "var(--sev-success)" }} aria-hidden />
        <span className="sr-only">Complete</span>
      </span>
    );
  }
  if (status === "degraded") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <AlertTriangle size={11} style={{ color: "var(--sev-medium)" }} aria-hidden />
        <span className="sr-only">Degraded</span>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <X size={12} style={{ color: "var(--sev-critical)" }} aria-hidden />
        <span className="sr-only">Failed</span>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
        <span className="h-[7px] w-[7px] rounded-full bg-[var(--text-primary)]" />
        <span className="sr-only">Running</span>
      </span>
    );
  }
  return (
    <span className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas">
      <span className="h-[6px] w-[6px] rounded-full border border-[var(--border-strong)]" />
      <span className="sr-only">Pending</span>
    </span>
  );
}
