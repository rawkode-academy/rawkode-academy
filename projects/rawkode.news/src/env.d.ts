/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { TypedEnv } from "./types/service-bindings";

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

type Runtime = import("@astrojs/cloudflare").Runtime<TypedEnv>;

declare global {
  namespace App {
    interface Locals extends Runtime {
      user?: User;
      runtime: {
        env: TypedEnv;
      };
    }
  }
}
