/// <reference types="astro/client" />

type KVNamespace = import('@cloudflare/workers-types/experimental').KVNamespace;
type ENV = {
  SERVER_URL: string;
  KV_BINDING: KVNamespace;
};

type Runtime = import('@astrojs/cloudflare').DirectoryRuntime<ENV>;

declare namespace App {
  interface Locals extends Runtime {
    user: {
      name: string;
      surname: string;
    };
  }
}
