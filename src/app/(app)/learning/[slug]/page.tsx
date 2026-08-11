import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { CONCEPTS } from "@/data/repo";
import { USE_FIXTURES } from "@/lib/api/config";
import { conceptServer, skillSignalsServer } from "@/lib/api/server-fetchers";
import { repositoryServer } from "@/lib/api/server-fetchers";
import type { Concept } from "@/lib/types";
import { tokenizeCode } from "@/lib/highlight";
import { Eyebrow } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/learning/code-block";
import { SelfCheck } from "@/components/learning/self-check";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concept = await loadConcept(slug);
  return { title: concept?.title ?? "Concept" };
}

/**
 * Concept content is editorial — seeded in the backend's source and identical
 * for every install — so it is served from the API but is not per-user data.
 *
 * What IS per-user is the occurrence line in the header. The fixture hardcoded
 * `hit 3× in acme/checkout-service` on every concept, naming a repository the
 * reader has never connected. With `?repo=` the count comes from that
 * project's `finding_history`; without it, the clause is omitted rather than
 * guessed.
 */
export default async function ConceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ repo?: string }>;
}) {
  const [{ slug }, { repo }] = await Promise.all([params, searchParams]);

  const concept = await loadConcept(slug);
  if (!concept) notFound();

  const [signals, repository, vulnTokens, safeTokens] = await Promise.all([
    repo && !USE_FIXTURES ? skillSignalsServer(repo) : Promise.resolve(null),
    repo && !USE_FIXTURES ? repositoryServer(repo) : Promise.resolve(null),
    tokenizeCode(concept.vulnerable.code, concept.vulnerable.language),
    tokenizeCode(concept.safe.code, concept.safe.language),
  ]);

  const signal = signals?.find((s) => s.conceptId === concept.id) ?? null;

  return (
    <div className="h-full overflow-y-auto">
      {/* Reading measure, not full-bleed. Prose is the product on this screen. */}
      <div className="mx-auto max-w-[860px] px-5 py-4">
        <Link
          href={repo ? `/learning?repo=${encodeURIComponent(repo)}` : "/learning"}
          className="inline-flex h-6 items-center gap-1 text-2xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={11} aria-hidden />
          Learning
        </Link>

        <header className="mt-2 border-b border-subtle pb-4">
          <h1 className="text-xl font-semibold tracking-[-0.014em] text-fg">{concept.title}</h1>
          <p className="tnum mt-1 font-mono text-2xs text-fg-muted">
            {concept.category} · {concept.difficulty} · {concept.readMinutes} min read
            {concept.relatedCwe ? ` · ${concept.relatedCwe}` : ""}
            {USE_FIXTURES
              ? ` · hit ${concept.timesHit}× in acme/checkout-service`
              : occurrenceClause(signal?.occurrences, repository?.name)}
          </p>
          <p className="prose-explain mt-3">{concept.summary}</p>
        </header>

        <section className="border-b border-subtle py-4">
          <Eyebrow>Key points</Eyebrow>
          <ul className="mt-2 space-y-2">
            {concept.keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="tnum mt-[3px] w-3 shrink-0 text-right font-mono text-2xs text-fg-faint">
                  {i + 1}
                </span>
                <span className="text-base leading-[1.6] text-fg-secondary">{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-subtle py-4">
          <Eyebrow>Worked example</Eyebrow>
          <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <X size={12} style={{ color: "var(--sev-critical)" }} aria-hidden />
                <span className="text-2xs font-medium text-critical-fg">Vulnerable</span>
              </div>
              <CodeBlock tokens={vulnTokens} accent="critical" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5">
                <Check size={12} style={{ color: "var(--sev-success)" }} aria-hidden />
                <span className="text-2xs font-medium text-success-fg">Safe</span>
              </div>
              <CodeBlock tokens={safeTokens} accent="success" />
            </div>
          </div>
        </section>

        <section className="py-4">
          <Eyebrow>Check yourself</Eyebrow>
          <SelfCheck question={concept.question} />
        </section>

        <div className="h-8" />
      </div>
    </div>
  );
}

/**
 * Only claims a count when there is both a repository to name and a signal to
 * count. "hit 0×" and "hit 3× in this repo" with no repo named are both worse
 * than saying nothing.
 */
function occurrenceClause(occurrences: number | undefined, repoName: string | undefined): string {
  if (!repoName) return "";
  if (!occurrences) return ` · not hit in ${repoName}`;
  return ` · hit ${occurrences}× in ${repoName}`;
}

async function loadConcept(slug: string): Promise<Concept | null> {
  if (USE_FIXTURES) return CONCEPTS.find((c) => c.id === slug) ?? null;
  // Falls back to the bundled copy if the API is down: this content is
  // editorial and identical either way, so serving it offline costs the reader
  // nothing and is not a claim about their code.
  return (await conceptServer(slug)) ?? CONCEPTS.find((c) => c.id === slug) ?? null;
}
