/* ============================================================================
   Domain model.
   Deliberately shaped after the tools engineers already trust, so the UI can
   speak a vocabulary a senior reviewer recognises in the first ten seconds:

     SonarQube  → quality gate (pass/fail w/ conditions), A–E ratings per
                  dimension, issue *type* (bug / vulnerability / code smell /
                  security hotspot), technical debt as remediation *time*,
                  duplication and coverage as first-class metrics, rule keys.
     ESLint     → stable rule ids, error|warn severity, `fixable` flag, and the
                  distinction between an auto-fixable patch and a suggestion.
     Checkmarx  → SAST taint analysis: an ordered source → sanitiser? → sink
                  data-flow trace, CWE + OWASP mapping, confidence score.
     CodeRabbit → conversational review: a committable suggestion block, a
                  one-line summary, and per-finding threads.
     Lighthouse → 0–100 weighted category scores, banded (0-49 / 50-89 / 90+),
                  and "opportunities" carrying an estimated saving.
   ========================================================================== */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/** SonarQube's issue taxonomy — what *kind* of debt this is. */
export type IssueType = "vulnerability" | "bug" | "code-smell" | "security-hotspot";

/**
 * Which analyzer produced the finding. Attribution builds trust.
 *
 * ⚠️ MUST stay in sync with codementor-backend/src/shared/types/domain.ts.
 *    A value here that the backend does not emit is dead code; a value the
 *    backend emits that is missing here renders as `undefined` in the UI,
 *    because `engineLabel` in utils.ts is a lookup with no fallback.
 *
 * ⚠️ `checkmarx` and `sonarqube` were removed deliberately. We do not run those
 *    products — labelling a Semgrep finding "Checkmarx SAST" is trademark
 *    misuse. `semgrep` and `sonarjs` are what actually runs.
 */
export type Engine =
  | "codementor-ai"
  | "semgrep"
  | "eslint"
  | "sonarjs"
  | "jscpd"
  | "gitleaks"
  | "osv"
  | "lighthouse";

export type FindingStatus = "open" | "applied" | "dismissed" | "snoozed";

export type Confidence = number; // 0–100

export interface DataFlowStep {
  /** Ordered taint-trace node, Checkmarx-style. */
  kind: "source" | "propagator" | "sanitizer" | "sink";
  file: string;
  line: number;
  symbol: string;
  snippet: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  /** `passed` renders a tick; `failed` a cross; `skipped` a dash. Never a colour alone. */
  state: "passed" | "failed" | "skipped" | "running";
  detail?: string;
}

export interface FixPatch {
  language: string;
  /** Unified-diff hunks. `startLine` is the line number of the first row. */
  startLine: number;
  lines: DiffLine[];
  /** CodeRabbit-style: can this be committed as-is from the UI? */
  committable: boolean;
  /** ESLint-style: produced by `--fix` (mechanical) vs. an AI suggestion. */
  autoFixable: boolean;
}

export interface DiffLine {
  type: "add" | "del" | "ctx" | "hunk";
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface LearningTeaser {
  conceptId: string;
  concept: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readMinutes: number;
  /** "3rd time you've hit this" — the recurrence hook. */
  occurrence: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  type: IssueType;
  engine: Engine;
  /** e.g. `security/detect-sql-injection`, `S3649`, `no-eval`. */
  ruleKey: string;
  category: string;
  cwe?: { id: string; title: string };
  owasp?: string;
  file: string;
  line: number;
  endLine?: number;
  column?: number;
  confidence: Confidence;
  /** SonarQube remediation effort, in minutes. */
  effortMinutes: number;
  title: string;
  /** The three-column body. Short. Each under ~200 chars. */
  whatsWrong: string;
  whyItMatters: string;
  ifIgnored: string;
  /** Progressive disclosure: only rendered when the card is expanded. */
  deepDive?: string;
  dataFlow?: DataFlowStep[];
  fix?: FixPatch;
  verification: VerificationCheck[];
  tradeOff?: string;
  learning?: LearningTeaser;
  status: FindingStatus;
  /** Was this introduced by the diff under review, or pre-existing? */
  isNew: boolean;
  firstSeen?: string;
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "dir";
  language?: string;
  loc?: number;
  findings?: number;
  worst?: Severity;
  /** Sonar-style per-file metrics. */
  coverage?: number;
  duplication?: number;
  children?: FileNode[];
}

/* -- scoring ---------------------------------------------------------------- */

export type Rating = "A" | "B" | "C" | "D" | "E";

export interface Dimension {
  key: string;
  label: string;
  score: number; // 0–100
  rating: Rating;
  /** Weight in the composite score — Lighthouse-style weighting. */
  weight: number;
  delta: number;
  /** The product's rule: never state a number without stating why it moved. */
  reason: string;
}

export interface QualityGateCondition {
  metric: string;
  operator: ">" | "<" | ">=" | "<=";
  threshold: number;
  actual: number;
  unit?: string;
  status: "passed" | "failed";
}

export interface QualityGate {
  status: "passed" | "failed";
  conditions: QualityGateCondition[];
}

export interface RepoScore {
  overall: number;
  delta: number;
  baseline: string;
  rating: Rating;
  gate: QualityGate;
  dimensions: Dimension[];
  /** Sonar-style aggregates. */
  debtMinutes: number;
  debtRatio: number;
  coverage: number;
  duplication: number;
  loc: number;
}

/* -- runs ------------------------------------------------------------------- */

export type StageStatus = "pending" | "active" | "complete" | "degraded" | "failed";

export interface RunStage {
  id: string;
  label: string;
  engine?: Engine;
  status: StageStatus;
  /** Milliseconds. Null while pending. */
  durationMs: number | null;
  findings: number;
  note?: string;
}

export interface RunLogLine {
  t: number;
  level: "info" | "warn" | "error";
  stage: string;
  message: string;
}

/* -- learning --------------------------------------------------------------- */

export interface Concept {
  id: string;
  title: string;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readMinutes: number;
  mastery: "not-started" | "learning" | "practising" | "mastered";
  timesHit: number;
  summary: string;
  keyPoints: string[];
  vulnerable: { language: string; code: string };
  safe: { language: string; code: string };
  question: { prompt: string; options: string[]; answerIndex: number; explain: string };
  relatedCwe?: string;
}

export interface SkillSignal {
  concept: string;
  conceptId: string;
  trend: "improving" | "flat" | "regressing";
  occurrences: number;
  changePct: number;
}
