import type { Finding, RunLogLine, RunStage } from "./types";
import { API_BASE, USE_FIXTURES } from "@/lib/api/config";

/* ============================================================================
   Run stream — the SSE seam.

     const es = new EventSource(`/api/v1/runs/${id}/events`);
     es.addEventListener('stage',   …)
     es.addEventListener('finding', …)
     es.addEventListener('log',     …)
     es.addEventListener('done',    …)

   SSE rather than WebSockets because this is strictly one-directional — the
   client never sends anything back except a cancel, which is a plain DELETE.

   The scripted simulator below is kept, not deleted: it is what renders the
   run screen when NEXT_PUBLIC_USE_FIXTURES=true (design work, offline, demos).
   ========================================================================== */

/**
 * ⚠️ MIRRORS the backend's `shared/types/run-events.ts:STAGE_TEMPLATE`. Both
 *    lists must stay identical — the orchestrator drives exactly this order.
 *
 * `engine` names a stage's engine only when it has exactly ONE. It is omitted
 * for `static`, which now runs the built-in rules, SonarJS, and — only if a
 * repository has opted in — ESLint. It used to say `eslint`, which named the
 * one engine in that stage least likely to have actually run.
 */
export const STAGE_TEMPLATE: Omit<RunStage, "status" | "durationMs" | "findings">[] = [
  { id: "clone", label: "Cloning repository" },
  { id: "detect", label: "Detecting languages" },
  { id: "static", label: "Static analysis" },
  { id: "security", label: "Security scan", engine: "semgrep" },
  { id: "complexity", label: "Complexity & duplication", engine: "jscpd" },
  { id: "ai", label: "AI review", engine: "codementor-ai" },
  { id: "verify", label: "Verifying fixes" },
  { id: "score", label: "Scoring" },
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

/** Rough expected wall-clock, used only to drive the top progress bar. */
export const TOTAL_MS = 62_400;

export interface SubscribeHandlers {
  onEvent: (e: RunEvent) => void;
  /** Connection lost / server unreachable. The stream may still recover. */
  onError?: (err: { message: string; willRetry: boolean }) => void;
  /** Fired once, after the `done` event or a fatal error. */
  onClose?: () => void;
}

/**
 * Subscribe to a live run.
 *
 * Returns an unsubscribe function. Call it on unmount — an EventSource that
 * outlives its component keeps the HTTP connection open and counts against the
 * browser's 6-per-origin limit.
 */
export function subscribeToRun(runId: string, handlers: SubscribeHandlers): () => void {
  if (USE_FIXTURES) return subscribeToMockRun(handlers.onEvent, { speed: 3.2 });

  const es = new EventSource(`${API_BASE}/runs/${runId}/events`, { withCredentials: true });
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    es.close();
    handlers.onClose?.();
  };

  const handle = (type: RunEvent["type"]) => (msg: MessageEvent<string>) => {
    let event: RunEvent;
    try {
      event = JSON.parse(msg.data) as RunEvent;
    } catch {
      // A malformed frame must not kill the stream — drop it and keep going.
      handlers.onError?.({ message: "Received a malformed event", willRetry: false });
      return;
    }
    handlers.onEvent(event);

    /**
     * ⚠️ THE SSE GOTCHA THAT COSTS EVERYONE AN AFTERNOON.
     *
     * When the server ends an SSE response, EventSource does NOT treat it as
     * "finished" — it treats it as a dropped connection and RECONNECTS, by
     * default after ~3s, forever. On reconnect the backend replays the whole
     * run, so findings arrive a second time and the run screen appears to
     * restart on a loop.
     *
     * Closing explicitly on `done` is the only thing that stops it.
     */
    if (type === "done") close();
  };

  es.addEventListener("stage", handle("stage") as EventListener);
  es.addEventListener("finding", handle("finding") as EventListener);
  es.addEventListener("log", handle("log") as EventListener);
  es.addEventListener("done", handle("done") as EventListener);

  es.onerror = () => {
    // readyState CONNECTING (0) means the browser is already retrying.
    // CLOSED (2) means it has given up — surface that as fatal.
    const willRetry = es.readyState === EventSource.CONNECTING;
    handlers.onError?.({
      message: willRetry ? "Connection lost — reconnecting…" : "Could not reach the run stream",
      willRetry,
    });
    if (!willRetry) close();
  };

  return close;
}

