import { createHighlighter, type Highlighter } from "shiki";
import { codementorDark, COLOR_TO_VAR } from "./shiki-theme";

/* ============================================================================
   Server-side highlighting.

   We tokenise once, on the server, against the dark theme, then map every
   token colour onto a CSS custom property name. The client receives
   { c: text, v: "keyword" } pairs and renders `color: var(--code-keyword)`.

   Consequences:
     • zero Shiki JavaScript in the client bundle (~1.2MB saved)
     • theme switching is a variable swap, not a re-tokenise
     • we own the row markup, so severity gutters, line numbers, inline finding
       cards and diff decoration can live inside the code grid rather than
       floating on top of a <pre> we do not control
   ========================================================================== */

export interface VarToken {
  /** content */
  c: string;
  /** css var suffix, e.g. "keyword" -> var(--code-keyword) */
  v: string;
  /** italic */
  i?: 1;
}

export type TokenLine = VarToken[];

const LANGS = [
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "json",
  "python",
  "sql",
  "bash",
  "yaml",
  "diff",
] as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [codementorDark],
      langs: [...LANGS],
    });
  }
  return highlighterPromise;
}

function normalizeLang(lang: string) {
  const l = lang.toLowerCase();
  if (l === "js") return "javascript";
  if (l === "ts") return "typescript";
  if (l === "sh" || l === "shell") return "bash";
  if (l === "yml") return "yaml";
  return (LANGS as readonly string[]).includes(l) ? l : "javascript";
}

/** Tokenise source into lines of variable-mapped tokens. */
export async function tokenizeCode(code: string, lang: string): Promise<TokenLine[]> {
  const hl = await getHighlighter();
  const { tokens } = hl.codeToTokens(code, {
    lang: normalizeLang(lang) as never,
    theme: "codementor-dark",
  });

  return tokens.map((line) =>
    line.map((t) => {
      const token: VarToken = {
        c: t.content,
        v: COLOR_TO_VAR[(t.color ?? "").toLowerCase()] ?? "fg",
      };
      // Shiki FontStyle.Italic === 1
      if (t.fontStyle && t.fontStyle & 1) token.i = 1;
      return token;
    })
  );
}

/** Tokenise the added/removed sides of a patch so diffs are highlighted too. */
export async function tokenizeLines(lines: string[], lang: string): Promise<TokenLine[]> {
  return tokenizeCode(lines.join("\n"), lang);
}
