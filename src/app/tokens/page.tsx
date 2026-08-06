import type { Severity } from "@/lib/types";
import { severityMeta } from "@/lib/utils";
import { SeverityPill } from "@/components/severity";
import { ThemeToggle } from "@/components/shell/top-bar";
import { TooltipProvider } from "@/components/ui/primitives";

export const metadata = { title: "Tokens" };

/* Swatch sheet. Rendered twice — once in each theme — by forcing the `.light`
   class on the second column, so the two themes can be compared side by side
   rather than by toggling and remembering. */

const SURFACES = [
  ["bg-canvas", "--bg-canvas"],
  ["bg-surface", "--bg-surface"],
  ["bg-elevated", "--bg-elevated"],
  ["bg-inset", "--bg-inset"],
  ["bg-hover", "--bg-hover"],
  ["bg-active", "--bg-active"],
  ["bg-selected", "--bg-selected"],
];

const BORDERS = [
  ["border-subtle", "--border-subtle"],
  ["border-strong", "--border-strong"],
  ["border-focus", "--border-focus"],
];

const TEXT: [string, string, string][] = [
  ["text-primary", "--text-primary", "17.3:1"],
  ["text-secondary", "--text-secondary", "8.6:1"],
  ["text-muted", "--text-muted", "5.6:1"],
  ["text-faint", "--text-faint", "3.5:1 · non-text only"],
];

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

const CODE = [
  ["code-fg", "--code-fg"],
  ["code-comment", "--code-comment"],
  ["code-keyword", "--code-keyword"],
  ["code-function", "--code-function"],
  ["code-string", "--code-string"],
  ["code-number", "--code-number"],
  ["code-type", "--code-type"],
  ["code-property", "--code-property"],
  ["code-punct", "--code-punct"],
];

