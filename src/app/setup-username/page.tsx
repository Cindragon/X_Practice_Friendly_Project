import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SetupUsernameForm } from "./SetupUsernameForm";

/**
 * First-time username setup. Reached automatically after a fresh OAuth sign-in
 * (see middleware.ts). Once a userID is set on a User row, this page redirects
 * straight to home.
 */
export default async function SetupUsernamePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.userID) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-white text-zinc-900">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold tracking-tight">
          Pick your handle
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          This is how others on Friendly will find and mention you. You
          won&apos;t be able to change it later.
        </p>
        <SetupUsernameForm />
      </div>
    </main>
  );
}
