const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MIXI2_POST_URL_RE =
  /https?:\/\/(?:www\.)?mixi\.social\/(?:@[\w.]+\/)?posts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
const MIXI2_HANDLE_IN_URL_RE =
  /https?:\/\/(?:www\.)?mixi\.social\/@?([A-Za-z0-9_.]+)\/posts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Accepts any of the following and returns the post UUID, or null:
 *   - https://mixi.social/@username/posts/{uuid}
 *   - https://mixi.social/posts/{uuid}
 *   - {uuid}  (bare)
 */
export function parsePostId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(UUID_RE);
  if (!match) return null;
  return match[0].toLowerCase();
}

/**
 * Returns true only for strict mixi2 post URLs (host = mixi.social).
 */
export function isMixi2PostUrl(input: string): boolean {
  return new RegExp(MIXI2_POST_URL_RE.source, 'i').test(input);
}

/**
 * Extracts mixi2 post URLs from arbitrary text and returns each URL with its
 * UUID. De-duplicates by UUID and caps at `max`.
 */
export function extractMixi2PostRefs(
  text: string,
  max = 4
): { id: string; url: string }[] {
  const seen = new Set<string>();
  const refs: { id: string; url: string }[] = [];
  for (const m of text.matchAll(MIXI2_POST_URL_RE)) {
    const id = m[1]?.toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    refs.push({ id, url: m[0] });
    if (refs.length >= max) break;
  }
  return refs;
}

export function postUrl(postId: string, username?: string): string {
  if (username) {
    const handle = username.startsWith('@') ? username : `@${username}`;
    return `https://mixi.social/${handle}/posts/${postId}`;
  }
  return `https://mixi.social/posts/${postId}`;
}

export function userUrl(username: string): string {
  const handle = username.startsWith('@') ? username : `@${username}`;
  return `https://mixi.social/${handle}`;
}

/**
 * Extract the mixi2 user handle (without `@`) from a post URL, if present.
 *   "https://mixi.social/@rin_montblank/posts/abc" → "rin_montblank"
 *   "https://mixi.social/posts/abc"                 → null
 */
export function extractHandleFromInput(input: string): string | null {
  const m = MIXI2_HANDLE_IN_URL_RE.exec(input.trim());
  const handle = m?.[1] ?? null;
  if (!handle || handle === 'posts') return null;
  return handle;
}

/**
 * Build a share-friendly URL on the embedder's own origin.
 * Discord / Twitter / Slack will fetch this URL and read its OGP meta tags.
 *
 *   buildShareUrl(origin, id, "rin_montblank")
 *   → "{origin}/@rin_montblank/posts/{id}"
 *
 *   buildShareUrl(origin, id, null)
 *   → "{origin}/posts/{id}"
 */
export function buildShareUrl(
  origin: string,
  postId: string,
  username?: string | null
): string {
  const trimmed = origin.replace(/\/$/, '');
  if (username) {
    return `${trimmed}/@${username}/posts/${postId}`;
  }
  return `${trimmed}/posts/${postId}`;
}
