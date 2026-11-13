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
    // @tailwindcss/vite is typed against Vite 8, Astro 6 runs Vite 7; the
    // plugin works with both (same cast as the website's asAstroVitePlugins).
    plugins: /** @type {any} */ ([tailwindcss()]),
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
