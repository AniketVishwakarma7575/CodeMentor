import type { Concept } from "@/lib/types";

/* ============================================================================
   Learning — concepts, and how often this repository has hit each of them.

   Mirrors codementor-backend/src/modules/learning/learning.module.ts.

   ── TWO SOURCES, DELIBERATELY ──

   `concepts` is editorial content: seeded in the backend's source, identical
   for every install, and true regardless of what the user has analysed. It is
   version-controlled prose, not data.

   `signals` is measurement: per-repository occurrence counts read out of
   `finding_history`, where every run does `$inc: { occurrences: 1 }`.

   The screen must not blur them. A concept's `timesHit` in the seed is a
   placeholder for the fixture — the real count for a repository lives only in
   the matching signal, and a concept with no signal has not been hit here at
   all, which is a fact worth showing rather than a zero to hide.
   ========================================================================== */

export interface SkillSignal {
  concept: string;
  conceptId: string;
  trend: "improving" | "flat" | "regressing";
  /** All-time occurrences of this concept in this repository. */
  occurrences: number;
  changePct: number;
  /** Occurrences in the last 30 days, and in the 30 before that. */
  recent: number;
  prior: number;
}

