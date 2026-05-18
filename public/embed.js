/*!
 * mixi2-embedder
 * https://github.com/oto-lab/mixi2-embedder
 *
 * Place a blockquote on your site and include this script:
 *   <blockquote class="mixi2-embedder-embed" data-mixi2-embedder-post-id="POST_UUID">
 *     <a href="https://mixi.social/posts/POST_UUID">View on mixi2</a>
 *   </blockquote>
 *   <script async src="https://YOUR_DEPLOYMENT/embed.js" charset="utf-8"></script>
 */
(() => {
  const script = document.currentScript;
  if (!script) return;
  const origin = new URL(script.src).origin;

  const iframes = new Map();

  const load = (el) => {
    if (el.getAttribute('data-mixi2-embedder-loaded')) return;
    const id = el.getAttribute('data-mixi2-embedder-post-id');
    if (!id) return;
    el.setAttribute('data-mixi2-embedder-loaded', '1');

    const iframe = document.createElement('iframe');
    iframe.src = `${origin}/snippets/${encodeURIComponent(id)}`;
    iframe.loading = 'lazy';
    iframe.setAttribute('title', 'mixi2 post');
    iframe.setAttribute(
      'sandbox',
      'allow-popups allow-popups-to-escape-sandbox allow-scripts'
    );
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.cssText =
      'border:0;border-radius:24px;clip-path:inset(0 round 24px);width:100%;max-width:550px;height:0;display:block;overflow:hidden;background:transparent;color-scheme:normal;';
    iframes.set(iframe, true);
    el.replaceWith(iframe);
  };

  const scan = () => {
    document
      .querySelectorAll(
        '[data-mixi2-embedder-post-id]:not([data-mixi2-embedder-loaded])'
      )
      .forEach(load);
  };

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.type !== 'mixi2-embedder-snippet-height') return;
    iframes.forEach((_, iframe) => {
      if (iframe.contentWindow === event.source) {
        iframe.style.height = `${data.height}px`;
      }
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
