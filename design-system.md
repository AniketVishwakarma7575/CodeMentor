# CodeMentor AI — design system

The token layer lives in `src/app/globals.css`. This document is the argument for
what is in it. Live swatch sheet, both themes side by side: **`/tokens`**.

---

## 1. Design direction

### (a) Precise, dense, engineering-tool minimalism
Grey is the primary colour. Elevation is a 1px border and a two-percent surface
shift. Type is 13px, one family, two weights. Nothing is centred, nothing is
capsule-shaped, and the only saturated pixels on screen are the ones carrying
severity. **Closest products:** Linear, Sentry, Vercel dashboard.
**Wins:** the senior engineer who lives in a terminal and reads a review at
speed. They trust it because it doesn't try to charm them.
**Loses:** the junior who opens it after a failed CI run and finds a wall of
grey rows with no idea where to start.

### (b) Editorial and calm
Wider measures, 16px body, real vertical rhythm, generous leading, illustrations
or diagrams for concepts. The review screen becomes a document you read rather
than a console you operate. **Closest products:** Stripe docs, Linear's changelog,
Notion. **Wins:** the learner. Explanations land because they are typeset like
something written for a person. **Loses:** density. A senior engineer scanning 87
findings will see four of them per screen and go back to the CLI.

### (c) Confident and expressive
One strong accent driving the whole interface — coloured headers, filled
buttons, an accent-tinted sidebar. **Closest products:** Raycast, Arc, Vercel's
marketing surfaces. **Wins:** the buyer in a demo, and the product's memorability
in a crowded category. **Loses:** the severity ladder. Once the chrome is
coloured, a critical finding has to shout over the furniture, and every
severity token drops a step in salience.

### Recommendation: (a) as the chassis, (b) as an inner layer

Take the engineering-tool chassis wholesale — density, borders, grey, 13px UI —
and switch to editorial typography **only inside explanation surfaces**: the
three-column body, the expanded deep-dive, the concept pages. That is what
`.prose-explain` is: 14px, line-height 1.6, `max-width: 68ch`, applied nowhere
except where the product is teaching.

The defence is that the two audiences want different things *at different
moments*, not different products. A senior engineer scanning a file wants (a).
The same engineer, three seconds later, reading why the fix has a trade-off,
wants (b). A junior wants (b) most of the time but will not be taken seriously
by their team if the tool they cite looks like a courseware product.

Direction (c) was rejected for a specific reason, not a stylistic one: this
product's entire information architecture rests on a five-step severity ladder.
Every chromatic pixel spent on chrome is salience taken from that ladder. So the
accent here is **contrast, not hue** — primary actions are high-contrast neutral
(`bg-fg text-fg-inverse`), and the single blue in the system is `info`, which
doubles as the focus ring. The chromatic budget belongs to severity.

---

## 2. Colour

Dark is `:root`. Light is `.light` — a separately chosen set of values, not an
inversion. (Inverting a dark palette gives you muddy mid-greys and severity
colours that fail contrast on white; every light value here was picked against
white directly.)

### Semantic surfaces

| Token | Dark | Light | Used for |
|---|---|---|---|
| `bg-canvas` | `#0d0e12` | `#fcfcfd` | the page |
| `bg-surface` | `#14161b` | `#ffffff` | panes, cards, rails |
| `bg-elevated` | `#1b1e24` | `#ffffff` | popovers, palette, dialogs |
| `bg-inset` | `#0a0b0f` | `#f7f8fa` | code, logs, terminal output |
| `bg-hover` | `#202329` | `#f1f2f5` | row hover |
| `bg-active` | `#262a31` | `#e8eaee` | pressed, meter tracks |
| `bg-selected` | `#1d2432` | `#eef3fd` | selected file / row |
| `border-subtle` | `#23262d` | `#e4e6eb` | every divider |
| `border-strong` | `#33373f` | `#cfd2da` | floating layers, controls |

Not pure black. `#0d0e12` at OKLCH L 0.165 keeps `border-subtle` visible; on
`#000` a 1px hairline disappears and you are forced into shadows, which is
exactly the failure mode this system is built to avoid.

### Text, with measured contrast against `bg-canvas`

| Token | Dark | Ratio | Light | Ratio |
|---|---|---|---|---|
| `text-primary` | `#f2f3f5` | **17.3:1** | `#16181d` | **16.8:1** |
| `text-secondary` | `#a9aeb8` | **8.6:1** | `#5b616e` | **6.4:1** |
| `text-muted` | `#858b96` | **5.6:1** | `#767c89` | **4.6:1** |
| `text-faint` | `#656a75` | **3.5:1** | `#9aa0ac` | **3.0:1** |