/* ── the scripted simulator, for USE_FIXTURES ─────────────────────────────── */

const SCRIPT: {
  id: string;
  ms: number;
  findingIds: string[];
  degrade?: string;
  logs: [number, RunLogLine["level"], string][];
}[] = [
  { id: "clone", ms: 3400, findingIds: [], logs: [[0.6, "info", "HEAD at e91c4ad"]] },
  { id: "detect", ms: 1800, findingIds: [], logs: [[0.2, "info", "javascript 71.4% · sql 12.9%"]] },
  {
    id: "static",
    ms: 7600,
    findingIds: ["f-8", "f-6"],
    logs: [[0.1, "info", "eslint --format sarif --max-warnings 0"]],
  },
  {
    id: "security",
    ms: 16400,
    findingIds: ["f-1", "f-2", "f-3", "f-5"],
    logs: [[0.35, "error", "CWE-89 src/routes/orders.js:15"]],
  },
  {
    id: "complexity",
    ms: 9200,
    findingIds: ["f-7", "f-4"],
    degrade:
      "Duplication index timed out after 8s. Complexity and the issue set are complete; the duplication figure is carried over from the previous run.",
    logs: [[0.7, "warn", "duplication indexer exceeded 8000ms budget"]],
  },
  { id: "ai", ms: 18300, findingIds: [], logs: [[0.85, "info", "8 explanations · 8 patches"]] },
  { id: "verify", ms: 4900, findingIds: [], logs: [[0.5, "info", "8/8 apply · 7/8 lint clean"]] },
  { id: "score", ms: 900, findingIds: [], logs: [[0.5, "info", "quality gate FAILED"]] },
];

export function subscribeToMockRun(
  onEvent: (e: RunEvent) => void,
  opts: { speed?: number } = {}
): () => void {
  const speed = opts.speed ?? 1;
  const timers: number[] = [];
  const started = performance.now();
  let elapsed = 0;

  // Imported lazily so the fixtures are tree-shaken out of a production build
  // where USE_FIXTURES is false.
  void import("@/data/findings").then(({ FINDINGS }) => {
    for (const stage of SCRIPT) {
      const meta = STAGE_TEMPLATE.find((s) => s.id === stage.id)!;
      const start = elapsed;
      const end = elapsed + stage.ms;

      timers.push(
        window.setTimeout(
          () =>
            onEvent({
              type: "stage",
              stage: { ...meta, status: "active", durationMs: null, findings: 0 },
            }),
          start / speed
        )
      );

      for (const [at, level, message] of stage.logs) {
        timers.push(
          window.setTimeout(
            () =>
              onEvent({
                type: "log",
                log: { t: performance.now() - started, level, stage: stage.id, message },
              }),
            (start + stage.ms * at) / speed
          )
        );
      }

      stage.findingIds.forEach((id, i) => {
        const finding = FINDINGS.find((f) => f.id === id);
        if (!finding) return;
        const at =
          start + stage.ms * (0.28 + (0.62 * i) / Math.max(1, stage.findingIds.length - 1 || 1));
        timers.push(window.setTimeout(() => onEvent({ type: "finding", finding }), at / speed));
      });

      timers.push(
        window.setTimeout(
          () =>
            onEvent({
              type: "stage",
              stage: {
                ...meta,
                status: stage.degrade ? "degraded" : "complete",
                durationMs: stage.ms,
                findings: stage.findingIds.length,
                note: stage.degrade,
              },
            }),
          end / speed
        )
      );

      elapsed = end;
    }

    timers.push(
      window.setTimeout(() => onEvent({ type: "done", score: 34 }), (elapsed + 200) / speed)
    );
  });

  return () => timers.forEach((t) => window.clearTimeout(t));
}
