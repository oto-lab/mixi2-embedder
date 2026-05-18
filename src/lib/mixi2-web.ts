/**
 * Workaround module: the public Application API (used by mixi2-js) does not
 * expose quote relationships on posts. The mixi.social Web app fetches the
 * same posts through its internal "mercury" API which DOES carry a
 * `quotePostId` field. We scrape the server-rendered HTML for this UUID.
 *
 * If the upstream gRPC `Post` ever gains a `quoted_post_id` field, this module
 * can be removed and `fetchPost` can read it directly.
 */

const TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;
const UA = 'Mozilla/5.0 (compatible; mixi2-embedder/0.1)';

type CacheEntry = { quotedId: string | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

// The Next.js server-rendered payload is embedded as a JSON-encoded string
// inside an HTML attribute, so quotes appear as `\"`. Match both `"x":"y"`
// and `\"x\":\"y\"` forms.
const QUOTE_RE =
  /\\?"quotePostId\\?"\s*:\s*\\?"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\?"/i;

export async function fetchQuotedPostId(
  postId: string
): Promise<string | null> {
  const cached = cache.get(postId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.quotedId;
  }

  const url = `https://mixi.social/posts/${encodeURIComponent(postId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html',
        'Accept-Language': 'ja,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) {
      cache.set(postId, { quotedId: null, fetchedAt: Date.now() });
      return null;
    }

    const html = await readLimitedText(res, MAX_BYTES);
    const match = QUOTE_RE.exec(html);
    const quotedId = match?.[1]?.toLowerCase() ?? null;
    const validated =
      quotedId && quotedId !== postId.toLowerCase() ? quotedId : null;

    cache.set(postId, { quotedId: validated, fetchedAt: Date.now() });
    return validated;
  } catch {
    cache.set(postId, { quotedId: null, fetchedAt: Date.now() });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedText(
  res: Response,
  maxBytes: number
): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
      if (total >= maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        break;
      }
    }
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder('utf-8').decode(buf);
}
