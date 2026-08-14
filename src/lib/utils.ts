import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Engine, Rating, Severity } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------------------------------------------------------------------
   Severity presentation.
   Colour is never the only channel. Every severity carries a distinct GLYPH
   and a written LABEL, so the ladder survives deuteranopia, protanopia,
   greyscale printing, and a Slack screenshot at 40% scale.

   The glyphs are also shape-ranked: filled octagon > filled triangle >
   filled diamond > hollow dot > hollow circle. Shape alone tells you the
   order even with the colour channel entirely removed.
   ------------------------------------------------------------------------- */

export const severityMeta: Record<
  Severity,
  {
    label: string;
    short: string;
    /** lucide icon name — resolved in components/severity-icon.tsx */
    icon: "octagon" | "triangle" | "diamond" | "dot" | "info";
    /** rank for sorting; lower is worse */
    rank: number;
    fg: string;
    bg: string;
    bd: string;
    base: string;
  }
> = {
  critical: {
    label: "Critical",
    short: "CRIT",
    icon: "octagon",
    rank: 0,
    fg: "text-critical-fg",
    bg: "bg-critical-bg",
    bd: "border-critical-bd",
    base: "bg-critical",
  },
  high: {
    label: "High",
    short: "HIGH",
    icon: "triangle",
    rank: 1,
    fg: "text-high-fg",
    bg: "bg-high-bg",
    bd: "border-high-bd",
    base: "bg-high",
  },
  medium: {
    label: "Medium",
    short: "MED",
    icon: "diamond",
    rank: 2,
    fg: "text-medium-fg",
    bg: "bg-medium-bg",
    bd: "border-medium-bd",
    base: "bg-medium",
  },
  low: {
    label: "Low",
    short: "LOW",
    icon: "dot",
    rank: 3,
    fg: "text-low-fg",
    bg: "bg-low-bg",
    bd: "border-low-bd",
    base: "bg-low",
  },
  info: {
    label: "Info",
    short: "INFO",
    icon: "info",
    rank: 4,
    fg: "text-info-fg",
    bg: "bg-info-bg",
    bd: "border-info-bd",
    base: "bg-info",
  },
};

export const severityVar: Record<Severity, string> = {
  critical: "var(--sev-critical)",
  high: "var(--sev-high)",
  medium: "var(--sev-medium)",
  low: "var(--sev-low)",
  info: "var(--sev-info)",
};

/* -- score presentation ----------------------------------------------------- */

/** Lighthouse banding: 0–49 fail, 50–89 needs work, 90–100 good. */
export function scoreBand(score: number): Severity | "success" {
  if (score >= 90) return "success";
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  if (score >= 30) return "high";
  return "critical";
}

export function scoreColorVar(score: number) {
  const band = scoreBand(score);
  return band === "success" ? "var(--sev-success)" : severityVar[band];
}

/** SonarQube A–E. */
export function ratingFromScore(score: number): Rating {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "E";
}

const RATING_COLOR: Record<Rating, string> = {
  A: "var(--sev-success)",
  B: "var(--sev-success)",
  C: "var(--sev-medium)",
  D: "var(--sev-high)",
  E: "var(--sev-critical)",
};

export function ratingColorVar(rating: Rating) {
  return RATING_COLOR[rating];
}

/* -- formatting ------------------------------------------------------------- */

/** SonarQube renders remediation effort as time, never as a raw count. */
export function formatDebt(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const days = Math.floor(minutes / (60 * 8));
  const hours = Math.floor((minutes % (60 * 8)) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDelta(n: number, unit = "") {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(n)}${unit}`;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Middle-truncate a path so both the repo-relative head and the filename stay
 * readable. A path 12 folders deep must never wrap or push the pane wider.
 */
export function truncatePath(path: string, maxSegments = 4) {
  const parts = path.split("/");
  if (parts.length <= maxSegments) return path;
  const head = parts.slice(0, 1);
  const tail = parts.slice(-(maxSegments - 1));
  return [...head, "…", ...tail].join("/");
}

export function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

export function dirName(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

/**
 * Display names, keyed by the `Engine` union in types.ts.
 *
 * ⚠️ Every Engine value MUST have an entry. A missing key renders as an empty
 *    string in the stage row and the finding list — silent, and easy to miss in
 *    review. `labelForEngine()` below is the safe accessor; prefer it.
 */
export const engineLabel: Record<Engine, string> = {
  "codementor-ai": "CodeMentor AI",
  semgrep: "Semgrep",
  eslint: "ESLint",
  sonarjs: "SonarJS",
  jscpd: "jscpd",
  gitleaks: "Gitleaks",
  osv: "OSV",
  lighthouse: "Lighthouse",
};

/** Never returns undefined — an unknown engine falls back to its raw id. */
export function labelForEngine(engine: string): string {
  return engineLabel[engine as Engine] ?? engine;
}

export const issueTypeLabel: Record<string, string> = {
  vulnerability: "Vulnerability",
  bug: "Bug",
  "code-smell": "Code smell",
  "security-hotspot": "Security hotspot",
};

/** Platform-correct modifier symbol, resolved after mount to avoid hydration drift. */
export function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
