/**
 * API base URL.
 *
 * NEXT_PUBLIC_ so it is readable from client components (the SSE subscription
 * and every mutation run in the browser). Falls back to localhost so a fresh
 * clone runs without a .env.local.
 */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

/**
 * Kill switch. Set NEXT_PUBLIC_USE_FIXTURES=true to render from src/data/
 * instead of the network — useful for design work, Storybook, and when the
 * backend is down. Every fetcher checks this.
 */
export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';

/** Abort a request that hangs. The browser's default is effectively forever. */
export const REQUEST_TIMEOUT_MS = 15_000;
