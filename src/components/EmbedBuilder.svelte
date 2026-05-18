<script lang="ts">
  import { onMount } from 'svelte';
  import {
    parsePostId,
    extractHandleFromInput,
    buildShareUrl,
  } from '~/lib/parse';

  type Format = 'html' | 'mdx';
  type CopiedKey = 'snippet' | 'script' | 'share' | null;

  let origin = $state('');
  let input = $state('');
  let iframeHeight = $state(0);
  let format = $state<Format>('html');
  let copied = $state<CopiedKey>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  const postId = $derived(parsePostId(input));
  const handle = $derived(extractHandleFromInput(input));

  const blockquoteHtml = $derived(
    postId
      ? `<blockquote class="mixi2-embedder-embed" data-mixi2-embedder-post-id="${postId}"><a href="https://mixi.social/posts/${postId}">View on mixi2</a></blockquote>\n<script async src="${origin}/embed.js" charset="utf-8"><\/script>`
      : ''
  );

  const mdxHtml = $derived(
    postId
      ? `<div set:html={\`<blockquote class="mixi2-embedder-embed" data-mixi2-embedder-post-id="${postId}"><a href="https://mixi.social/posts/${postId}">View on mixi2</a></blockquote><script async src="${origin}/embed.js" charset="utf-8"><\/script>\`} />`
      : ''
  );

  const embedCode = $derived(format === 'html' ? blockquoteHtml : mdxHtml);

  const iframeSrc = $derived(
    postId && origin ? `${origin}/snippets/${postId}` : ''
  );
  const scriptUrl = $derived(origin ? `${origin}/embed.js` : '');
  const shareUrl = $derived(
    postId && origin ? buildShareUrl(origin, postId, handle) : ''
  );

  onMount(() => {
    origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; height?: number } | null;
      if (
        data?.type === 'mixi2-embedder-snippet-height' &&
        typeof data.height === 'number'
      ) {
        iframeHeight = data.height;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  $effect(() => {
    void iframeSrc;
    iframeHeight = 0;
  });

  async function copy(text: string, which: CopiedKey) {
    try {
      await navigator.clipboard.writeText(text);
      copied = which;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = null), 1600);
    } catch {
      copied = null;
    }
  }

  function clearInput() {
    input = '';
  }
</script>

<section class="builder">
  <label class="field">
    <span class="label">mixi2 のポスト URL</span>
    <div class="input-row">
      <input
        type="url"
        inputmode="url"
        placeholder="https://mixi.social/@username/posts/..."
        bind:value={input}
        spellcheck="false"
        autocomplete="off"
      />
      {#if input}
        <button
          class="clear"
          type="button"
          onclick={clearInput}
          aria-label="クリア"
        >
          ×
        </button>
      {/if}
    </div>
    {#if input && !postId}
      <p class="error">
        URL からポスト ID を取り出せませんでした。URL を確認してください。
      </p>
    {/if}
  </label>

  {#if postId}
    <div class="grid">
      <div class="panel">
        <div class="panel-head">
          <h2>プレビュー</h2>
        </div>
        <div
          class="preview"
          style="--ph: {iframeHeight ? iframeHeight + 'px' : '320px'}"
        >
          {#if iframeSrc}
            <iframe
              src={iframeSrc}
              title="mixi2 post preview"
              loading="lazy"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts"
              allowtransparency={true}
              scrolling="no"
              style="height: {iframeHeight || 320}px"
            ></iframe>
          {/if}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>埋め込みコード</h2>
          <div class="head-actions">
            <div class="toggle" role="tablist" aria-label="出力形式">
              <button
                type="button"
                role="tab"
                aria-selected={format === 'html'}
                class="toggle-btn"
                class:active={format === 'html'}
                onclick={() => (format = 'html')}
              >
                HTML
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={format === 'mdx'}
                class="toggle-btn"
                class:active={format === 'mdx'}
                onclick={() => (format = 'mdx')}
              >
                MDX (set:html)
              </button>
            </div>
            <button
              class="copy"
              type="button"
              onclick={() => copy(embedCode, 'snippet')}
            >
              {copied === 'snippet' ? 'コピーしました' : 'コピー'}
            </button>
          </div>
        </div>
        <pre class="snippet"><code>{embedCode}</code></pre>

        <div class="panel-head sub">
          <h3>シェア用 URL (Discord / X / Slack 等)</h3>
          <button
            class="copy"
            type="button"
            onclick={() => copy(shareUrl, 'share')}
          >
            {copied === 'share' ? 'コピーしました' : 'コピー'}
          </button>
        </div>
        <code class="oneline">{shareUrl}</code>

        <div class="panel-head sub">
          <h3>埋め込みスクリプト URL</h3>
          <button
            class="copy"
            type="button"
            onclick={() => copy(scriptUrl, 'script')}
          >
            {copied === 'script' ? 'コピーしました' : 'コピー'}
          </button>
        </div>
        <code class="oneline">{scriptUrl}</code>

        <p class="hint">
          埋め込みコードをブログや HTML に貼り付けるとプレビューと同じカードが表示され、シェア用
          URL を Discord 等に貼ると OGP プレビューが展開されます。
        </p>
      </div>
    </div>
  {/if}
</section>

<style>
  .builder {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .label {
    font-size: 14px;
    font-weight: 600;
    color: var(--fg);
  }
  .input-row {
    position: relative;
    display: flex;
  }
  input[type='url'] {
    flex: 1;
    padding: 12px 40px 12px 14px;
    font-size: 15px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
    outline: none;
    transition: border-color 0.15s;
  }
  input[type='url']:focus {
    border-color: var(--accent);
  }
  .clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--fg-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .clear:hover {
    background: var(--border);
  }
  .error {
    margin: 0;
    color: #d63a3a;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .panel-head.sub {
    margin-top: 6px;
  }
  .panel-head h2,
  .panel-head h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--fg);
  }
  .panel-head h3 {
    font-size: 13px;
    color: var(--fg-muted);
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .toggle {
    display: inline-flex;
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px;
  }
  .toggle-btn {
    border: 0;
    background: transparent;
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
  }
  .toggle-btn.active {
    background: var(--surface);
    color: var(--fg);
    box-shadow: 0 0 0 1px var(--border);
  }
  .toggle-btn:hover:not(.active) {
    color: var(--fg);
  }
  .copy {
    border: 1px solid var(--border);
    background: var(--surface-alt);
    color: var(--fg);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .copy:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .preview {
    min-height: var(--ph);
    display: block;
    border-radius: 12px;
    background: var(--surface-alt);
    padding: 0;
  }
  .preview iframe {
    width: 100%;
    max-width: 550px;
    border: 0;
    display: block;
    margin: 0 auto;
    background: transparent;
    color-scheme: normal;
  }
  .snippet {
    margin: 0;
    background: var(--code-bg);
    color: var(--code-fg);
    border-radius: 12px;
    padding: 12px;
    font-size: 12.5px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .oneline {
    display: block;
    background: var(--code-bg);
    color: var(--code-fg);
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 12.5px;
    word-break: break-all;
  }
  .hint {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: var(--fg-muted);
  }
</style>
