import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutAction } from "./actions";

/**
 * Temporary home page — Step 3 placeholder. Real Home (with sidebar +
 * timeline) is built in later steps. For now this just confirms the auth
 * flow works end to end.
 */
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.userID) redirect("/setup-username");

  return (
    <main className="flex flex-1 items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Friendly</h1>
        <p className="mt-4 text-zinc-400">
          Welcome, {session.user.name ?? "friend"} —{" "}
          <span className="text-sky-400">@{session.user.userID}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Step 3 done. Sidebar, profile and posts arrive in later steps.
        </p>

        <form action={signOutAction} className="mt-8">
          <button
            type="submit"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
