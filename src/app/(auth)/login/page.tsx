import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to CodeMentor AI.",
};

/**
 * `?next=` is where to land after signing in — set by the middleware when it
 * intercepts a deep link. `?reason=` explains WHY the user is here, so an
 * expired session says so instead of looking like a random sign-out.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return <LoginForm next={next ?? null} reason={reason ?? null} />;
}
