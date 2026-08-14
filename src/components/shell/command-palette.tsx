"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  FileCode2,
  GitBranch,
  Hash,
  LayoutDashboard,
  Moon,
  Play,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { CONCEPTS, BRANCHES, FILE_TREE } from "@/data/repo";
import { FINDINGS } from "@/data/findings";
import type { Concept, FileNode, Finding } from "@/lib/types";
import { USE_FIXTURES } from "@/lib/api/config";
import { listFindings } from "@/lib/api/findings";
import { listRepositories, type RepositorySummary } from "@/lib/api/repositories";
import { apiFetch } from "@/lib/api/client";
import { useActiveProject } from "@/lib/active-project";
import { cn, fileName, severityMeta, truncatePath } from "@/lib/utils";
import { overlayVariants, paletteVariants } from "@/lib/motion";
import { Kbd } from "@/components/ui/primitives";
import { SeverityGlyph } from "@/components/severity";

/* ============================================================================
   ⌘K palette.
   Jumps to a repo, branch, file, finding, concept or action. A developer tool
   where the palette only searches pages is a palette that nobody keeps using —
   findings and concepts are the interesting targets here.
   ========================================================================== */

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
};

function flattenFiles(nodes: FileNode[], out: FileNode[] = []): FileNode[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    if (n.children) flattenFiles(n.children, out);
  }
  return out;
}

/**
 * The palette's searchable corpus, loaded the first time it opens.
 *
 * ── WHY LAZILY, AND ONLY ONCE ──
 *
 * The palette is mounted on every screen. Fetching findings and concepts on
 * mount would put two requests on every page load to populate a surface most
 * navigations never open. Fetching on every open would re-request on every
 * ⌘K. So: first open, then kept.
 *
 * Everything here is scoped to the ACTIVE PROJECT. The fixture version searched
 * a sample repository's findings from every screen, so ⌘K on a real project
 * offered jump targets that did not exist in it.
 */
