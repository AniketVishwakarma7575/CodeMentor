import type { Metadata } from "next";
import { USE_FIXTURES } from "@/lib/api/config";
import { sessionsServer } from "@/lib/api/server-fetchers";
import { AccountClient } from "./account-client";

export const metadata: Metadata = { title: "Account" };

/**
 * Account settings.
 *
 * The session list is read on the server so it is present on first paint;
 * everything else is a form whose initial value already lives in the auth
 * context. In fixture mode there is no API to ask, and an invented list of
 * devices would be the one fixture in this product that could actually mislead
 * someone about their own security — so it is null, and the screen says why.
 */
export default async function AccountPage() {
  const sessions = USE_FIXTURES ? null : await sessionsServer();
  return <AccountClient initialSessions={sessions} />;
}