`text-faint` is below 4.5:1 by design and is **restricted to non-text UI**: line
numbers, chip dividers, disabled glyphs. It never carries a sentence. Everything
a user has to read is `text-muted` or better.

### Severity — the emotional core

Four tokens per role, because one hex cannot serve a 3px gutter bar, a text
label, a tinted chip and that chip's border:

`--sev-{role}` (marks) · `--sev-{role}-fg` (text) · `--sev-{role}-bg` (chip
fill) · `--sev-{role}-bd` (chip border).

| Role | Mark | Text (dark) | Ratio vs canvas | Text (light) | Ratio vs white |
|---|---|---|---|---|---|
| critical | `#e5484d` | `#ff6369` | **6.1:1** | `#c02026` | **6.0:1** |
| high | `#f76b15` | `#ff954d` | **8.6:1** | `#ad4200` | **5.8:1** |
| medium | `#ffb224` | `#ffca4d` | **11.9:1** | `#855000` | **6.2:1** |
| low | `#7c88a0` | `#a3adc2` | **7.1:1** | `#59606f` | **6.9:1** |
| info | `#3b82f6` | `#6ea8ff` | **6.5:1** | `#0a5cc7` | **6.1:1** |
| success | `#30a46c` | `#4cc38a` | **7.6:1** | `#0f7343` | **5.4:1** |

OKLCH values are in `globals.css` under `@supports (color: oklch(...))`; hex is
authored first so the palette degrades rather than disappears.

**Low is deliberately desaturated.** A low-severity finding that arrives in a
saturated colour is lying about its importance. `#7c88a0` is a blue-grey that
reads as "noted" rather than "act".

**Nothing here looks like a Bootstrap alert** because the chips are 4px-radius,
1px-bordered, 20px tall, tinted at roughly 6% and never full-bleed. A Bootstrap
alert is a wide saturated block; these are labels.

### Colourblind safety — three channels, always

Severity is encoded on **colour + shape + written label**, enforced by
`src/components/severity.tsx` being the only way severity is ever rendered:

| Role | Glyph | Label |
|---|---|---|
| critical | filled octagon with `!` | "Critical" |
| high | filled triangle with `!` | "High" |
| medium | filled diamond | "Medium" |
| low | filled dot | "Low" |
| info | hollow ring with `i` | "Info" |

The glyphs are **shape-ranked**, so severity order survives greyscale printing
and a Slack screenshot at 40%: octagon > triangle > diamond > filled dot >
hollow ring.

This matters more than it looks. Running the severity ramp through a CVD
validator (`dataviz` skill, `validate_palette.js`) against the dark surface:

```
CVD separation      worst adjacent #f76b15↔#e5484d  ΔE 8.6 (deutan)
Normal-vision floor worst adjacent #f76b15↔#e5484d  ΔE 9.8  — below the 15 floor
```

Critical and high are **hard to tell apart by hue alone even with full colour
vision**, because red and orange sit ~22° apart. That is a fact about the
industry-standard severity convention, not a mistake in these particular hexes —
and it is precisely why the icon and the label are non-negotiable rather than
nice-to-have.

It also has a direct design consequence on the dashboard: see §6.

---

## 3. Typography

**Inter (UI) + JetBrains Mono (code).** Self-hosted via `next/font`, so there is
no third-party request and no layout shift.

The mono choice is the one that matters, because code readability *is* the
product. JetBrains Mono over the alternatives:

- **Tallest x-height of the candidates**, at ~0.55em against Inter's 0.727em
  cap-relative. Inline `<code>` inside a sentence sits on the same optical line
  as the prose instead of appearing to shrink — which happens constantly here,
  since explanations name identifiers.
- **1 / l / I and 0 / O are unambiguous** without needing a stylistic set toggle.
  In a tool where the user is reading a taint trace and deciding whether to trust
  a patch, an ambiguous `l` is a real cost.
- **Designed for long sessions**, not for headline personality. Geist Mono is
  narrower — better for a terminal, worse for a diff where you want the
  horizontal rhythm to reveal alignment. IBM Plex Mono has more character but a
  smaller x-height. Berkeley Mono is excellent and licence-encumbered.

Inter for UI at 13px with `cv05` (single-storey g), `cv09` (slashed zero) and
`ss03` — it is the only candidate metric-tuned for the 12–14px range, which is
the entire range this product lives in.

### Scale

| Token | px | Line-height | Tracking | Used for |
|---|---|---|---|---|
| `2xs` | 11 | 14 | — | chips, gutter numerals, metadata |
| `xs` | 12 | 16 | — | secondary metadata |
| `sm` | **13** | 18 | — | **the UI default** |
| `base` | 14 | 22.4 (1.6) | — | prose, explanations |
| `md` | 16 | 24 | — | finding titles |
| `lg` | 20 | 28 | −0.011em | page titles |
| `xl` | 24 | 32 | −0.014em | concept titles |
| `2xl` | 32 | 40 | −0.020em | score numerals |
| `3xl` | 48 | 56 | −0.026em | the one headline metric |

