// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/** @typedef {Parameters<typeof defineConfig>[0]} AstroUserConfig */
/** @typedef {NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>} AstroVitePlugins */

/**
 * @param {unknown} plugins
 * @returns {AstroVitePlugins}
 */
const asAstroVitePlugins = (plugins) =>
  /** @type {AstroVitePlugins} */ (plugins);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    // The workspace contains Astro 5/Vite 6 and Astro 6/Vite 7 projects.
    // @tailwindcss/vite resolves its peer types through the Vite 7 side, while
    // this identity project builds on Astro 5's Vite 6. Runtime plugin shape is
    // compatible; keep the cast at the config boundary.
    plugins: asAstroVitePlugins(tailwindcss()),
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
