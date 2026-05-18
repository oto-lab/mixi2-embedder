/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly MIXI2_CLIENT_ID: string;
  readonly MIXI2_CLIENT_SECRET: string;
  readonly MIXI2_TOKEN_URL?: string;
  readonly MIXI2_API_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
