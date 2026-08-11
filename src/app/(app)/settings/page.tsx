import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { USE_FIXTURES } from "@/lib/api/config";
import { type EngineInfo } from "@/lib/api/engines";
import { enginesServer } from "@/lib/api/server-fetchers";
import { latestRunServer } from "@/lib/api/server-fetchers";
import { repositoryServer } from "@/lib/api/server-fetchers";
import type { QualityGate } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata = { title: "Settings" };

/**
 * Settings.
 *
 * ── WHY THIS SCREEN WAS THE WORST ONE ──
 *
 * It used to list six analyzers — Semgrep, Checkmarx SAST, ESLint, SonarQube,
 * Lighthouse, dependency audit — five of them marked "Enabled", each with a
 * rule count ("1,284 rules", "412 queries"). None of those numbers existed and
 * none of those engines ran. A user reading a clean result would have believed
 * their code had been through taint analysis and a dependency audit.
 *
 * The roster now comes from `GET /engines`, which reports what is implemented
 * and what is merely reserved. One engine is active. Saying so is the point.
 *
 * ── WHY NOTHING HERE IS EDITABLE ──
 *
 * There is no write endpoint. `RepositorySettings` exists on the schema, but
 * the repositories controller exposes no PATCH, so a toggle on this page could
 * not persist. A switch that silently does nothing is worse than a value the
 * screen admits is read-only.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const { repo } = await searchParams;

  const [engines, run, repository] = await Promise.all([
    USE_FIXTURES ? Promise.resolve(null) : enginesServer(),
    repo && !USE_FIXTURES ? latestRunServer(repo) : Promise.resolve(null),
    repo && !USE_FIXTURES ? repositoryServer(repo) : Promise.resolve(null),
  ]);

  const active = engines?.filter((e) => e.status === "active") ?? [];
  const planned = engines?.filter((e) => e.status === "planned") ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Settings</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          Read-only. Nothing on this screen can be changed yet — there is no endpoint to save it
          to.
        </p>

        <section className="mt-4">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Analysis engines</Eyebrow>
            {engines ? (
              <span className="tnum text-2xs text-fg-faint">
                {active.length} of {engines.length} running
              </span>
            ) : null}
          </div>

          {!engines ? (
            <p className="mt-1.5 rounded-lg border border-subtle bg-surface px-3 py-3 text-2xs text-fg-muted">
              The API did not respond, so the engine list is not shown. It is deliberately not
              filled in from a default — which engines ran is exactly the thing this screen must
              not guess about.
            </p>
          ) : (
            <>
              <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
                {active.map((e) => (
                  <EngineRow key={e.id} engine={e} />
                ))}
              </ul>

              <p className="mt-3 text-2xs text-fg-faint">
                Not implemented yet — these do not run, and no finding on any screen came from
                them.
              </p>
              <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface opacity-70">
                {planned.map((e) => (
                  <EngineRow key={e.id} engine={e} />
                ))}
              </ul>
            </>
          )}
        </section>

        {run?.gate ? (
          <section className="mt-4">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Quality gate</Eyebrow>
              <span className="text-2xs text-fg-faint">
                {repository?.name ?? "this project"} · as evaluated on the last run
              </span>
            </div>
            <GateThresholds gate={run.gate} />
          </section>
        ) : null}

        <section className="mt-4">
          <Eyebrow>Design system</Eyebrow>
          <Link
            href="/tokens"
            className="mt-1.5 flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2.5 hover:bg-hover"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg">Token swatch sheet</p>
              <p className="text-2xs text-fg-muted">
                Every semantic token in both themes, with contrast ratios.
              </p>
            </div>
            <ArrowUpRight size={13} className="shrink-0 text-fg-faint" aria-hidden />
          </Link>
        </section>

        <div className="h-6" />
      </div>
    </div>
  );
}

function EngineRow({ engine }: { engine: EngineInfo }) {
  const on = engine.status === "active";
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: on ? "var(--sev-success)" : "var(--text-faint)" }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">{engine.displayName}</p>
        <p className="text-2xs text-fg-muted">{engine.note}</p>
      </div>
      <span className="tnum shrink-0 font-mono text-2xs text-fg-faint">
        {engine.ruleCount != null ? pluralize(engine.ruleCount, "rule") : "—"}
      </span>
      <span
        className="w-16 shrink-0 text-right text-2xs"
        style={{ color: on ? "var(--sev-success-fg)" : "var(--text-faint)" }}
      >
        {on ? "Running" : "Planned"}
      </span>
    </li>
  );
}

/**
 * The thresholds that were actually applied, read back off the last run's gate
 * rather than from a defaults table. If an operator has customised a repo's
 * thresholds, this shows the customised value, because it is reporting what
 * happened rather than what is configured somewhere.
 */
function GateThresholds({ gate }: { gate: QualityGate }) {
  return (
    <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
      {gate.conditions.map((c) => (
        <li key={c.metric} className="flex items-center gap-3 px-3 py-2.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background: c.status === "passed" ? "var(--sev-success)" : "var(--sev-critical)",
            }}
          />
          <p className="min-w-0 flex-1 truncate text-sm text-fg">{c.metric}</p>
          <span className="tnum shrink-0 font-mono text-2xs text-fg-muted">
            fails if {c.operator === "<=" ? ">" : c.operator === ">=" ? "<" : "not"} {c.threshold}
            {c.unit ?? ""}
          </span>
          <span
            className="tnum w-16 shrink-0 text-right text-2xs"
            style={{
              color: c.status === "passed" ? "var(--sev-success-fg)" : "var(--sev-critical-fg)",
            }}
          >
            was {c.actual}
            {c.unit ?? ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
