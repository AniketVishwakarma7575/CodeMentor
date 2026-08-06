import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata = { title: "Settings" };

const ENGINES = [
  { name: "Semgrep", rules: "1,284 rules", on: true, note: "OSS ruleset + 12 custom" },
  { name: "Checkmarx SAST", rules: "412 queries", on: true, note: "taint analysis, JS/TS" },
  { name: "ESLint", rules: "176 rules", on: true, note: "from repo .eslintrc" },
  { name: "SonarQube", rules: "631 rules", on: true, note: "Sonar way, quality gate enforced" },
  { name: "Lighthouse", rules: "Web vitals", on: false, note: "no web entrypoint detected" },
  { name: "Dependency audit", rules: "OSV + GHSA", on: true, note: "runs on lockfile change" },
];

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-5 py-4">
        <h1 className="text-lg font-semibold tracking-[-0.011em] text-fg">Settings</h1>

        <section className="mt-4">
          <Eyebrow>Analysis engines</Eyebrow>
          <ul className="mt-1.5 divide-y divide-[var(--border-subtle)] rounded-lg border border-subtle bg-surface">
            {ENGINES.map((e) => (
              <li key={e.name} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: e.on ? "var(--sev-success)" : "var(--text-faint)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">{e.name}</p>
                  <p className="text-2xs text-fg-muted">{e.note}</p>
                </div>
                <span className="tnum shrink-0 font-mono text-2xs text-fg-faint">{e.rules}</span>
                <span
                  className="w-16 shrink-0 text-right text-2xs"
                  style={{ color: e.on ? "var(--sev-success-fg)" : "var(--text-faint)" }}
                >
                  {e.on ? "Enabled" : "Disabled"}
                </span>
              </li>
            ))}
          </ul>
        </section>

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
      </div>
    </div>
  );
}
