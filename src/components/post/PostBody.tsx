import Link from "next/link";
import { Fragment } from "react";

/**
 * Render post content as a stream of plain text + clickable tokens.
 *
 * We tokenise here instead of using `dangerouslySetInnerHTML` for safety:
 * the content is user input, so it never touches the DOM as HTML.
 *
 * Tokens recognised (same rules as the 280-count logic in
 * src/lib/post-text.ts so the UI and the counter agree):
 *   - https?://… URLs           → external <a target=_blank rel=noreferrer>
 *   - @userID (3–15, !digit-start) → /u/[userID] link
 *   - #hashtag (letter-first)     → /explore/tag/[tag] link (route is a stub
 *                                   for now; tag pages are a later step)
 */
type Token =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string }
  | { kind: "mention"; handle: string }
  | { kind: "hashtag"; tag: string };

// Order matters: longer / more specific patterns first.
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;
const MENTION_RE = /(^|[^A-Za-z0-9_])@([A-Za-z_][A-Za-z0-9_]{2,14})\b/g;
const HASHTAG_RE = /(^|[^A-Za-z0-9_])#([A-Za-z][A-Za-z0-9_]*)\b/g;

function trimUrl(u: string) {
  return u.replace(/[)\].,;:!?'"]+$/, "");
}

/** Walk the string once, collecting non-overlapping token ranges. */
function tokenize(text: string): Token[] {
  type Range = {
    start: number;
    end: number;
    token: Exclude<Token, { kind: "text" }>;
  };
  const ranges: Range[] = [];

  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0];
    const u = trimUrl(raw);
    ranges.push({
      start: m.index!,
      end: m.index! + u.length,
      token: { kind: "url", value: u },
    });
  }
  for (const m of text.matchAll(MENTION_RE)) {
    const lead = m[1];
    const start = m.index! + lead.length;
    const end = start + 1 + m[2].length;
    ranges.push({
      start,
      end,
      token: { kind: "mention", handle: m[2] },
    });
  }
  for (const m of text.matchAll(HASHTAG_RE)) {
    const lead = m[1];
    const start = m.index! + lead.length;
    const end = start + 1 + m[2].length;
    ranges.push({
      start,
      end,
      token: { kind: "hashtag", tag: m[2] },
    });
  }

  // Sort and drop overlaps (first-claim wins — same precedence as detection
  // order since URLs are matched first).
  ranges.sort((a, b) => a.start - b.start);
  const accepted: Range[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue;
    accepted.push(r);
    cursor = r.end;
  }

  const out: Token[] = [];
  let i = 0;
  for (const r of accepted) {
    if (r.start > i) {
      out.push({ kind: "text", value: text.slice(i, r.start) });
    }
    out.push(r.token);
    i = r.end;
  }
  if (i < text.length) out.push({ kind: "text", value: text.slice(i) });
  return out;
}

export function PostBody({
  content,
  deleted,
}: {
  content: string;
  deleted?: boolean;
}) {
  if (deleted) {
    return (
      <p className="text-zinc-400 italic">This post has been deleted.</p>
    );
  }
  if (!content) return null;

  const tokens = tokenize(content);

  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-900">
      {tokens.map((t, i) => {
        switch (t.kind) {
          case "text":
            return <Fragment key={i}>{t.value}</Fragment>;
          case "url":
            return (
              <a
                key={i}
                href={t.value}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sky-600 hover:underline"
              >
                {t.value}
              </a>
            );
          case "mention":
            return (
              <Link
                key={i}
                href={`/u/${t.handle}`}
                className="text-sky-600 hover:underline"
              >
                @{t.handle}
              </Link>
            );
          case "hashtag":
            return (
              <Link
                key={i}
                href={`/explore/tag/${t.tag}`}
                className="text-sky-600 hover:underline"
              >
                #{t.tag}
              </Link>
            );
        }
      })}
    </p>
  );
}