function usePaletteData(open: boolean) {
  const [activeProjectId] = useActiveProject();
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [concepts, setConcepts] = React.useState<Concept[]>([]);
  const [repos, setRepos] = React.useState<RepositorySummary[]>([]);
  const loadedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open || USE_FIXTURES) return;
    // Re-fetch when the project changes, not when the palette re-opens.
    const key = activeProjectId ?? "none";
    if (loadedFor.current === key) return;
    loadedFor.current = key;

    let disposed = false;

    void listRepositories()
      .then((all) => !disposed && setRepos(all))
      .catch(() => undefined);

    void apiFetch<Concept[]>("/learning")
      .then((all) => !disposed && setConcepts(all))
      .catch(() => undefined);

    if (activeProjectId) {
      void listFindings({ repoId: activeProjectId, limit: 200 })
        .then((r) => !disposed && setFindings(r.findings))
        .catch(() => undefined);
    } else {
      setFindings([]);
    }

    return () => {
      disposed = true;
    };
  }, [open, activeProjectId]);

  return { findings, concepts, repos, activeProjectId };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [, selectProject] = useActiveProject();
  const data = usePaletteData(open);

  const go = React.useCallback(
    (href: string) => () => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  /** Every screen that reads analysis results is keyed on `?repo=`. */
  const scoped = React.useCallback(
    (path: string, extra?: string) => {
      const repo = data.activeProjectId;
      const qs = [repo ? `repo=${encodeURIComponent(repo)}` : "", extra ?? ""]
        .filter(Boolean)
        .join("&");
      return qs ? `${path}?${qs}` : path;
    },
    [data.activeProjectId]
  );

  const items = React.useMemo<Item[]>(() => {
    const nav: Item[] = [
      { id: "n-rev", label: "Reviews", group: "Go to", icon: <FileCode2 size={13} />, run: go(scoped("/reviews")) },
      { id: "n-ins", label: "Insights", group: "Go to", icon: <LayoutDashboard size={13} />, run: go(scoped("/insights")) },
      { id: "n-lrn", label: "Learning", group: "Go to", icon: <BookOpen size={13} />, run: go(scoped("/learning")) },
      { id: "n-run", label: "Latest run", group: "Go to", icon: <Play size={13} />, run: go(scoped("/runs")) },
      { id: "n-repos", label: "Repositories", group: "Go to", icon: <GitBranch size={13} />, run: go("/repositories") },
    ];

    const actions: Item[] = [
      {
        id: "a-theme",
        label: theme === "light" ? "Switch to dark theme" : "Switch to light theme",
        group: "Actions",
        icon: theme === "light" ? <Moon size={13} /> : <Sun size={13} />,
        keywords: "theme dark light appearance",
        run: () => {
          setTheme(theme === "light" ? "dark" : "light");
          onOpenChange(false);
        },
      },
      {
        id: "a-rerun",
        label: "Re-run analysis on this project",
        group: "Actions",
        icon: <Play size={13} />,
        keywords: "analyse scan rerun",
        run: go(scoped("/runs")),
      },
    ];

    if (USE_FIXTURES) {
      return [
        ...nav,
        ...actions,
        ...FINDINGS.map((f) => ({
          id: `x-${f.id}`,
          label: f.title,
          hint: `${severityMeta[f.severity].label} · ${f.ruleKey} · line ${f.line}`,
          group: "Findings",
          icon: <SeverityGlyph severity={f.severity} size={12} />,
          keywords: `${f.cwe?.id ?? ""} ${f.category} ${f.ruleKey} ${f.engine}`,
          run: go(`/reviews?finding=${f.id}`),
        })),
        ...flattenFiles(FILE_TREE).map((f) => ({
          id: `f-${f.path}`,
          label: fileName(f.path),
          hint: truncatePath(f.path, 5),
          group: "Files",
          icon: <FileCode2 size={13} />,
          keywords: f.path,
          run: go(`/reviews?file=${encodeURIComponent(f.path)}`),
        })),
        ...BRANCHES.map((b) => ({
          id: `b-${b.name}`,
          label: b.name,
          hint: `score ${b.score}`,
          group: "Branches",
          icon: <GitBranch size={13} />,
          run: go("/reviews"),
        })),
        ...CONCEPTS.map((c) => ({
          id: `c-${c.id}`,
          label: c.title,
          hint: `${c.difficulty} · ${c.readMinutes} min`,
          group: "Concepts",
          icon: <Hash size={13} />,
          keywords: `${c.category} ${c.relatedCwe ?? ""}`,
          run: go(`/learning/${c.id}`),
        })),
      ];
    }

    // Projects, not branches: a local folder has one branch and switching it is
    // not something this tool can do. Switching project is.
    const projects: Item[] = data.repos.map((r) => ({
      id: `p-${r.id}`,
      label: r.name,
      hint: r.loc != null ? `${r.loc.toLocaleString()} lines · ${r.branch}` : r.branch,
      group: "Projects",
      icon: <GitBranch size={13} />,
      keywords: r.localPath ?? "",
      run: () => {
        selectProject(r.id);
        onOpenChange(false);
        router.push(`/runs?repo=${encodeURIComponent(r.id)}`);
      },
    }));

    const findings: Item[] = data.findings.map((f) => ({
      id: `x-${f.id}`,
      label: f.title,
      hint: `${severityMeta[f.severity].label} · ${f.ruleKey} · ${fileName(f.file)}:${f.line}`,
      group: "Findings",
      icon: <SeverityGlyph severity={f.severity} size={12} />,
      keywords: `${f.cwe?.id ?? ""} ${f.category} ${f.ruleKey} ${f.engine} ${f.file}`,
      run: go(scoped("/reviews", `finding=${encodeURIComponent(f.id)}`)),
    }));

    // Derived from the findings already loaded rather than a second request for
    // the tree: the files worth jumping to are the ones carrying a finding.
    const files: Item[] = [...new Set(data.findings.map((f) => f.file))].map((path) => ({
      id: `f-${path}`,
      label: fileName(path),
      hint: truncatePath(path, 5),
      group: "Files",
      icon: <FileCode2 size={13} />,
      keywords: path,
      run: go(scoped("/reviews", `file=${encodeURIComponent(path)}`)),
    }));

    const concepts: Item[] = data.concepts.map((c) => ({
      id: `c-${c.id}`,
      label: c.title,
      hint: `${c.difficulty} · ${c.readMinutes} min`,
      group: "Concepts",
      icon: <Hash size={13} />,
      keywords: `${c.category} ${c.relatedCwe ?? ""}`,
      run: go(
        data.activeProjectId
          ? `/learning/${c.id}?repo=${encodeURIComponent(data.activeProjectId)}`
          : `/learning/${c.id}`
      ),
    }));

    return [...nav, ...actions, ...findings, ...files, ...projects, ...concepts];
  }, [go, scoped, onOpenChange, setTheme, theme, data, selectProject, router]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 24);
    const scored = items
      .map((it) => {
        const hay = `${it.label} ${it.hint ?? ""} ${it.keywords ?? ""}`.toLowerCase();
        const idx = hay.indexOf(q);
        if (idx === -1) {
          // subsequence fallback so "sqli" still finds "SQL injection"
          let i = 0;
          for (const ch of hay) if (ch === q[i]) i++;
          return i === q.length ? { it, score: 500 } : null;
        }
        return { it, score: it.label.toLowerCase().startsWith(q) ? 0 : idx };
      })
      .filter(Boolean) as { it: Item; score: number }[];
    return scored.sort((a, b) => a.score - b.score).slice(0, 24).map((s) => s.it);
  }, [items, query]);

  React.useEffect(() => setActive(0), [query]);

  // Keep the active row in view without smooth-scrolling — this is a keyboard
  // surface and smooth scroll makes fast j/k feel laggy.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, filtered]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey) || (e.key === "j" && e.ctrlKey)) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey) || (e.key === "k" && e.ctrlKey)) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  let lastGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                variants={overlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 z-50 bg-[rgb(0_0_0/0.5)]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                variants={reduce ? undefined : paletteVariants}
                initial={reduce ? { opacity: 0 } : "hidden"}
                animate={reduce ? { opacity: 1 } : "visible"}
                exit={reduce ? { opacity: 0 } : "exit"}
                onKeyDown={onKeyDown}
                className={cn(
                  "fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2",
                  "overflow-hidden rounded-xl border border-strong bg-elevated shadow-[var(--shadow-dialog)]"
                )}
              >
                <Dialog.Title className="sr-only">Command palette</Dialog.Title>

                <div className="flex h-11 items-center gap-2 border-b border-subtle px-3">
                  <Search size={14} className="shrink-0 text-fg-faint" aria-hidden />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Jump to a finding, file, branch or concept…"
                    aria-label="Search commands"
                    aria-controls="cm-palette-list"
                    aria-activedescendant={filtered[active] ? `cm-opt-${filtered[active].id}` : undefined}
                    className="h-full w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-faint"
                  />
                  <Kbd>Esc</Kbd>
                </div>

                <div
                  ref={listRef}
                  id="cm-palette-list"
                  role="listbox"
                  aria-label="Results"
                  className="max-h-[52vh] overflow-y-auto overscroll-contain py-1"
                >
                  {filtered.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-fg-muted">
                      No match for “{query}”.
                    </p>
                  ) : (
                    filtered.map((it, i) => {
                      const showGroup = it.group !== lastGroup;
                      lastGroup = it.group;
                      return (
                        <React.Fragment key={it.id}>
                          {showGroup ? (
                            <div className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                              {it.group}
                            </div>
                          ) : null}
                          <div
                            id={`cm-opt-${it.id}`}
                            data-index={i}
                            role="option"
                            aria-selected={i === active}
                            onMouseMove={() => setActive(i)}
                            onClick={() => it.run()}
                            className={cn(
                              "mx-1 flex h-8 cursor-pointer items-center gap-2 rounded-md px-2",
                              i === active ? "bg-hover" : "bg-transparent"
                            )}
                          >
                            <span className="flex w-4 shrink-0 justify-center text-fg-muted">{it.icon}</span>
                            <span className="truncate text-sm text-fg">{it.label}</span>
                            {it.hint ? (
                              <span className="ml-auto shrink-0 truncate pl-3 font-mono text-2xs text-fg-faint">
                                {it.hint}
                              </span>
                            ) : null}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                <div className="flex h-8 items-center gap-3 border-t border-subtle px-3 text-2xs text-fg-faint">
                  <span className="flex items-center gap-1">
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd> navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <Kbd>↵</Kbd> open
                  </span>
                  <span className="ml-auto tnum">{filtered.length} results</span>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
