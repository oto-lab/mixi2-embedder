import { Client, OAuth2Authenticator, type Post, type User } from 'mixi2-js';
import { apiAddress, tokenUrl } from 'mixi2-js/helpers';

let cachedClient: Client | null = null;

function getClient(): Client {
  if (cachedClient) return cachedClient;

  const clientId = import.meta.env.MIXI2_CLIENT_ID;
  const clientSecret = import.meta.env.MIXI2_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'MIXI2_CLIENT_ID / MIXI2_CLIENT_SECRET is not configured. ' +
        "Set them in .env (local) or in the Vercel project's Environment Variables."
    );
  }

  const authenticator = new OAuth2Authenticator({
    clientId,
    clientSecret,
    tokenUrl: import.meta.env.MIXI2_TOKEN_URL ?? tokenUrl,
  });

  cachedClient = new Client({
    apiAddress: import.meta.env.MIXI2_API_ADDRESS ?? apiAddress,
    authenticator,
  });

  return cachedClient;
}

type CacheEntry = {
  post: Post | null;
  fetchedAt: number;
};

const POST_CACHE_TTL_MS = 5 * 60 * 1000;
const postCache = new Map<string, CacheEntry>();

export type FetchPostResult =
  | { ok: true; post: Post }
  | { ok: false; reason: 'not_found' | 'deleted' | 'error'; message?: string };

export async function fetchPost(postId: string): Promise<FetchPostResult> {
  const cached = postCache.get(postId);
  if (cached && Date.now() - cached.fetchedAt < POST_CACHE_TTL_MS) {
    if (cached.post === null) {
      return { ok: false, reason: 'not_found' };
    }
    if (cached.post.isDeleted) {
      return { ok: false, reason: 'deleted' };
    }
    return { ok: true, post: cached.post };
  }

  try {
    const client = getClient();
    const posts = await client.getPosts([postId]);
    const post = posts[0] ?? null;

    postCache.set(postId, { post, fetchedAt: Date.now() });

    if (!post) return { ok: false, reason: 'not_found' };
    if (post.isDeleted) return { ok: false, reason: 'deleted' };
    return { ok: true, post };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', message };
  }
}

export async function fetchUser(userId: string): Promise<User | null> {
  const map = await fetchUsers([userId]);
  return map.get(userId) ?? null;
}

const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map<string, { user: User; fetchedAt: number }>();

export async function fetchUsers(
  userIds: string[]
): Promise<Map<string, User>> {
  const result = new Map<string, User>();
  const missing: string[] = [];

  for (const id of userIds) {
    if (!id) continue;
    const cached = userCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < USER_CACHE_TTL_MS) {
      result.set(id, cached.user);
    } else if (!result.has(id) && !missing.includes(id)) {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    try {
      const client = getClient();
      const users = await client.getUsers(missing);
      const now = Date.now();
      for (const u of users) {
        userCache.set(u.userId, { user: u, fetchedAt: now });
        result.set(u.userId, u);
      }
    } catch {
      // swallow: callers handle null/missing
    }
  }

  return result;
}

export async function fetchPosts(
  postIds: string[]
): Promise<Map<string, Post>> {
  const result = new Map<string, Post>();
  const missing: string[] = [];

  for (const id of postIds) {
    if (!id) continue;
    const cached = postCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < POST_CACHE_TTL_MS) {
      if (cached.post && !cached.post.isDeleted) result.set(id, cached.post);
    } else if (!missing.includes(id)) {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    try {
      const client = getClient();
      const posts = await client.getPosts(missing);
      const now = Date.now();
      const returned = new Set<string>();
      for (const p of posts) {
        postCache.set(p.postId, { post: p, fetchedAt: now });
        returned.add(p.postId);
        if (!p.isDeleted) result.set(p.postId, p);
      }
      // Cache misses as null so we don't keep re-asking
      for (const id of missing) {
        if (!returned.has(id)) {
          postCache.set(id, { post: null, fetchedAt: now });
        }
      }
    } catch {
      // swallow
    }
  }

  return result;
}
