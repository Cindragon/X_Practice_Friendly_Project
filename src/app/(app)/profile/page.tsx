import { requireUser } from "@/lib/session";

/**
 * Profile placeholder. Real profile (banner, avatar, edit modal, tabs) lands
 * in Step 6; this just proves the route is reachable from the sidebar and
 * inherits the (app) layout shell.
 */
export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-zinc-500">@{user.userID}</p>
      </header>

      <div className="flex flex-1 items-center justify-center p-12 text-center text-zinc-500">
        <p className="text-sm">
          Profile content arrives in Step 6 (banner, avatar, edit modal,
          Posts/Likes tabs).
        </p>
      </div>
    </>
  );
}