Nothing between these steps exists.

**Weights: 400 and 500 only**, with **600 reserved for page titles** — `h1` on a
route, and the score numeral. Three weights total in the product.

**Line height is 1.6 on prose, 1.5 on code, ~1.4 on chrome.** The 1.6 lives in
`.prose-explain` and is never applied to a table row or a list item — reading
leading in a dense UI reads as bloat, not as care.

**Tabular numerals everywhere a number can change.** `font-variant-numeric:
tabular-nums` is applied via `.tnum`, `[data-metric]`, `code`, `kbd`, `pre` and
`time`. Without it the score counting from 0 to 34 jitters horizontally on every
frame and looks broken.

---

## 4. Spacing, radius, elevation

**4px base scale.** Tailwind's `--spacing: 0.25rem`.

**Radius is a semantic, not a number.** One radius per role, so a screen never
mixes:

| Token | px | Applies to |
|---|---|---|
| `xs` | 3 | meter tracks, kbd, inline marks |
| `sm` | 4 | severity chips, filter chips |
| `md` | 6 | buttons, inputs, rows |
| `lg` | 8 | cards, panes |
| `xl` | 12 | dialogs, command palette |

Severity chips are **4px, not `rounded-full`**. A perfect capsule is the single
most reliable signal that a UI was assembled from a component library. A 4px
chip reads as a label in an engineering tool.

**Elevation is border + surface shift.** There are exactly two shadows in the
system, `--shadow-popover` and `--shadow-dialog`, and they are only permitted on
layers that genuinely float: the command palette, popovers, dropdowns, the
shortcut sheet. **No card in this product has a shadow.** A 1px border at low
opacity reads as more precise than any shadow, and drop shadows on flat cards
are the moment a developer tool starts looking cheap.

---

## 5. Syntax highlighting

Custom TextMate theme in `src/lib/shiki-theme.ts`, nine colours and no more.

Two constraints drove it:

1. **Severity owns red, orange and amber**, so the syntax theme leans cool —
   violet keywords, blue functions, teal types — with exactly one warm role
   (numerals). A red keyword sitting next to a critical gutter bar reads as an
   error, which is a lie about the code.
2. **Every colour maps 1:1 onto a CSS variable.** Highlighting happens on the
   server; the client receives `{ c: text, v: "keyword" }` pairs and renders
   `color: var(--code-keyword)`. Light mode is a variable swap, not a second
   tokenisation.

| Role | Dark | Light |
|---|---|---|
| foreground | `#d4d7dd` | `#24272e` |
| comment | `#5f6672` *italic* | `#8a909c` |
| keyword | `#a78bfa` | `#7c3aed` |
| function | `#6cb6ff` | `#0b62c4` |
| string | `#97cf9a` | `#217a3f` |
| number | `#f0b880` | `#a8560c` |
| type | `#6fd3c0` | `#0f7c78` |
| property | `#b8c0cc` | `#3d4450` |
| punctuation | `#7b8494` | `#6b7280` |

Consequence worth naming: **Shiki never enters the client bundle** (~1.2MB
saved), and because we own the row markup rather than a generated `<pre>`, the
severity gutter, sticky line numbers and inline finding markers can live inside
the code grid instead of floating on top of it.

---

## 6. Where the design system overruled the brief

The brief asked for **findings by severity over time as a stacked area**. That
was built as four small-multiple area charts instead, and the reason is the CVD
measurement in §2.

As four adjacent bands in one stack, critical / high / medium / low rely on hue
alone for identity. The adjacent pair critical↔high measures **ΔE 9.8 for
normal vision against a floor of 15**, and collapses under deuteranopia. Icons
and labels — the fix everywhere else in this product — cannot rescue a stacked
area, because the bands *are* the encoding.

Faceting makes every chart single-series, which removes adjacency entirely, lets
the severity token colours be used correctly as status colours, and answers the
question the reader actually has ("did critical move?") without asking them to
mentally un-stack four bands. The stacked-area *form* is still on the dashboard,
applied to total findings, where one series means no adjacency problem exists.

Related rules the charts follow: no dual-axis charts anywhere; grid and axis
rules are solid hairlines one shade off the surface, never dashed; no value is
printed on every point — one endpoint is direct-labelled and the tooltip carries
the rest; and **every chart states why the number moved**, enforced by
`ChartFrame` making the `why` prop required rather than optional.
