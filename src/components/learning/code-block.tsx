import type { TokenLine } from "@/lib/highlight";
import { cn } from "@/lib/utils";

/**
 * Static, server-rendered code block. A 3px left rule carries the
 * vulnerable/safe distinction alongside the icon and label above it — three
 * channels, so the pairing survives greyscale and CVD.
 */
export function CodeBlock({
  tokens,
  accent,
  className,
}: {
  tokens: TokenLine[];
  accent?: "critical" | "success";
  className?: string;
}) {
  return (
    <div
      className={cn("scroll-x overflow-hidden rounded-md border border-subtle bg-inset", className)}
      style={
        accent
          ? {
              borderLeftWidth: 3,
              borderLeftColor:
                accent === "critical" ? "var(--sev-critical)" : "var(--sev-success)",
            }
          : undefined
      }
    >
      <pre className="scroll-x px-3 py-2 font-mono text-2xs leading-[1.5]">
        <code>
          {tokens.map((line, i) => (
            <span key={i} className="block whitespace-pre">
              {line.length === 0 ? " " : null}
              {line.map((t, ti) => (
                <span
                  key={ti}
                  style={{ color: `var(--code-${t.v})`, fontStyle: t.i ? "italic" : undefined }}
                >
                  {t.c}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
