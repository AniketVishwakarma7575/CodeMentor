"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Dark is the default, light is a peer — not a fallback.
 *
 * next-themes injects a blocking inline script before paint, so the class is
 * on <html> before the first frame. There is no flash of the wrong theme, and
 * no `mounted` guard is needed anywhere except where we render a *label* for
 * the current theme (see theme-toggle).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark"]}
      storageKey="codementor-theme"
    >
      {children}
    </NextThemes>
  );
}
