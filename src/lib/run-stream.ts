import type { Finding, RunLogLine, RunStage } from "./types";
import { FINDINGS } from "@/data/findings";

/* ============================================================================
   Run stream.

   Shaped exactly like the SSE contract it stands in for:

     const es = new EventSource(`/api/runs/${id}/events`);
     es.addEventListener('stage',   …)
     es.addEventListener('finding', …)
     es.addEventListener('log',     …)
     es.addEventListener('done',    …)

   SSE rather than WebSockets because this is strictly one-directional — the
   client never sends anything back except a cancel, which is a plain DELETE.
   Swapping the simulator for a real EventSource is a change to this file only.
   ========================================================================== */

export const STAGE_TEMPLATE: Omit<RunStage, "status" | "durationMs" | "findings">[] = [
  { id: "clone", label: "Cloning repository" },
  { id: "detect", label: "Detecting languages" },
  { id: "static", label: "Static analysis", engine: "eslint" },
  { id: "security", label: "Security scan", engine: "checkmarx" },
  { id: "complexity", label: "Complexity & duplication", engine: "sonarqube" },
  { id: "ai", label: "AI review", engine: "codementor-ai" },
  { id: "verify", label: "Verifying fixes" },
  { id: "score", label: "Scoring" },
];

/** Milliseconds each stage takes, and which findings it emits. */
const SCRIPT: {
  id: string;
  ms: number;
  findingIds: string[];
  /** A stage that half-works: reports, warns, and does not stop the run. */
  degrade?: string;
  logs: [number, RunLogLine["level"], string][];
}[] = [
  {
    id: "clone",
    ms: 3400,
    findingIds: [],
    logs: [
      [0, "info", "git clone --depth 50 git@github.com:acme/checkout-service"],
      [0.6, "info", "HEAD at e91c4ad (feat/order-search)"],
      [0.9, "info", "312 files, 48,219 lines"],
    ],
  },
  {
    id: "detect",
    ms: 1800,
    findingIds: [],
    logs: [
      [0.2, "info", "javascript 71.4% · sql 12.9% · yaml 8.1% · other 7.6%"],
      [0.8, "info", "resolved 1,284 rules for the detected stack"],
    ],
  },
  {
    id: "static",
    ms: 7600,
    findingIds: ["f-8", "f-6"],
    logs: [
      [0.1, "info", "eslint --format json --max-warnings 0"],
      [0.5, "warn", "max-len src/routes/orders.js:80 (428 chars)"],
      [0.9, "info", "176 rules · 2 findings"],
    ],
  },
  {
    id: "security",
    ms: 16400,
    findingIds: ["f-1", "f-2", "f-3", "f-5"],
    logs: [
      [0.1, "info", "checkmarx sast · taint analysis"],
      [0.35, "error", "CWE-89 src/routes/orders.js:15 source req.params.id → sink pool.query"],
      [0.55, "error", "CWE-89 src/routes/orders.js:83"],
      [0.72, "error", "CWE-798 src/routes/orders.js:47"],
      [0.9, "error", "CWE-79 src/routes/orders.js:42"],
    ],
  },
  {
    id: "complexity",
    ms: 9200,
    findingIds: ["f-7", "f-4"],
    degrade:
      "Duplication index timed out after 8s. Complexity and the issue set are complete; the duplication figure is carried over from the previous run.",
    logs: [
      [0.2, "info", "cognitive complexity: createOrder = 34 (threshold 15)"],
      [0.7, "warn", "duplication indexer exceeded 8000ms budget — falling back to cached value"],
      [0.95, "info", "stage completed with 1 degraded sub-task"],
    ],
  },
  {
    id: "ai",
    ms: 18300,
    findingIds: [],
    logs: [
      [0.1, "info", "context: 8 findings, 4,218 lines, 3 prior occurrences for this author"],
      [0.4, "info", "drafting explanations and fixes"],
      [0.85, "info", "8 explanations · 8 patches · 6 linked concepts"],
    ],
  },
  {
    id: "verify",
    ms: 4900,
    findingIds: [],
    logs: [
      [0.2, "info", "applying patches to a scratch worktree"],
      [0.5, "info", "8/8 apply · 8/8 parse · 7/8 lint clean"],
      [0.85, "warn", "f-4 introduces an undefined identifier `argon2` — flagged on the card"],
    ],
  },
  {
    id: "score",
    ms: 900,
    findingIds: [],
    logs: [[0.5, "info", "quality gate FAILED — 4 of 5 conditions not met"]],
  },
];

export interface RunEvent {
  type: "stage" | "finding" | "log" | "done";
  stage?: RunStage;
  finding?: Finding;
  log?: RunLogLine;
  score?: number;
}

export function initialStages(): RunStage[] {
  return STAGE_TEMPLATE.map((s) => ({ ...s, status: "pending", durationMs: null, findings: 0 }));
}

export const TOTAL_MS = SCRIPT.reduce((a, s) => a + s.ms, 0);

/**
 * Drives the scripted run. `speed` compresses wall-clock so the screen is
 * demonstrable — the event ordering and the shape of each payload are exactly
 * what the server emits.
 */
export function subscribeToRun(
  onEvent: (e: RunEvent) => void,
  opts: { speed?: number } = {}
): () => void {
  const speed = opts.speed ?? 1;
  const timers: number[] = [];
  let elapsed = 0;
  const started = performance.now();

  for (const stage of SCRIPT) {
    const stageStart = elapsed;
    const stageEnd = elapsed + stage.ms;

    timers.push(
      window.setTimeout(() => {
        onEvent({
          type: "stage",
          stage: {
            ...STAGE_TEMPLATE.find((s) => s.id === stage.id)!,
            status: "active",
            durationMs: null,
            findings: 0,
          },
        });
      }, stageStart / speed)
    );

    for (const [at, level, message] of stage.logs) {
      timers.push(
        window.setTimeout(
          () => onEvent({ type: "log", log: { t: performance.now() - started, level, stage: stage.id, message } }),
          (stageStart + stage.ms * at) / speed
        )
      );
    }

    // Findings arrive spread through the stage, not dumped at its end. That is
    // the whole point of the screen: the wait is the product working.
    stage.findingIds.forEach((id, i) => {
      const finding = FINDINGS.find((f) => f.id === id);
      if (!finding) return;
      const at = stageStart + stage.ms * (0.28 + (0.62 * i) / Math.max(1, stage.findingIds.length - 1 || 1));
      timers.push(window.setTimeout(() => onEvent({ type: "finding", finding }), at / speed));
    });

    timers.push(
      window.setTimeout(() => {
        onEvent({
          type: "stage",
          stage: {
            ...STAGE_TEMPLATE.find((s) => s.id === stage.id)!,
            status: stage.degrade ? "degraded" : "complete",
            durationMs: stage.ms,
            findings: stage.findingIds.length,
            note: stage.degrade,
          },
        });
      }, stageEnd / speed)
    );

    elapsed = stageEnd;
  }

  timers.push(window.setTimeout(() => onEvent({ type: "done", score: 34 }), (elapsed + 200) / speed));

  return () => timers.forEach((t) => window.clearTimeout(t));
}
