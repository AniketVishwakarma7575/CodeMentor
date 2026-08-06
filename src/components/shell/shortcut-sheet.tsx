"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { SHORTCUTS, SHORTCUT_GROUPS, keyLabel } from "@/lib/shortcuts";
import { isMac } from "@/lib/utils";
import { overlayVariants, paletteVariants } from "@/lib/motion";
import { Kbd } from "@/components/ui/primitives";

export function ShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // Resolved after mount so SSR and client agree on the ⌘/Ctrl glyph.
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => setMac(isMac()), []);

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
                variants={paletteVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed left-1/2 top-[10vh] z-50 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-strong bg-elevated shadow-[var(--shadow-dialog)]"
              >
                <div className="flex h-10 items-center justify-between border-b border-subtle px-4">
                  <Dialog.Title className="text-sm font-medium text-fg">Keyboard shortcuts</Dialog.Title>
                  <Kbd>Esc</Kbd>
                </div>

                <div className="grid max-h-[68vh] grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto p-4">
                  {SHORTCUT_GROUPS.map((group) => {
                    const rows = SHORTCUTS.filter((s) => s.group === group);
                    if (!rows.length) return null;
                    return (
                      <section key={group}>
                        <h3 className="mb-1.5 text-2xs font-medium uppercase tracking-[0.04em] text-fg-faint">
                          {group}
                        </h3>
                        <ul className="space-y-0.5">
                          {rows.map((s) => (
                            <li
                              key={s.id}
                              className="flex h-7 items-center justify-between gap-4 rounded-md px-1.5 hover:bg-hover"
                            >
                              <span className="truncate text-sm text-fg-secondary">{s.label}</span>
                              <span className="flex shrink-0 items-center gap-0.5">
                                {s.keys.map((k) => (
                                  <Kbd key={k}>{keyLabel(k, mac)}</Kbd>
                                ))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>

                <p className="border-t border-subtle px-4 py-2 text-2xs text-fg-faint">
                  Single-letter shortcuts are suppressed while a text field has focus.
                </p>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
