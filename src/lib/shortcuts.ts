/* ============================================================================
   The shortcut map is the single source of truth.
   The `?` sheet renders from this array, and the key handlers read from it.
   They cannot drift, which is the usual failure mode of a documented keymap.
   ========================================================================== */

export interface Shortcut {
  id: string;
  keys: string[];
  label: string;
  group: "Global" | "Findings" | "Navigation" | "View";
  /** Where the binding is live. `global` means anywhere in the app. */
  scope: "global" | "review" | "run";
}

export const SHORTCUTS: Shortcut[] = [
  { id: "palette", keys: ["mod", "K"], label: "Open command palette", group: "Global", scope: "global" },
  { id: "search", keys: ["/"], label: "Focus search", group: "Global", scope: "global" },
  { id: "help", keys: ["?"], label: "Show keyboard shortcuts", group: "Global", scope: "global" },
  { id: "theme", keys: ["mod", "shift", "L"], label: "Toggle theme", group: "Global", scope: "global" },
  { id: "rail", keys: ["["], label: "Collapse / expand nav rail", group: "View", scope: "global" },

  { id: "next", keys: ["j"], label: "Next finding", group: "Findings", scope: "review" },
  { id: "prev", keys: ["k"], label: "Previous finding", group: "Findings", scope: "review" },
  { id: "apply", keys: ["a"], label: "Apply suggested fix", group: "Findings", scope: "review" },
  { id: "explain", keys: ["e"], label: "Explain more / expand detail", group: "Findings", scope: "review" },
  { id: "dismiss", keys: ["x"], label: "Not an issue — dismiss", group: "Findings", scope: "review" },
  { id: "snooze", keys: ["s"], label: "Snooze until next release", group: "Findings", scope: "review" },
  { id: "learn", keys: ["l"], label: "Open the linked concept", group: "Findings", scope: "review" },
  { id: "undo", keys: ["mod", "Z"], label: "Undo last action", group: "Findings", scope: "review" },

  { id: "sev-1", keys: ["1"], label: "Filter: critical only", group: "Navigation", scope: "review" },
  { id: "sev-2", keys: ["2"], label: "Filter: high and above", group: "Navigation", scope: "review" },
  { id: "sev-0", keys: ["0"], label: "Clear all filters", group: "Navigation", scope: "review" },
  { id: "diff", keys: ["d"], label: "Toggle unified / split diff", group: "View", scope: "review" },
  { id: "escape", keys: ["esc"], label: "Close overlay / clear selection", group: "Navigation", scope: "global" },
];

export const SHORTCUT_GROUPS = ["Global", "Findings", "Navigation", "View"] as const;

/** Render a key token for display. `mod` resolves per-platform after mount. */
export function keyLabel(token: string, mac: boolean) {
  switch (token) {
    case "mod":
      return mac ? "⌘" : "Ctrl";
    case "shift":
      return mac ? "⇧" : "Shift";
    case "alt":
      return mac ? "⌥" : "Alt";
    case "esc":
      return "Esc";
    default:
      return token;
  }
}

/**
 * True when the event originated in a text-entry surface. Single-letter
 * bindings must never fire while someone is typing a filter or a comment —
 * this is the bug that makes keyboard-first tools feel hostile.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true ||
    el.getAttribute?.("role") === "textbox"
  );
}
