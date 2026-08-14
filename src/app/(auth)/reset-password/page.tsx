import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your CodeMentor AI account.",
  /**
   * ⚠️ The URL of this page contains a one-time account-takeover token. Telling
   *    crawlers not to index it is the cheap half of keeping it out of places it
   *    should not be; the short expiry and single use are the real controls.
   */
  robots: { index: false, follow: false },
};

/**
 * The page a reset link opens. `?token=` is the credential.
 *
 * The token is read on the server and handed to the client component as a prop
 * rather than being pulled out of `window.location` — same value, but it keeps
 * the "is there a token at all" branch out of the rendered form entirely.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? null} />;
}
