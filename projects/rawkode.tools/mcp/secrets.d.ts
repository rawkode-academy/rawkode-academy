// Secret bindings, uploaded from Infisical by the deploy task (see secrets.env).
interface CloudflareEnv {
  // The analytics lake's read-only Basin SQL token (analytics tools).
  BASIN_SQL_TOKEN: string;
  // Google Web OAuth client for owner sign-in, and the owner's Google subject.
  MCP_GOOGLE_CLIENT_ID: string;
  MCP_GOOGLE_CLIENT_SECRET: string;
  MCP_OWNER_GOOGLE_SUB: string;
}
