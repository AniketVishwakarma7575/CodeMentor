/**
 * The auth routes deliberately have NO app shell.
 *
 * No nav rail, no top bar, no project switcher — none of it means anything to
 * someone who is not signed in, and rendering a disabled chrome around a login
 * form is the tell of an auth screen bolted onto an app rather than designed
 * as its front door.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
