import { Skeleton } from "@/components/ui/primitives";

/**
 * Route-level skeleton. It is the review screen's silhouette — three panes,
 * a file list on the left, numbered code in the middle, a card on the right.
 * The user recognises the layout before any data arrives.
 */
export function ReviewSkeleton() {
  return (
    <div className="flex h-full w-full" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading review</span>

      {/* left */}
      <div className="hidden w-[260px] shrink-0 flex-col border-r border-subtle lg:flex">
        <div className="flex h-9 items-center gap-2 border-b border-subtle px-3">
          <Skeleton className="h-[10px] w-24" />
        </div>
        <div className="flex flex-wrap gap-1 border-b border-subtle p-2">
          {[56, 44, 52, 38, 48].map((w, i) => (
            <Skeleton key={i} className="h-[20px] rounded-sm" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-1 p-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: (i % 3) * 10 }}>
              <Skeleton className="h-3 w-3 rounded-xs" />
              <Skeleton className="h-[11px]" />
              <Skeleton className="ml-auto h-[8px] w-6" />
            </div>
          ))}
        </div>
      </div>

      {/* center */}
      <div className="flex min-w-0 flex-1 flex-col bg-inset">
        <div className="flex h-9 items-center gap-2 border-b border-subtle bg-surface px-3">
          <Skeleton className="h-[10px] w-40" />
          <Skeleton className="ml-auto h-[10px] w-16" />
        </div>
        <div className="space-y-[6px] p-3">
          {Array.from({ length: 26 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-[9px] w-5 shrink-0" />
              <Skeleton
                className="h-[9px]"
                // Varying widths so it reads as code, not as a paragraph.
                style={{ width: `${[62, 38, 74, 46, 55, 30, 68][i % 7]}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* right */}
      <div className="hidden w-[420px] shrink-0 flex-col border-l border-subtle xl:flex">
        <div className="border-b border-subtle px-4 py-3">
          <div className="flex gap-2">
            <Skeleton className="h-[20px] w-16 rounded-sm" />
            <Skeleton className="h-[10px] w-24" />
          </div>
          <Skeleton className="mt-2.5 h-4 w-[75%]" />
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-[11px] w-full" />
          <Skeleton className="h-[11px] w-[88%]" />
          <Skeleton className="h-[140px] w-full rounded-md" />
          <Skeleton className="h-[11px] w-[60%]" />
        </div>
      </div>
    </div>
  );
}
