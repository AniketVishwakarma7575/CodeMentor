import { ImageResponse } from "next/og";
import { getRunServer } from "@/lib/api/server-fetchers";
import { repositoryServer } from "@/lib/api/server-fetchers";
import { formatDebt } from "@/lib/utils";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CodeMentor AI analysis report";

/* ============================================================================
   Open Graph card.

   Designed for the place it will actually be seen: a Slack message, at roughly
   360px wide, next to nine other messages. Which means:
     • the score is enormous, because at 360px it is the only thing legible
     • the verdict is a word ("failed"), not a colour
     • the severity ladder is four labelled counts, not a chart
     • no gradient, no glass, same tokens as the product — the card should look
       like a screenshot of the tool, because that is what earns the click

   ── EVERYTHING HERE IS FROM THE RUN ──

   This card is the most quotable artefact the product makes: it gets pasted
   into channels, screenshotted, and read by people who will never open the
   report behind it. It used to render a fixed score of 34 for
   acme/checkout-service with a footer crediting four analyzers that do not
   run. When the id does not resolve, it now renders a card that says so rather
   than a confident number about nothing.
   ========================================================================== */

const SEVERITY_COLORS: [string, string][] = [
  ["critical", "#e5484d"],
  ["high", "#f76b15"],
  ["medium", "#ffb224"],
  ["low", "#7c88a0"],
];

export default async function Image({ params }: { params: { id: string } }) {
  const run = await getRunServer(params.id);
  const repository = run?.repoId ? await repositoryServer(run.repoId) : null;

  if (!run) return unavailable();

  const score = run.score ?? 0;
  const band = score >= 90 ? "#30a46c" : score >= 50 ? "#ffb224" : "#e5484d";
  const passed = run.gate?.status === "passed";
  const total = Object.values(run.findingCounts ?? {}).reduce((a, b) => a + b, 0);

  return new ImageResponse(
    (
      <div style={SHELL}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#858b96", letterSpacing: 1.5 }}>
            CODEMENTOR AI · ANALYSIS REPORT
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 600, letterSpacing: -1.2 }}>
            {repository?.name ?? "Disconnected project"}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#a9aeb8" }}>
            {run.branch}
            {run.commitSha && run.commitSha !== "local" ? ` · ${run.commitSha.slice(0, 7)}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span
                style={{
                  fontSize: 168,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: band,
                  letterSpacing: -6,
                }}
              >
                {run.score ?? "—"}
              </span>
              <span style={{ fontSize: 44, color: "#656a75" }}>/100</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: passed ? "#4cc38a" : "#ff6369",
                marginTop: 8,
              }}
            >
              {run.gate ? `Quality gate ${run.gate.status}` : "No quality gate evaluated"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 28, marginLeft: "auto", marginBottom: 12 }}>
            {SEVERITY_COLORS.filter(([key]) => (run.findingCounts?.[key] ?? 0) > 0).map(
              ([key, color]) => (
                <div
                  key={key}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}
                >
                  <span style={{ fontSize: 56, fontWeight: 600, color, lineHeight: 1 }}>
                    {run.findingCounts[key]}
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      color: "#858b96",
                      marginTop: 6,
                      textTransform: "capitalize",
                    }}
                  >
                    {key}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div style={FOOTER}>
          {total} findings
          {run.debtMinutes != null ? ` · ${formatDebt(run.debtMinutes)} remediation` : ""}
          {run.loc != null ? ` · ${run.loc.toLocaleString()} lines` : ""}
        </div>
      </div>
    ),
    size
  );
}

/**
 * No run behind this id. Says nothing about code quality, deliberately — a card
 * is the one surface where a plausible-looking default would travel furthest.
 */
function unavailable() {
  return new ImageResponse(
    (
      <div style={{ ...SHELL, justifyContent: "center" }}>
        <div style={{ display: "flex", fontSize: 22, color: "#858b96", letterSpacing: 1.5 }}>
          CODEMENTOR AI
        </div>
        <div style={{ display: "flex", fontSize: 48, fontWeight: 600, marginTop: 12 }}>
          Report unavailable
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#858b96", marginTop: 10 }}>
          This run no longer exists.
        </div>
      </div>
    ),
    size
  );
}

const SHELL = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#0d0e12",
  color: "#f2f3f5",
  fontFamily: "sans-serif",
  padding: 64,
  justifyContent: "space-between",
} as const;

const FOOTER = {
  display: "flex",
  borderTop: "1px solid #23262d",
  paddingTop: 20,
  fontSize: 22,
  color: "#656a75",
} as const;
