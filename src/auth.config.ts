import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Facebook from "next-auth/providers/facebook";

/**
 * Build the OAuth provider list dynamically — providers without configured
 * keys are skipped so the dev server still boots before all credentials are
 * filled in. The route handler returns 404 for missing providers.
 */
function buildProviders() {
  const providers: NextAuthConfig["providers"] = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })
    );
  }
  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })
    );
  }
  if (process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET) {
    providers.push(
      Facebook({
        clientId: process.env.AUTH_FACEBOOK_ID,
        clientSecret: process.env.AUTH_FACEBOOK_SECRET,
      })
    );
  }

  return providers;
}

/**
 * Edge-safe Auth.js config — no Prisma here, since middleware runs on the edge
 * runtime and Prisma can't. The full config (with adapter) is composed in
 * `src/auth.ts`.
 */
export const authConfig = {
  providers: buildProviders(),
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /**
     * Used by middleware (edge runtime) to gate routes. We defer the
     * "needs userID" redirect to the middleware itself so this stays simple.
     */
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

/** List of provider IDs that are actually configured — used in the UI. */
export function enabledProviderIds(): string[] {
  return (authConfig.providers ?? []).map((p) => {
    // Provider can be a function or an object depending on construction.
    const id = typeof p === "function" ? p().id : p.id;
    return id as string;
  });
}
