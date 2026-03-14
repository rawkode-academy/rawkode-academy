/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

type Runtime = import("@astrojs/cloudflare").Runtime;

declare global {
  interface Window {
    __rknSubmitPreviewBound?: boolean;
  }

  namespace App {
    interface Locals extends Runtime {
      user?: User;
    }
  }
}
