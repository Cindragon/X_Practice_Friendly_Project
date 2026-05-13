"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { effectiveLength, MAX_LENGTH } from "@/lib/post-text";
import { charCounterState } from "./charCounter";

/**
 * Always-on inline reply box at the top of /post/[id]'s replies list.
 * Slimmer cousin of PostComposerModal — same text rules, no draft
 * button (drafts are for unfinished standalone posts, not replies).
 */
export function ReplyComposerInline({
  parentId,
  parentAuthorHandle,
}: {
  parentId: string;
  parentAuthorHandle: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { effLen, counter } = useMemo(() => {
    const eff = effectiveLength(text);
    return { effLen: eff, counter: charCounterState(eff) };
  }, [text]);

  const canPost = text.trim().length > 0 && effLen <= MAX_LENGTH && !submitting;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, parentId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to reply");
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const placeholder = parentAuthorHandle
    ? `Reply to @${parentAuthorHandle}`
    : "Post your reply";

  return (
    <div className="border-b border-zinc-200 px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={10_000}
        className="w-full resize-none border-0 px-0 py-1 text-[15px] outline-none placeholder:text-zinc-400"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={clsx(
            "text-xs tabular-nums",
            counter.tone === "danger"
              ? "font-semibold text-red-600"
              : counter.tone === "warn"
                ? "text-amber-600"
                : "text-zinc-500"
          )}
        >
          {counter.remaining}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost}
          className="rounded-full bg-sky-500 px-5 py-1.5 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {submitting ? "Replying…" : "Reply"}
        </button>
      </div>
    </div>
  );
}
