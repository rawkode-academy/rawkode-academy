// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';


const site = (): string => {
  if (import.meta.env.CF_PAGES_URL) {
    return import.meta.env.CF_PAGES_URL;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:4321";
  }

  return "https://rawkode.studio";
};

// https://astro.build/config
export default defineConfig({
    devToolbar: {
        enabled: false,
    },

    output: "server",

    adapter: cloudflare({
        imageService: "cloudflare",
    }),

    site: site(),

    security: {
        checkOrigin: true,
    },
});
