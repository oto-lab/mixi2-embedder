# mixi2-embedder

mixi2 のポストをブログや任意の Web ページに埋め込めるスニペットを生成・配信するサービス。

[mixi2-js](https://github.com/otnc/mixi2-js) (非公式 SDK) で [mixi2 Developer Platform](https://developer.mixi.social/) の API からポストを取得し、サンドボックス iframe としてレンダリングします。

> [!Note]
>   
> このプロジェクトは MIXI 社が公式に運営するものではありません。コミュニティのオープンソースプロジェクトです。

---

## できること

- mixi2 のポスト URL を貼り付けるだけで埋め込み HTML を生成
- 生成された `<blockquote>` + `<script>` を任意の Web ページに貼るだけで動作
- **リプライ・引用ポストも自動で展開**（X / Twitter の web embed と同様に「返信先: @user」ヘッダーや引用カードを表示）
- 投稿テキスト中の URL は **OGP プレビュー** カードとして展開（最大 4 件）
- メディア（画像 / 動画）は最大 4 枚レイアウトで表示
- iframe は中身に合わせて自動でサイズ調整（`postMessage` で高さを通知）
- ダーク／ライトモード自動対応
- Discord / X / Slack / Telegram などに **シェア用 URL** を貼ると **OGP プレビュー**が展開される（カード形式）
- フォーク → Vercel デプロイで **独自ドメインで運用可能**（ドメインのハードコードなし）
- 取得済みポストはメモリ + CDN で多段キャッシュ

---

## エンドポイント

| パス | 役割 |
| --- | --- |
| `/` | URL 貼り付け → プレビュー → コピー UI |
| `/embed.js` | 埋め込み先ページに貼るローダースクリプト |
| `/api/debug/{post-id}` | デバッグ用 JSON（リプライ/引用判定の確認用、**dev のみ** / 本番は 404） |

ポスト本体は以下のすべての形式で同じ SSR ハンドラ ([SnippetPage.astro](src/components/SnippetPage.astro)) に繋がります。`@` の有無、ユーザー部分の有無、`/snippets/` プレフィックスの有無いずれにも対応。Discord などにペーストするとサイト側で生成された OGP メタを読んでリッチプレビューを表示します。

| パス | 用途 |
| --- | --- |
| `/snippets/{id}` | iframe canonical (`embed.js` から呼ばれる) |
| `/snippets/posts/{id}` | `/snippets/` 配下 / ユーザー名省略形 |
| `/snippets/@{user}/posts/{id}` | `/snippets/` 配下 / `@` あり |
| `/snippets/{user}/posts/{id}` | `/snippets/` 配下 / `@` なし |
| `/posts/{id}` | 短縮シェア URL / ユーザー名省略形 |
| `/@{user}/posts/{id}` | 短縮シェア URL / `@` あり（推奨） |
| `/{user}/posts/{id}` | 短縮シェア URL / `@` なし |

---

## 埋め込み方

ルートページ `/` の UI から **HTML** か **MDX (set:html)** のどちらかをトグルで選んで生成・コピーします。

### HTML 形式（通常の HTML / Markdown 等）

```html
<blockquote
  class="mixi2-embedder-embed"
  data-mixi2-embedder-post-id="POST_UUID"
>
  <a href="https://mixi.social/posts/POST_UUID">View on mixi2</a>
</blockquote>
<script
  async
  src="https://YOUR_DEPLOYMENT/embed.js"
  charset="utf-8"
></script>
```

> [!Note]
>   
> MDX 形式（Astro / Next.js MDX 等で `<script>` がパースエラーになる環境）
> 
> ```mdx
> <div
>  set:html={`<blockquote class="mixi2-embedder-embed" data-mixi2-embedder-post-id="POST_UUID"><a href="https://mixi.social/posts/POST_UUID">View on mixi2</a></blockquote><script async src="https://YOUR_DEPLOYMENT/embed.js" charset="utf-8"></script>`}
> />
> ```

- **`<blockquote>`**: `data-mixi2-embedder-post-id` 属性付きのプレースホルダー。JS が無効な環境ではポストへのリンクとして機能します。
- **`<script>`**: ページ内の対応する blockquote を検出し、自動で iframe (このサイトの `/snippets/[id]`) に置き換えます。`src` のオリジンを iframe URL のベースに使うため、複数ドメインを切り替えても自動追従します。

### Discord / X / Slack などにそのままシェア

ルートページの「シェア用 URL」をコピーしてチャットに貼り付けると、リッチプレビューカードが展開されます。形式は以下のいずれか:

```
https://YOUR_DEPLOYMENT/@{username}/posts/{post-id}
https://YOUR_DEPLOYMENT/posts/{post-id}
```

`@` の有無、ユーザー部分の有無いずれにも対応。

---

## デプロイ (Vercel)

このリポジトリは Vercel の auto-detect でそのままデプロイできます。

1. GitHub にフォーク
2. [Vercel](https://vercel.com/new) で "Import Project"
3. **Environment Variables** に以下を登録
   - `MIXI2_CLIENT_ID`
   - `MIXI2_CLIENT_SECRET`
4. Deploy
5. （任意）ダッシュボードから独自ドメインを追加

ドメインはどこにもハードコードしていません。Vercel が割り当てた `*.vercel.app` でも、独自ドメインを後付けしても、`embed.js` がリクエスト元のオリジンを動的解決して iframe URL を組み立てます。

### vercel.json

`/embed.js` などに対する **CDN キャッシュ**と **CORS / CORP** ヘッダを [vercel.json](vercel.json) で明示しています。Vercel はこれを自動で読み込みます。

### ランタイムの注意

- mixi2-js は内部で gRPC (`@grpc/grpc-js`) を使うため **Node ランタイム必須**（Edge では動きません）
- `@astrojs/vercel` がデフォルトで Node Serverless Functions として出力するので追加設定は不要
- `engines.node: >=22.12.0` を指定済みなので、Vercel は自動で Node 22 ランタイムを選択

---

## ローカル開発

### 必要なもの

- Node.js **`>=22.12.0`**（Astro 6 / mixi2-js v1.5 の要件）
- pnpm **`>=11`**
- mixi2 Developer Platform の OAuth2 アプリ（`client_id` と `client_secret`）

### セットアップ

```sh
pnpm install
cp .env.example .env
# .env に MIXI2_CLIENT_ID / MIXI2_CLIENT_SECRET を記入

pnpm dev          # http://localhost:4321
pnpm check        # 型チェック (astro check)
pnpm build        # 本番ビルド（.vercel/output/ に出力）
pnpm preview      # 本番ビルドをローカルで確認
```

### 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `MIXI2_CLIENT_ID` | ✅ | Mixi Developer Platform で発行したクライアント ID |
| `MIXI2_CLIENT_SECRET` | ✅ | 同じくクライアントシークレット |
| `MIXI2_TOKEN_URL` | – | デフォルトは `mixi2-js/helpers` の `tokenUrl`。差し替える場合のみ |
| `MIXI2_API_ADDRESS` | – | デフォルトは `mixi2-js/helpers` の `apiAddress`。同上 |

---

## 構成

```
public/
  embed.js                       # ブログに貼られるローダー（静的配信）
  favicon.svg
src/
  assets/
    mixi2_Symbol_FullColor.png   # mixi2 公式ロゴ（Astro asset import 経由でフィンガープリント化）
  lib/
    mixi2.ts                     # OAuth2Authenticator + Client シングルトン + メモリキャッシュ
    mixi2-web.ts                 # mixi.social Web の HTML を scrape して quotePostId を取得
    ogp.ts                       # 外部 URL の OGP/Twitter Card フェッチャ（SSRF 対策付き）
    parse.ts                     # mixi2 ポスト URL から UUID / handle を抽出
    text.ts                      # URL/メンション/ハッシュタグの簡易セグメンタ
  components/
    Snippet.astro                # ポストカード本体
    SnippetPage.astro            # /snippets, /posts, /@user/posts, /user/posts で共有される完全ページ
    PostText.astro
    PostMedia.astro              # 1〜4 枚レイアウト
    QuotedPost.astro             # 引用ポストの compact ネストカード
    OgpCard.astro                # 外部 URL の OGP カード
    SnippetFallback.astro        # 404/削除/エラー用フォールバック
    EmbedBuilder.svelte          # ルートページのインタラクティブ UI（Svelte island）
  pages/
    index.astro                          # ルートページ
    snippets/[id].astro                  # iframe canonical
    snippets/posts/[id].astro            # iframe canonical / ユーザー省略形
    snippets/@[user]/posts/[id].astro    # iframe canonical / @ あり
    snippets/[user]/posts/[id].astro     # iframe canonical / @ なし
    posts/[id].astro                     # 短縮シェア URL / ユーザー指定なし
    @[user]/posts/[id].astro             # 短縮シェア URL / @ あり
    [user]/posts/[id].astro              # 短縮シェア URL / @ なし
    api/debug/[id].ts                    # 開発用デバッグ JSON
```

### スタック

- [Astro 6](https://astro.build) (SSR モード)
- [Svelte 5](https://svelte.dev) (islands)
- [mixi2-js](https://www.npmjs.com/package/mixi2-js)
- [@astrojs/vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/) (Node Serverless)

### キャッシュ戦略

1. **メモリキャッシュ**: ポスト 5 分、ユーザー 5 分、OGP 1 時間、引用 ID scrape 1 時間
2. **CDN キャッシュ**: `/snippets/{id}` 系のレスポンスに `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` を付与し、Vercel Edge Network にもキャッシュ
3. **静的アセット**: `/embed.js` と `/_astro/*` は immutable / 長期キャッシュ

API 呼び出しは「最初の 1 ポスト × 5 分」に抑えられ、以後は CDN/メモリでヒットします。

### リプライ / 引用の検出方法

| 種類 | 検出方法 |
| --- | --- |
| リプライ | `Post.inReplyToPostId` を使用（公開 API がそのまま返す） |
| 引用 | **公開 Application API は返さない**ため、mixi.social の HTML を 1 回 scrape して `quotePostId` を抽出（[src/lib/mixi2-web.ts](src/lib/mixi2-web.ts)）。テキストに `https://mixi.social/posts/...` が含まれる場合はそちらも引用扱い。 |

mixi2 公式 API の `Post` proto に `quoted_post_id` が追加された暁には `mixi2-web.ts` は不要になり、`fetchPost` から直接読めるようになります。

---

## カスタマイズ

- **カードの見た目**: [src/components/Snippet.astro](src/components/Snippet.astro) の `<style>` ブロックで CSS 変数（`--color-fg` 等）を編集
- **ルートページの見た目**: [src/pages/index.astro](src/pages/index.astro) の `:root` ブロック
- **キャッシュ TTL**: [src/lib/mixi2.ts](src/lib/mixi2.ts) の `POST_CACHE_TTL_MS`、および [src/components/SnippetPage.astro](src/components/SnippetPage.astro) の `s-maxage`

---

## ライセンス / ガイドライン

- [Apache-2.0](LICENSE)
- [mixi2のロゴ使用に関するガイドライン](https://support.mixi.social/support/solutions/articles/154000216322-mixi2%E3%81%AE%E3%83%AD%E3%82%B4%E4%BD%BF%E7%94%A8%E3%81%AB%E9%96%A2%E3%81%99%E3%82%8B%E3%82%AC%E3%82%A4%E3%83%89%E3%83%A9%E3%82%A4%E3%83%B3) ([src/assets/mixi2_Symbol_FullColor.png](src/assets/mixi2_Symbol_FullColor.png))
- リポジトリ: [github.com/oto-lab/mixi2-embedder](https://github.com/oto-lab/mixi2-embedder)