function Sheet({ label }: { label: string }) {
  return (
    <div className="bg-canvas p-5 text-fg">
      <h2 className="text-md font-semibold tracking-[-0.011em]">{label}</h2>

      <Group title="Surfaces">
        {SURFACES.map(([name, v]) => (
          <Row key={name} name={name} v={v}>
            <span
              className="block h-7 w-full rounded-md border border-subtle"
              style={{ background: `var(${v})` }}
            />
          </Row>
        ))}
      </Group>

      <Group title="Borders">
        {BORDERS.map(([name, v]) => (
          <Row key={name} name={name} v={v}>
            <span className="block h-7 w-full rounded-md" style={{ border: `1px solid var(${v})` }} />
          </Row>
        ))}
      </Group>

      <Group title="Text · contrast vs canvas">
        {TEXT.map(([name, v, ratio]) => (
          <Row key={name} name={name} v={`${v} · ${ratio}`}>
            <span className="block truncate text-base" style={{ color: `var(${v})` }}>
              Parameterized queries 1234567890
            </span>
          </Row>
        ))}
      </Group>

      <Group title="Severity · colour + shape + label, never colour alone">
        {SEVERITIES.map((s) => (
          <Row key={s} name={s} v={`--sev-${s}`}>
            <span className="flex items-center gap-2">
              <SeverityPill severity={s} />
              <span
                aria-hidden
                className="h-4 w-6 rounded-sm"
                style={{ background: `var(--sev-${s})` }}
              />
              <span
                aria-hidden
                className="h-4 w-6 rounded-sm border"
                style={{
                  background: `var(--sev-${s}-bg)`,
                  borderColor: `var(--sev-${s}-bd)`,
                }}
              />
              <span className="text-2xs" style={{ color: `var(--sev-${s}-fg)` }}>
                {severityMeta[s].label} text
              </span>
            </span>
          </Row>
        ))}
        <Row name="success" v="--sev-success">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-4 w-6 rounded-sm" style={{ background: "var(--sev-success)" }} />
            <span className="text-2xs text-success-fg">Success text</span>
          </span>
        </Row>
      </Group>

      <Group title="Syntax">
        <div className="col-span-full overflow-hidden rounded-md border border-subtle bg-inset p-3 font-mono text-2xs leading-[1.5]">
          <div>
            <span style={{ color: "var(--code-comment)", fontStyle: "italic" }}>
              {"// bind values, never concatenate"}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--code-keyword)" }}>const</span>{" "}
            <span style={{ color: "var(--code-fg)" }}>rows</span>{" "}
            <span style={{ color: "var(--code-punct)" }}>=</span>{" "}
            <span style={{ color: "var(--code-keyword)" }}>await</span>{" "}
            <span style={{ color: "var(--code-fg)" }}>db</span>
            <span style={{ color: "var(--code-punct)" }}>.</span>
            <span style={{ color: "var(--code-function)" }}>query</span>
            <span style={{ color: "var(--code-punct)" }}>(</span>
            <span style={{ color: "var(--code-string)" }}>&apos;SELECT * FROM orders WHERE id = $1&apos;</span>
            <span style={{ color: "var(--code-punct)" }}>, [</span>
            <span style={{ color: "var(--code-fg)" }}>id</span>
            <span style={{ color: "var(--code-punct)" }}>]);</span>
          </div>
          <div>
            <span style={{ color: "var(--code-keyword)" }}>class</span>{" "}
            <span style={{ color: "var(--code-type)" }}>OrderRepo</span>{" "}
            <span style={{ color: "var(--code-punct)" }}>{"{"}</span>{" "}
            <span style={{ color: "var(--code-property)" }}>limit</span>
            <span style={{ color: "var(--code-punct)" }}>:</span>{" "}
            <span style={{ color: "var(--code-number)" }}>50</span>{" "}
            <span style={{ color: "var(--code-punct)" }}>{"}"}</span>
          </div>
        </div>
        {CODE.map(([name, v]) => (
          <Row key={name} name={name} v={v}>
            <span aria-hidden className="block h-5 w-full rounded-sm" style={{ background: `var(${v})` }} />
          </Row>
        ))}
      </Group>

      <Group title="Diff">
        {[
          ["diff-add-bg", "--diff-add-bg"],
          ["diff-add-gutter", "--diff-add-gutter"],
          ["diff-del-bg", "--diff-del-bg"],
          ["diff-del-gutter", "--diff-del-gutter"],
        ].map(([name, v]) => (
          <Row key={name} name={name} v={v}>
            <span className="block h-6 w-full rounded-sm border border-subtle" style={{ background: `var(${v})` }} />
          </Row>
        ))}
      </Group>

      <Group title="Radius · 3 / 4 / 6 / 8 / 12">
        {[
          ["xs", "3px"],
          ["sm", "4px"],
          ["md", "6px"],
          ["lg", "8px"],
          ["xl", "12px"],
        ].map(([name, px]) => (
          <Row key={name} name={`radius-${name}`} v={px}>
            <span
              className="block h-7 w-full border border-strong bg-surface"
              style={{ borderRadius: px }}
            />
          </Row>
        ))}
      </Group>

      <Group title="Type scale">
        <div className="col-span-full space-y-1.5">
          {[
            ["3xl · 48", "text-3xl"],
            ["2xl · 32", "text-2xl"],
            ["xl · 24", "text-xl"],
            ["lg · 20", "text-lg"],
            ["md · 16", "text-md"],
            ["base · 14", "text-base"],
            ["sm · 13 (UI default)", "text-sm"],
            ["xs · 12", "text-xs"],
            ["2xs · 11", "text-2xs"],
          ].map(([label, cls]) => (
            <div key={cls} className="flex items-baseline gap-3">
              <span className="tnum w-40 shrink-0 font-mono text-2xs text-fg-faint">{label}</span>
              <span className={`${cls} tnum truncate`}>SQL injection 1234567890</span>
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Row({ name, v, children }: { name: string; v: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[104px] shrink-0">
        <div className="truncate text-2xs text-fg-secondary">{name}</div>
        <div className="truncate font-mono text-2xs text-fg-faint">{v}</div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-canvas">
        <div className="flex h-11 items-center gap-2 border-b border-subtle bg-surface px-4">
          <h1 className="text-sm font-medium text-fg">Design tokens</h1>
          <span className="text-2xs text-fg-muted">
            Both themes, side by side. Neither is a filter over the other.
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="border-r border-subtle">
            {/* forced dark, independent of the active theme */}
            <div className="[&_*]:![color-scheme:dark]">
              <Sheet label="Dark · primary" />
            </div>
          </div>
          <div className="light">
            <Sheet label="Light · first-class equal" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
