import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Session helper for server components / route handlers.
 *
 * Use in any page that lives under the (app) route group: it guarantees
 *   - the visitor is signed in (otherwise → /login)
 *   - they have completed the userID setup (otherwise → /setup-username)
 *
 * Returns the resolved session.user with a non-null `userID`.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.userID) redirect("/setup-username");
  return session.user as typeof session.user & { userID: string };
}
