import type { FileNode, Finding, Severity } from "@/lib/types";
import { serverFetch } from "./server";
import { latestRunServer, type RunDetail } from "./runs";
import { listFindingsServer } from "./findings";

/* ============================================================================
   Everything the review screen needs for one repository, assembled on the
   server.

   Why here and not in the page: the page is already responsible for syntax
   highlighting (which must stay on the server so Shiki never enters the
   browser bundle), and mixing four sequential fetches into it made the
   fallback logic hard to follow. This module returns either a complete,
   coherent screen or null — never a half-populated one.
   ========================================================================== */

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  lines: number;
}

/** `GET /repositories/:id/tree` — every file in the folder, repo-relative. */
interface RepoTree {
  files: string[];
  /** The server walk hit its file or time ceiling; the tree is a subset. */
  truncated: boolean;
}

export interface ReviewData {
  repoId: string;
  repoName: string;
  run: RunDetail;
  findings: Finding[];
  fileTree: FileNode[];
  /** Files in the tree — the whole project, not just the ones with findings. */
  fileCount: number;
  /** The walk was cut short, so `fileCount` is a floor rather than a total. */
  filesTruncated: boolean;
  /** The file being reviewed, already fetched. */
  file: RepoFile;
  /**
   * The file is in the tree but its bytes could not be read — binary, over the
   * size ceiling, or gone since the walk. `file` is then a placeholder and the
   * screen shows why instead of the source.
   */
  fileUnavailable: boolean;
}

export async function loadReviewData(
  repoId: string,
  requestedFile?: string
): Promise<ReviewData | null> {
  const run = await latestRunServer(repoId);
  // No run means nothing to review. The page renders an empty state that
  // offers to start one, rather than an empty workspace.
  if (!run) return null;

  const [findings, repo, tree] = await Promise.all([
    listFindingsServer({ runId: run.id, limit: 500 }),
    serverFetch<{ name: string }>(`/repositories/${repoId}`),
    // The folder walk is bounded server-side at 20s, so this one read gets a
    // longer budget than the default — a cold or networked drive would
    // otherwise time out here and silently collapse the tree to the findings.
    serverFetch<RepoTree>(`/repositories/${repoId}/tree`, 30_000),
  ]);
  if (!findings) return null;

  const paths = tree?.files ?? [];

  // Default to the file with the worst finding — the review should open on the
  // thing that matters, not on whatever sorts first alphabetically. A run that
  // found nothing still has a project to browse, so fall back to the first file
  // rather than sending a clean repository to the "nothing to review" state.
  const target = requestedFile ?? worstFile(findings) ?? paths[0];
  if (!target) return null;

  const file = await serverFetch<RepoFile>(
    `/repositories/${repoId}/file?path=${encodeURIComponent(target)}`
  );

  // A file that will not open is NOT a reason to fail the screen. The sidebar
  // now lists every file in the project, so clicking a PNG or a 4MB lockfile is
  // an ordinary thing to do; returning null here would replace the whole
  // workspace with "nothing to review" and look like the analysis was lost.
  const fileTree = buildFileTree(paths, findings);

  return {
    repoId,
    repoName: repo?.name ?? "Project",
    run,
    findings,
    fileTree,
    fileCount: countFiles(fileTree),
    filesTruncated: tree?.truncated ?? false,
    file: file ?? { path: target, content: "", language: "text", lines: 0 },
    fileUnavailable: !file,
  };
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function worstFile(findings: Finding[]): string | null {
  if (findings.length === 0) return null;
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.line - b.line
  )[0].file;
}

/**
 * Build the sidebar tree.
 *
 * Two inputs, unioned:
 *   • `paths` — every file the server walked, so the sidebar is the project,
 *     not a list of complaints. Browsing a clean file is a legitimate thing to
 *     want to do in a review, and a tree that hides them cannot answer "what
 *     else is in here".
 *   • `findings` — the counts and severities that decorate the rows.
 *
 * A finding may name a file that is NOT in `paths` (deleted since the run, or
 * excluded by the walk's ignore list). Those are added rather than dropped: an
 * orphaned finding the tree refuses to show is a finding the user never fixes.
 */
export function buildFileTree(paths: string[], findings: Finding[]): FileNode[] {
  const stats = new Map<string, { count: number; worst: Severity }>();
  for (const f of findings) {
    const seen = stats.get(f.file);
    if (!seen) stats.set(f.file, { count: 1, worst: f.severity });
    else {
      seen.count += 1;
      if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[seen.worst]) seen.worst = f.severity;
    }
  }

  const all = new Set(paths);
  for (const path of stats.keys()) all.add(path);

  const root: FileNode[] = [];
  // Directories are looked up by full path, not scanned for by name. With
  // twenty thousand files a linear search per segment is the difference
  // between a tree that builds in milliseconds and one that blocks the render.
  const dirs = new Map<string, FileNode>();

  for (const path of all) {
    const segments = path.split("/");
    let level = root;
    let walked = "";

    // Every segment but the last is a directory.
    for (let i = 0; i < segments.length - 1; i++) {
      walked = walked ? `${walked}/${segments[i]}` : segments[i];
      let dir = dirs.get(walked);
      if (!dir) {
        dir = { path: walked, name: segments[i], type: "dir", children: [] };
        dirs.set(walked, dir);
        level.push(dir);
      }
      // A directory created above always has children; the assertion is safe.
      level = dir.children!;
    }

    const stat = stats.get(path);
    level.push({
      path,
      name: segments[segments.length - 1],
      type: "file",
      findings: stat?.count ?? 0,
      ...(stat ? { worst: stat.worst } : {}),
    });
  }

  sortNodes(root);
  return root;
}

/** Folders before files, each alphabetical — what every file explorer does. */
function sortNodes(nodes: FileNode[]): void {
  nodes.sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      : a.type === "dir"
        ? -1
        : 1
  );
  for (const n of nodes) if (n.children) sortNodes(n.children);
}

function countFiles(nodes: FileNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "file") n += 1;
    else if (node.children) n += countFiles(node.children);
  }
  return n;
}
