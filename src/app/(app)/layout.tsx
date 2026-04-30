import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Shared shell for every signed-in page.
 *
 *  ┌─────────────┬───────────────────────┐
 *  │             │                       │
 *  │  Sidebar    │     middle column     │
 *  │             │     (children)        │
 *  └─────────────┴───────────────────────┘
 *
 * Per spec the right column is omitted entirely. The middle column has a
 * fixed max-width and centers within the remaining space.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await requireUser();

  // Pull the freshest avatar/name from the DB (Auth.js syncs `image` from
  // the OAuth provider; if the user has overridden `avatarUrl` we prefer it).
  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, image: true, avatarUrl: true },
  });

  const sidebarUser = {
    name: dbUser?.name ?? sessionUser.name ?? "Friend",
    userID: sessionUser.userID,
    avatarUrl: dbUser?.avatarUrl ?? dbUser?.image ?? null,
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1280px] bg-white text-zinc-900">
      <Sidebar user={sidebarUser} />
      <div className="flex min-h-screen w-full max-w-[640px] flex-col border-x border-zinc-200">
        {children}
      </div>
    </div>
  );
}
