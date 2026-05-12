/**
 * Shared text rules for Friendly posts.
 *
 * Per spec (X-style):
 *   - Hard limit is 280 "effective" characters.
 *   - Each URL counts as exactly 23, regardless of its real length.
 *   - @mentions don't count toward the limit at all (0).
 *   - #hashtags don't count toward the limit at all (0).
 *   - Everything else is counted by its real character length.
 *
 * We parse once at write time so feeds and post pages don't have to re-parse
 * on every read. Mentions are stored as bare userIDs (no @), hashtags as
 * lowercased tag bodies (no #).
 */

export const MAX_LENGTH = 280;
export const LINK_WEIGHT = 23;

/**
 * URL detector — http or https only. Intentionally simple: we don't try to
 * parse www.foo.com (no scheme) because Twitter's rule was always scheme-
 * required, and it keeps the regex auditable.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

/**
 * Mention — must match the userID rule (3–15 chars, letters/digits/_,
 * cannot start with a digit). Anything else (e.g. `@123abc`, `@a`) is just
 * literal text and DOES count toward the limit.
 */
const MENTION_RE = /(^|[^A-Za-z0-9_])@([A-Za-z_][A-Za-z0-9_]{2,14})\b/g;

/**
 * Hashtag — letter first, then letters/digits/underscore. We disallow
 * pure-digit tags so "#1" doesn't swallow numbers in normal prose.
 */
const HASHTAG_RE = /(^|[^A-Za-z0-9_])#([A-Za-z][A-Za-z0-9_]*)\b/g;

/** Trim trailing punctuation that's almost certainly not part of the URL. */
function trimUrl(u: string): string {
  return u.replace(/[)\].,;:!?'"]+$/, "");
}

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) out.push(trimUrl(m[0]));
  return out;
}

export function extractMentions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) out.push(m[2]);
  // de-dup, preserve order
  return Array.from(new Set(out));
}

export function extractHashtags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(HASHTAG_RE)) out.push(m[2].toLowerCase());
  return Array.from(new Set(out));
}

/**
 * Effective length used to enforce the 280 limit. We compute it by
 * subtracting the "cheap" tokens from the raw length and adding back their
 * fixed weights:
 *
 *   effective = raw
 *              - sum(real length of every URL)        + 23 * (#URLs)
 *              - sum(length of every @mention token)  + 0
 *              - sum(length of every #hashtag token)  + 0
 *
 * Mentions / hashtags include their leading @ or # in the substring length
 * (since both are part of what the user typed).
 */
export function effectiveLength(text: string): number {
  let n = text.length;

  for (const m of text.matchAll(URL_RE)) {
    const u = trimUrl(m[0]);
    n -= u.length;
    n += LINK_WEIGHT;
  }
  for (const m of text.matchAll(MENTION_RE)) {
    // m[2] is the handle (no @); the token in the text is "@" + handle.
    n -= m[2].length + 1;
  }
  for (const m of text.matchAll(HASHTAG_RE)) {
    n -= m[2].length + 1;
  }
  return n;
}

/** Parse once, return the bits a route handler needs to persist. */
export function parsePost(text: string) {
  return {
    mentions: extractMentions(text),
    hashtags: extractHashtags(text),
    urls: extractUrls(text),
    effectiveLength: effectiveLength(text),
  };
}
