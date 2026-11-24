// Secret bindings, uploaded from Infisical by the deploy task (see secrets.env).
interface CloudflareEnv {
  YOUTUBE_CLIENT_ID: string;
  YOUTUBE_CLIENT_SECRET: string;
  YOUTUBE_REFRESH_TOKEN: string;
  // The analytics lake's read-only Basin SQL token, for the MCP tools.
  BASIN_SQL_TOKEN: string;
  // Google Web OAuth client for MCP owner sign-in, and the owner's Google subject.
  MCP_GOOGLE_CLIENT_ID: string;
  MCP_GOOGLE_CLIENT_SECRET: string;
  MCP_OWNER_GOOGLE_SUB: string;
}
