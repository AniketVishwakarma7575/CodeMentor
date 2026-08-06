import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { CONCEPTS } from "@/data/repo";
import { tokenizeCode } from "@/lib/highlight";
import { Eyebrow } from "@/components/ui/primitives";
import { CodeBlock } from "@/components/learning/code-block";
import { SelfCheck } from "@/components/learning/self-check";

export function generateStaticParams() {
  return CONCEPTS.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concept = CONCEPTS.find((c) => c.id === slug);
  return { title: concept?.title ?? "Concept" };
}

export default async function ConceptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const concept = CONCEPTS.find((c) => c.id === slug);
  if (!concept) notFound();

  const [vulnTokens, safeTokens] = await Promise.all([
    tokenizeCode(concept.vulnerable.code, concept.vulnerable.language),
    tokenizeCode(concept.safe.code, concept.safe.language),
  ]);

  return (
    <div className="h-full overflow-y-auto">
      {/* Reading measure, not full-bleed. Prose is the product on this screen. */}
      <div className="mx-auto max-w-[860px] px-5 py-4">
        <Link
          href="/learning"
          className="inline-flex h-6 items-center gap-1 text-2xs text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={11} aria-hidden />
          Learning
        </Link>

        <header className="mt-2 border-b border-subtle pb-4">
          <h1 className="text-xl font-semibold tracking-[-0.014em] text-fg">{concept.title}</h1>
          <p className="tnum mt-1 font-mono text-2xs text-fg-muted">
            {concept.category} · {concept.difficulty} · {concept.readMinutes} min read
            {concept.relatedCwe ? ` · ${concept.relatedCwe}` : ""} · hit {concept.timesHit}× in{" "}
            acme/checkout-service
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
