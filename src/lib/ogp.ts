export type OgpData = {
  url: string;
  hostname: string;
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
};

const OGP_CACHE_TTL_MS = 60 * 60 * 1000;
const OGP_FETCH_TIMEOUT_MS = 5_000;
const OGP_MAX_BYTES = 256 * 1024;
const OGP_USER_AGENT =
  'Mozilla/5.0 (compatible; mixi2-embedder/0.1; +https://github.com/oto-lab/mixi2-embedder)';

type CacheEntry = { data: OgpData | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();

const URL_RE = /https?:\/\/[^\s<>"'　-〿＀-￯]+/g;

export function extractUrls(text: string, max = 3): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    url = url.replace(/[)\].,!?、。」』）]+$/u, '');
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h === '::1' || h.startsWith('[::1')) return true;
  if (
    h.startsWith('[fe80:') ||
    h.startsWith('[fc00:') ||
    h.startsWith('[fd00:')
  )
    return true;
  return false;
}

export async function fetchOgp(rawUrl: string): Promise<OgpData | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (isPrivateHostname(parsed.hostname)) return null;

  const key = parsed.toString();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < OGP_CACHE_TTL_MS) {
    return cached.data;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OGP_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(key, {
      method: 'GET',
      headers: {
        'User-Agent': OGP_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.5',
        'Accept-Language': 'ja,en;q=0.5',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().includes('html')) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const html = await readLimitedText(res, OGP_MAX_BYTES);

    const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
    const head = headMatch?.[1] ?? html;

    const finalUrl = res.url || key;
    const meta = extractMeta(head, finalUrl);

    if (!meta.title && !meta.description && !meta.image) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const data: OgpData = {
      url: finalUrl,
      hostname: safeHostname(finalUrl) ?? parsed.hostname,
      ...meta,
    };
    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch {
    cache.set(key, { data: null, fetchedAt: Date.now() });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
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
  const ct = res.headers.get('content-type') ?? '';
  const charsetMatch = /charset=([^;]+)/i.exec(ct);
  const charset = charsetMatch?.[1]?.trim().toLowerCase() ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

function extractMeta(
  head: string,
  baseUrl: string
): Pick<OgpData, 'title' | 'description' | 'siteName' | 'image'> {
  const result: {
    title?: string;
    description?: string;
    siteName?: string;
    image?: string;
  } = {};
  const metaRe = /<meta\b[^>]*>/gi;
  for (const m of head.matchAll(metaRe)) {
    const tag = m[0];
    const key = (
      getAttr(tag, 'property') ?? getAttr(tag, 'name')
    )?.toLowerCase();
    if (!key) continue;
    const content = getAttr(tag, 'content');
    if (!content) continue;

    if (key === 'og:title') {
      result.title = decodeEntities(content);
    } else if (!result.title && key === 'twitter:title') {
      result.title = decodeEntities(content);
    } else if (key === 'og:description') {
      result.description = decodeEntities(content);
    } else if (
      !result.description &&
      (key === 'twitter:description' || key === 'description')
    ) {
      result.description = decodeEntities(content);
    } else if (key === 'og:site_name') {
      result.siteName = decodeEntities(content);
    } else if (key === 'og:image' || key === 'og:image:url') {
      try {
        result.image = new URL(content, baseUrl).toString();
      } catch {
        // skip invalid image url
      }
    } else if (!result.image && key === 'twitter:image') {
      try {
        result.image = new URL(content, baseUrl).toString();
      } catch {
        // skip
      }
    }
  }

  if (!result.title) {
    const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
    if (tm?.[1]) result.title = decodeEntities(tm[1].trim());
  }

  return result;
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]*))`,
    'i'
  );
  const m = re.exec(tag);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => {
      const code = parseInt(d, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}
