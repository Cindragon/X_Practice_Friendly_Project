"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { effectiveLength, MAX_LENGTH } from "@/lib/post-text";
import { charCounterState } from "./charCounter";

type Props = {
  onClose: () => void;
  /** Reply target — when set, the composer creates a reply not a top-level post. */
  parentId?: string;
  /**
   * Called after a successful post submission, before onClose / refresh.
   * Lets the parent perform optimistic UI updates (e.g. bump the reply
   * count on the action bar so the viewer sees an immediate change
   * without waiting for router.refresh).
   */
  onPostSuccess?: () => void;
};

/**
 * Compose-a-post modal. Used from the sidebar Post button (top-level
 * post) and later from "Reply" affordances on individual posts (parentId).
 *
 * Char rules live in src/lib/post-text.ts and are mirrored client-side
 * here so the counter updates as you type without round-tripping.
 *
 * "Save draft" stores the in-progress text in Mongo so the user can pick
 * it up later. Drafts are NOT auto-loaded — that's a Step 8+ concern.
 */
export function PostComposerModal({
  onClose,
  parentId,
  onPostSuccess,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc closes. The parent only mounts us when the user wants to compose,
  // so we don't need to gate this on an `open` prop — fresh mount = fresh state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { effLen, counter } = useMemo(() => {
    const eff = effectiveLength(text);
    return { effLen: eff, counter: charCounterState(eff) };
  }, [text]);

  const canPost = text.trim().length > 0 && effLen <= MAX_LENGTH && !submitting;
  const canSaveDraft = text.trim().length > 0 && !savingDraft;

  async function onPost() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          ...(parentId ? { parentId } : {}),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to post");
        return;
      }
      onPostSuccess?.();
      onClose();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSaveDraft() {
    setSavingDraft(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(json.error ?? "Failed to save draft");
        return;
      }
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSavingDraft(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/40 p-4 pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={parentId ? "Reply" : "New post"}
        className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">
            {parentId ? "Reply" : "What's happening?"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            parentId ? "Post your reply" : "Share what's on your mind…"
          }
          rows={5}
          className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-[15px] leading-snug outline-none focus:border-sky-400"
          maxLength={10_000}
        />

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span
            className={clsx(
              "text-sm tabular-nums",
              counter.tone === "danger"
                ? "font-semibold text-red-600"
                : counter.tone === "warn"
                  ? "text-amber-600"
                  : "text-zinc-500"
            )}
            title={`${effLen}/${MAX_LENGTH}`}
          >
            {counter.remaining}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!canSaveDraft}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50"
            >
              {savingDraft ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={onPost}
              disabled={!canPost}
              className="rounded-full bg-sky-500 px-5 py-1.5 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {submitting ? "Posting…" : parentId ? "Reply" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
