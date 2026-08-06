import type { ThemeRegistration } from "shiki";

/* ============================================================================
   Custom TextMate theme.
   Code blocks must look like they belong to this product, not like something
   pasted out of VS Code. Two constraints drove the palette:

   1. Severity owns red, orange and amber. The syntax theme therefore leans
      cool — violet keywords, blue functions, teal types — with exactly one
      warm role (numerals/constants). A red keyword next to a critical finding
      bar would read as an error, which is a lie.
   2. The theme resolves to nine colours and no more. Each maps 1:1 onto a CSS
      variable, so light mode is a variable swap rather than a second
      tokenisation pass.
   ========================================================================== */

export const PALETTE = {
  fg: "#d4d7dd",
  comment: "#5f6672",
  keyword: "#a78bfa",
  func: "#6cb6ff",
  string: "#97cf9a",
  number: "#f0b880",
  type: "#6fd3c0",
  property: "#b8c0cc",
  punct: "#7b8494",
} as const;

/** hex -> css custom-property suffix. Total over PALETTE, so lookup never fails. */
export const COLOR_TO_VAR: Record<string, string> = {
  [PALETTE.fg]: "fg",
  [PALETTE.comment]: "comment",
  [PALETTE.keyword]: "keyword",
  [PALETTE.func]: "function",
  [PALETTE.string]: "string",
  [PALETTE.number]: "number",
  [PALETTE.type]: "type",
  [PALETTE.property]: "property",
  [PALETTE.punct]: "punct",
};

export const codementorDark: ThemeRegistration = {
  name: "codementor-dark",
  type: "dark",
  colors: {
    "editor.background": "#0a0b0f",
    "editor.foreground": PALETTE.fg,
  },
  settings: [
    { settings: { foreground: PALETTE.fg, background: "#0a0b0f" } },

    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: PALETTE.comment, fontStyle: "italic" } },

    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language.this",
        "variable.language.super",
        "constant.language",
        "keyword.other.important",
      ],
      settings: { foreground: PALETTE.keyword },
    },

    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
        "variable.function",
        "entity.name.function.member",
      ],
      settings: { foreground: PALETTE.func },
    },

    {
      scope: ["string", "string.quoted", "string.template", "constant.other.symbol", "meta.embedded.line"],
      settings: { foreground: PALETTE.string },
    },

    {
      scope: [
        "constant.numeric",
        "constant.character.escape",
        "constant.other",
        "keyword.other.unit",
      ],
      settings: { foreground: PALETTE.number },
    },

    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "entity.name.namespace",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
        "entity.name.tag",
      ],
      settings: { foreground: PALETTE.type },
    },

    {
      scope: [
        "variable.other.property",
        "meta.object-literal.key",
        "support.variable.property",
        "entity.other.attribute-name",
        "variable.other.object.property",
      ],
      settings: { foreground: PALETTE.property },
    },

    {
      scope: [
        "punctuation",
        "meta.brace",
        "keyword.operator",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.definition.template-expression",
      ],
      settings: { foreground: PALETTE.punct },
    },

    { scope: ["variable", "variable.other.readwrite", "meta.definition.variable"], settings: { foreground: PALETTE.fg } },
    { scope: ["variable.parameter"], settings: { foreground: PALETTE.property } },
    { scope: ["invalid", "invalid.illegal"], settings: { foreground: "#ff6369" } },
  ],
};
