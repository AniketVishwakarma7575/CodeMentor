"use client";

import { Link2, Printer } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/primitives";

export function PrintButton() {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="no-print flex shrink-0 items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          navigator.clipboard?.writeText(window.location.href);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
      >
        <Link2 size={12} aria-hidden />
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer size={12} aria-hidden />
        Print / PDF
      </Button>
    </div>
  );
}
