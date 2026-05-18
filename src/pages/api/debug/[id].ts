import type { APIRoute } from 'astro';
import { fetchPost, fetchUser } from '~/lib/mixi2';
import { fetchQuotedPostId } from '~/lib/mixi2-web';
import { parsePostId, extractMixi2PostRefs } from '~/lib/parse';
import { extractUrls } from '~/lib/ogp';

export const prerender = false;

// Dev-only endpoint. `import.meta.env.PROD` is replaced at build time, so the
// body below is dead-code-eliminated in production bundles and the Vercel
// function returns a static 404.
export const GET: APIRoute = async ({ params }) => {
  if (import.meta.env.PROD) {
    return new Response('Not found', { status: 404 });
  }

  const rawId = params['id'] ?? '';
  const postId = parsePostId(rawId);
  if (!postId) {
    return new Response(JSON.stringify({ error: 'invalid id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const result = await fetchPost(postId);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.reason, message: result.message }),
      { status: 404, headers: { 'content-type': 'application/json' } }
    );
  }

  const post = result.post;
  const [user, scrapedQuoteId] = await Promise.all([
    fetchUser(post.creatorId),
    fetchQuotedPostId(post.postId),
  ]);
  const mixi2Refs = extractMixi2PostRefs(post.text, 4);
  const allUrls = extractUrls(post.text, 10);

  return new Response(
    JSON.stringify(
      {
        post: {
          ...post,
          createdAt: post.createdAt?.toISOString(),
        },
        user,
        extracted: {
          mixi2PostRefs: mixi2Refs,
          allUrlsInText: allUrls,
          scrapedQuoteId,
        },
        flags: {
          isReply: !!post.inReplyToPostId,
          inReplyToPostId: post.inReplyToPostId ?? null,
          containsQuoteUrl: mixi2Refs.length > 0,
          hasScrapedQuote: !!scrapedQuoteId,
        },
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
};
