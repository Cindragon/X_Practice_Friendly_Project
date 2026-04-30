"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidUserId } from "@/lib/userid";

export function SetupUsernameForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localOk = value.length === 0 || isValidUserId(value);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidUserId(value)) {
      setError(
        "userID must be 3–15 characters (letters, digits, underscore) and cannot start with a digit."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me/userid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userID: value }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `Request failed (${res.status})`);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 focus-within:border-sky-500">
        <span className="text-zinc-400">@</span>
        <input
          autoFocus
          name="userID"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="your_handle"
          className="flex-1 bg-transparent text-zinc-900 placeholder-zinc-400 outline-none"
          autoComplete="off"
          maxLength={15}
        />
      </label>

      {!localOk && (
        <p className="text-xs text-amber-700">
          3–15 chars, letters/digits/underscore, must not start with a digit.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !isValidUserId(value)}
        className="mt-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {submitting ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
