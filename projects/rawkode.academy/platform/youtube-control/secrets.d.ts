// Secret bindings are provisioned with `wrangler secret put`, never as vars.
interface CloudflareEnv {
  YOUTUBE_CREDENTIALS_JSON: string;
  READ_API_TOKEN: string;
  WRITE_API_TOKEN: string;
  K2_CONSUME_TOKEN: string;
  BASIN_SQL_TOKEN: string;
  MCP_GOOGLE_CLIENT_ID: string;
  MCP_GOOGLE_CLIENT_SECRET: string;
}
