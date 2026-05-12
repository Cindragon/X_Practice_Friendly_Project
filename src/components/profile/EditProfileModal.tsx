"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
};

/**
 * "Edit Profile" button + modal. Opens an overlay form pre-filled with
 * the user's current values, submits via PATCH /api/users/me, then
 * router.refresh() so the server-rendered profile picks up the change.
 *
 * Validation mirrors src/lib/schemas.ts (bio ≤ 160, URLs valid or empty).
 * Empty strings are allowed and the API normalises them to null.
 */
export function EditProfileModal({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // form state
  const [name, setName] = useState(initial.name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(initial.bannerUrl ?? "");

  // Open the modal and snapshot the current props into form state so
  // cancel = revert. Done at the call site (not in useEffect) to avoid
  // the cascading-render lint rule.
  function openModal() {
    setName(initial.name ?? "");
    setBio(initial.bio ?? "");
    setAvatarUrl(initial.avatarUrl ?? "");
    setBannerUrl(initial.bannerUrl ?? "");
    setError(null);
    setOpen(true);
  }

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Send only the fields that changed; otherwise the API rejects an
    // empty body with 400.
    const body: Record<string, string> = {};
    if (name !== (initial.name ?? "")) body.name = name;
    if (bio !== (initial.bio ?? "")) body.bio = bio;
    if (avatarUrl !== (initial.avatarUrl ?? "")) body.avatarUrl = avatarUrl;
    if (bannerUrl !== (initial.bannerUrl ?? "")) body.bannerUrl = bannerUrl;

    if (Object.keys(body).length === 0) {
      setOpen(false);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to update profile");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-100"
      >
        Edit profile
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit profile</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-sky-500"
                />
              </Field>

              <Field
                label="Bio"
                hint={`${bio.length}/160`}
              >
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Avatar URL">
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-sky-500"
                />
              </Field>

              <Field label="Banner URL">
                <input
                  type="url"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-sky-500"
                />
              </Field>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
