import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
    maxDuration: 10,
  }),
  integrations: [svelte()],
  server: { port: 4321 },
  vite: {
    ssr: {
      noExternal: [],
      external: ['@grpc/grpc-js', '@grpc/proto-loader'],
    },
  },
});
