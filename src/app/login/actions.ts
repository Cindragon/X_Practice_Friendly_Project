"use server";

import { signIn } from "@/auth";

/**
 * Server action invoked by the OAuth buttons. Auth.js handles the redirect.
 */
export async function signInWith(provider: "google" | "github" | "facebook") {
  await signIn(provider, { redirectTo: "/" });
}
