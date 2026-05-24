/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    BROWSER: import("@cloudflare/playwright").BrowserWorker;
  }
}

declare namespace App {
  interface Locals {
    cfContext: ExecutionContext;
    runtime: {
      cfContext: ExecutionContext;
    };
  }
}
