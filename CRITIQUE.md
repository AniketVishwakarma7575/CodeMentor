# Prompt G — critique pass

Self-review of the implemented frontend, run as a design director looking for
reasons to say no. Findings are things that are **actually in this codebase**,
not a generic checklist.

---

## 1. Where it still looks assembled rather than designed

**The `?` shortcut sheet is a two-column dump.** Four groups, alphabetical
within group, no weighting. In reality three shortcuts matter (`⌘K`, `j/k`,
`a`) and fourteen don't. A designed version leads with those three at 16px and
demotes the rest. Right now it looks like the keymap array got a `.map()`.
→ `src/components/shell/shortcut-sheet.tsx`

**`/repositories` and `/settings` are list-shaped filler.** They exist so the
nav isn't lying, and it shows — no empty state, no search, no bulk action, no
reason to visit twice. They should either earn their density or be cut from the
rail until they do.

**The run screen's two columns don't share a rhythm.** The pipeline column has
its own vertical spacing and the findings column has another; at 1440px the
eye lands between them. They need a shared baseline grid or an explicit
asymmetry, not an accidental one.

**Three separate "count + label" treatments exist** for the same idea: the file
header (`glyph + number`), the filter chips (`glyph + label + number`), the
dashboard facets (`glyph + label`, number right-aligned). One of those should
be a component, and it isn't.

What it does **not** do, checked deliberately: no purple-to-blue gradients, no
gradients at all, no glassmorphism, no emoji anywhere (`lucide-react` + hand-cut
SVG only), no centred hero copy on an application screen, no `rounded-full`, no
shadows on flat cards, no animated borders, no `✨`. Casing is sentence case
throughout the nav. Three font weights, and 600 only on page titles.

---

## 2. Visual hierarchy — where the eye goes vs. where it should

**Wrong on the review screen:** the eye lands on the *file tree filter chips*
first, because five tinted chips in a column are the most colourful cluster on
the screen, and they are a control surface, not content. The findings — the
actual subject — are 3px gutter bars. **Fix:** desaturate the inactive chip
state further (they should read as grey until engaged) and let the gutter bars
run full-row-height rather than being visually thinner than the chip borders.

**Wrong on the insights page:** the quality-gate condition list sits at 11px
next to a 148px gauge. The gate is the *verdict* — it is the thing a reviewer
needs — and the gauge is a restatement of one number that is already printed
twice on the page. The gauge is winning on size and losing on importance.

**Right:** the finding card. Severity chip → title at 16px → three columns at
13px → diff. Provenance metadata is deliberately 11px mono and recedes. Someone
scanning gets severity and title in under a second, which is the whole job.

---

## 3. Density

**Wasting space:** the learning headline block has 20px padding and a 48px
numeral for one statistic — justified once, but it sets a rhythm the rest of the
page then breaks. The concept cards below it are correctly dense; the two do not
look like the same product.

**Also wasting space:** `ChartFrame` reserves a full caption row per chart. With
eight charts that is ~160px of vertical space spent on explanatory text the
reader may only want for the one chart that moved.

**Cramming:** the finding card's three columns collapse to stacked at
`< 1280px`, which means at 1440px with the right pane at its 22% minimum, the
columns are ~90px wide and "why it matters" wraps to six lines. The three-column
form needs a container query on the *pane*, not a viewport breakpoint.

**Correct density:** file tree at 26px rows, code at 20px lines, top bar at
44px, nav rows at 28px. That is roughly 1.4× the density of a consumer app and
is right for the audience.

---

## 4. Animations that are decorative — cut these

- **`pillPop`** in `lib/motion.ts` — defined, exported, and never used. It has
  no causal job. Delete it rather than leaving it for someone to reach for.
- **The `ArrowRight` translate-x on hover** in the learning teaser and concept
  cards. It signals nothing the cursor doesn't already signal.
- **`fadeUp` on the run screen's score block.** The score landing is already
  marked by the count-up; the entrance is a second announcement of one event.

**Earning their place:** the stage indeterminate sweep (masks latency), the
findings stream-in (shows causality — they came from the analyzer), the count-up
(shows a value settling), the diff line-by-line reveal (shows the patch being
applied), the dismiss row-collapse (the gap closing *is* the confirmation), the
palette drop.

---

## 5. Where it breaks under real conditions

