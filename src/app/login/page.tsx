import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { enabledProviderIds } from "@/auth.config";
import { signInWith } from "./actions";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
  facebook: "Continue with Facebook",
};

/**
 * Login page — three OAuth buttons. Providers without configured client
 * IDs/secrets are hidden and replaced with a developer hint.
 */
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.userID ? "/" : "/setup-username");
  }

  const enabled = new Set(enabledProviderIds());
  const all: ("google" | "github" | "facebook")[] = [
    "google",
    "github",
    "facebook",
  ];

  return (
    <main className="flex flex-1 items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-xl">
        <h1 className="text-3xl font-bold tracking-tight">Friendly</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to start sharing what&apos;s happening.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {all.map((provider) => {
            const isEnabled = enabled.has(provider);
            return (
              <form key={provider} action={signInWith.bind(null, provider)}>
                <button
                  type="submit"
                  disabled={!isEnabled}
                  className="w-full rounded-full border border-zinc-700 bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {PROVIDER_LABELS[provider]}
                  {!isEnabled && " (not configured)"}
                </button>
              </form>
            );
          })}
        </div>

        {enabled.size === 0 && (
          <p className="mt-6 rounded-lg bg-amber-950/50 p-3 text-xs text-amber-300">
            No OAuth providers configured. Add at least one of
            <code className="mx-1">AUTH_GOOGLE_*</code>,
            <code className="mx-1">AUTH_GITHUB_*</code>, or
            <code className="mx-1">AUTH_FACEBOOK_*</code> to your{" "}
            <code>.env</code>.
          </p>
        )}
      </div>
    </main>
  );
}
