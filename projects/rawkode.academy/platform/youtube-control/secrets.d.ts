// Secret bindings are provisioned with `wrangler secret put`, never as vars.
interface CloudflareEnv {
  YOUTUBE_CREDENTIALS_JSON: string;
  API_TOKEN: string;
}
