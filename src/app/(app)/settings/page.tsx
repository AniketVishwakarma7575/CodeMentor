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
import { Tier2Toggle } from "@/components/settings/tier2-toggle";

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
 * and what is merely reserved. Reporting that honestly is the whole point of
 * the screen — in BOTH directions. It has been wrong each way: it once claimed
 * six analyzers ran when one did, and later reported a fully-working engine as
 * unbuilt because nobody updated its row. The count in the header is derived
 * from the same response the rows are, so the two cannot disagree.
 *
 * ── WHAT IS EDITABLE, AND WHAT IS NOT ──
 *
 * Almost nothing, still — and that is honest rather than unfinished. The gate
 * thresholds shown below are read back off the last RUN, so editing them here
 * would retroactively change what past runs are reported to have meant; that
 * needs an endpoint with its own thinking about history.
 *
 * The exception is the tier-2 opt-in, which now has a real write behind it
 * (`PATCH /repositories/:id/settings`). It had to: the engine registry renders
 * a row telling the reader ESLint "stays off until the repository opts in",
 * and until that endpoint existed the product offered no way to perform the
 * opt-in it was instructing them to perform. An instruction the reader cannot
 * follow is worse than a missing feature.
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
  // Implemented but inert. Kept in its own group rather than lumped with
  // `planned`, because the two call for opposite responses: one is waiting on
  // the reader to supply a key, the other on us to write the adapter.
  const configured = engines?.filter((e) => e.status === "configured") ?? [];
  const planned = engines?.filter((e) => e.status === "planned") ?? [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Settings</h1>
        <p className="mt-0.5 text-sm text-fg-muted">
          Mostly a report of what actually ran. The one thing you can change here is whether a
          project is allowed to have its own toolchain executed — everything else is read back off
          the last analysis.
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

              {configured.length > 0 ? (
                <>
                  <p className="mt-3 text-2xs text-fg-faint">
                    Built, but switched off — these did not run on the last analysis. Each row says
                    what it is waiting for: a credential, a binary on PATH, or an explicit opt-in
                    for an engine that executes the analysed project&rsquo;s own code.
                  </p>
                  <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
                    {configured.map((e) => (
                      <EngineRow key={e.id} engine={e} />
                    ))}
                  </ul>
                </>
              ) : null}

              {/*
                ⚠️ GUARDED, like `configured` above — and it did not used to be.
                   The caption and the bordered list rendered unconditionally,
                   so the moment the last `planned` engine shipped, this screen
                   drew the heading "Not implemented yet" over an empty box.
                   An empty list under that sentence reads as a rendering
                   failure, not as good news.
              */}
              {planned.length > 0 ? (
                <>
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
              ) : null}
            </>
          )}
        </section>

        {/*
          The one writable control on this screen, and it only appears with a
          project in scope — `allowTier2` is per repository, so a global
          version of it would be a switch with no subject.
        */}
        {repository ? (
          <section className="mt-4">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Running the project&rsquo;s own toolchain</Eyebrow>
              <span className="text-2xs text-fg-faint">tier 2 · per project</span>
            </div>
            <Tier2Toggle
              repoId={repository.id}
              repoName={repository.name}
              initial={repository.allowTier2}
            />
          </section>
        ) : null}

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

/**
 * One engine.
 *
 * Three states, three labels — and the dot is never the only signal, because a
 * reader in greyscale must still be able to tell "ran" from "did not run".
 * `configured` gets its own amber dot rather than the green one: it is not
 * running, and a green dot next to an engine that produced nothing is the
 * original lie in a smaller font.
 */
function EngineRow({ engine }: { engine: EngineInfo }) {
  const on = engine.status === "active";
  /*
   * "Off", not "Needs key" — `configured` covers three different blockers now
   * and only one of them is a credential. Semgrep needs a binary on PATH and
   * ESLint needs a deliberate opt-in, because it is the one engine that
   * executes code from the analysed repository. Labelling that row "Needs key"
   * would send a reader looking for an API key that does not exist, and would
   * hide the fact that the switch is a security decision rather than a
   * missing value. The row's note carries the specific answer.
   */
  const label = on ? "Running" : engine.status === "configured" ? "Off" : "Planned";
  const colour = on
    ? "var(--sev-success)"
    : engine.status === "configured"
      ? "var(--sev-medium)"
      : "var(--text-faint)";
  const textColour = on
    ? "var(--sev-success-fg)"
    : engine.status === "configured"
      ? "var(--sev-medium-fg)"
      : "var(--text-faint)";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: colour }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">{engine.displayName}</p>
        <p className="text-2xs text-fg-muted">{engine.note}</p>
      </div>
      <span className="tnum shrink-0 font-mono text-2xs text-fg-faint">
        {engine.ruleCount != null ? pluralize(engine.ruleCount, "rule") : "—"}
      </span>
      <span className="w-16 shrink-0 text-right text-2xs" style={{ color: textColour }}>
        {label}
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