| Condition | Result |
|---|---|
| **1440px** | The design target. Three panes at 19/49/32. Correct. |
| **4K** | ✗ **Fails.** No max-width on the review workspace, so the code pane becomes ~2000px and the diff sits in a sea of empty gutter. Needs a `max-width` on the code column with the surplus given to the detail pane. |
| **100 findings** | ✗ **Fails on the code viewer.** Every line renders unvirtualised — 4,218 rows of DOM. Fine at this size, not fine at a real file. Needs windowing. The *findings list* is fine (8 rows). |
| **400-char minified line** | ✓ Handled. `.scroll-x` on the code container, `whitespace-pre`, and the line-number gutter is `position: sticky; left: 0` so it stays put while the line scrolls under it. Line 80 of the fixture is 428 chars specifically to test this. |
| **12-folder-deep path** | ✓ Handled. Tree indent caps at 6 levels; `truncatePath()` middle-truncates to `head/…/tail`; full path in a tooltip. The fixture includes a 12-segment vendor path. |
| **140-char finding title** | ✓ Handled. Title wraps at `leading-[1.35]`, no clamp, and the card scrolls. Finding `f-7` is 148 characters. The inline code marker truncates instead — correct, since the full title is one click away. |
| **Long branch name** | ✓ Truncates in the switcher, repo name drops below `sm`. |

---

## 6. Accessibility

**Passing:**
- Severity is never colour alone — three channels, enforced by a single
  component being the only render path.
- Diff rows carry a `+`/`−` sign glyph and an `sr-only` "Added:"/"Removed:"
  prefix, so the diff survives greyscale and a screen reader.
- The run screen has a real `role="status" aria-live="polite"` region narrating
  stage and finding count — the streaming UI is not silent.
- Verification checks change *glyph* (tick / cross / dash), not just colour.
- Single-letter shortcuts are suppressed inside text fields via
  `isTypingTarget()` — the classic keyboard-tool hostility bug.
- One focus treatment globally, 2px `--border-focus` at 1px offset.
- `prefers-reduced-motion` strips movement and keeps opacity, built into the
  variants via `useReducedMotion()` rather than bolted on.
- Dismiss moves selection *before* removing the row, so focus never lands on a
  deleted node.

**Failing:**
1. **The file tree is not a real tree widget.** It has `role="tree"` and
   `role="treeitem"` but no roving tabindex and no arrow-key navigation, so a
   keyboard user tabs through every node one at a time. Either implement the
   pattern properly or drop the ARIA roles and let it be a list — half-applied
   tree semantics are worse than none.
2. **The resize handles are not keyboard-operable.** `react-resizable-panels`
   supports it; it is not wired up. A keyboard user cannot change the split.
3. **`text-faint` at 3.5:1** is used for line numbers. Legal for non-text UI,
   but line numbers are arguably content when someone is citing "line 15".
4. **No skip link** to the main content past the rail and top bar.
5. **The inline code marker is a `<button>` inside a scrolling `<div>`** with no
   keyboard path from the code region — reachable by Tab, but the tab order
   walks the whole file first.

---

## 7. The ten highest-leverage changes, by visual impact per hour

| # | Change | Why it pays | Effort |
|---|---|---|---|
| 1 | Container-query the finding card's three columns off the *pane* width | Fixes the worst layout break at the product's design width | 1h |
| 2 | Desaturate inactive filter chips to grey | Immediately re-points the eye from controls to content | 30m |
| 3 | Cap the code pane's max-width and give surplus to the detail pane at ≥2000px | Removes the only 4K failure | 1h |
| 4 | Promote the quality gate above the gauge on `/insights` | The verdict should outrank the restatement | 1h |
| 5 | Virtualise the code viewer | The only thing standing between this and a real 4,000-line file | 3h |
| 6 | Delete `pillPop` + the two decorative hover translates | Motion inventory stops containing things with no job | 20m |
| 7 | Roving tabindex + arrow keys on the file tree | Closes the largest a11y gap | 2h |
| 8 | Extract one `<CountLabel>` for the three glyph+count treatments | Removes a visible inconsistency across three screens | 1h |
| 9 | Rebuild the shortcut sheet with a weighted top row | Turns a data dump into a designed surface | 1.5h |
| 10 | Give `/repositories` and `/settings` real density, or cut them from the rail | Stops two screens undercutting the other five | 3h |

---

## 8. The ten-second test

Show the review screen to a senior engineer for ten seconds.

What they see: a file path, `4,218 lines`, a severity count row, a quality score
of `34` with `−18 vs main`, red gutter bars on specific lines, and a card headed
**"SQL injection via string concatenation · CWE-89 · line 15 · 97% confidence"**
with a red/green diff and four green ticks reading *patch applies, parses, lint
clean, 24/24 tests pass*.

That answers "what does the product do" without a word of marketing copy. The
verification ticks are doing the heaviest lifting — they are the difference
between *an AI suggested something* and *an AI suggested something and then
checked it*, which is the question a senior engineer is actually asking.

The remaining gap is item #4 above: on `/insights`, the first thing seen is a
gauge rather than the pass/fail verdict, which is the one place the hierarchy
answers a less important question than the one being asked.
