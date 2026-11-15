// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  vite: {
    // Bun may bind Tailwind's Vite peer to Vite 8 while Astro uses Vite 7.
    // Tailwind supports both; the production-parity build verifies the plugin at runtime.
    // @ts-ignore Vite plugin types differ across major versions.
    plugins: [tailwindcss()],
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      // https://github.com/withastro/adapters/pull/436
      alias: {
        "react-dom/server": "react-dom/server.edge",
      },
    },
  },
  security: {
    // Disabled: better-auth handles origin checking via trustedOrigins config
    // OAuth token endpoints need to accept cross-origin POSTs
    checkOrigin: false,
  },
});
