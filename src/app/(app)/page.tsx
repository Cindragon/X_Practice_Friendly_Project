import { requireUser } from "@/lib/session";

/**
 * Home page (middle column). Real timeline lands in Step 8; this is a
 * Step-4 shell that confirms the layout works end to end.
 */
export default async function HomePage() {
  const user = await requireUser();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Home</h1>
      </header>

      <div className="flex flex-1 items-center justify-center p-12 text-center text-zinc-500">
        <div>
          <p className="text-zinc-700">
            Welcome back, <span className="text-sky-600">@{user.userID}</span>.
          </p>
          <p className="mt-2 text-sm">
            Timeline goes here once we wire posts up in Step 8.
          </p>
        </div>
      </div>
    </>
  );
}
