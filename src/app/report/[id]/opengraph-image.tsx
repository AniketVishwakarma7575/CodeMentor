import { ImageResponse } from "next/og";
import { REPO, SCORE } from "@/data/repo";

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
   ========================================================================== */

export default async function Image() {
  const band =
    SCORE.overall >= 90 ? "#30a46c" : SCORE.overall >= 50 ? "#ffb224" : "#e5484d";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0d0e12",
          color: "#f2f3f5",
          fontFamily: "sans-serif",
          padding: 64,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 22, color: "#858b96", letterSpacing: 1.5 }}>
            CODEMENTOR AI · ANALYSIS REPORT
          </div>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 600, letterSpacing: -1.2 }}>
            {REPO.name}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#a9aeb8" }}>
            {REPO.branch} · {REPO.commit} · PR #{REPO.pr}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 168, fontWeight: 700, lineHeight: 1, color: band, letterSpacing: -6 }}>
                {SCORE.overall}
              </span>
              <span style={{ fontSize: 44, color: "#656a75" }}>/100</span>
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#ff6369", marginTop: 8 }}>
              Quality gate failed · −{Math.abs(SCORE.delta)} vs {SCORE.baseline}
            </div>
          </div>

          <div style={{ display: "flex", gap: 28, marginLeft: "auto", marginBottom: 12 }}>
            {[
              ["Critical", 2, "#e5484d"],
              ["High", 3, "#f76b15"],
              ["Medium", 2, "#ffb224"],
              ["Low", 1, "#7c88a0"],
            ].map(([label, n, color]) => (
              <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: 56, fontWeight: 600, color: color as string, lineHeight: 1 }}>
                  {n as number}
                </span>
                <span style={{ fontSize: 22, color: "#858b96", marginTop: 6 }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: "1px solid #23262d",
            paddingTop: 20,
            fontSize: 22,
            color: "#656a75",
          }}
        >
          8 findings · 17h 35m remediation · Semgrep, Checkmarx, ESLint, SonarQube, CodeMentor
        </div>
      </div>
    ),
    size
  );
}
