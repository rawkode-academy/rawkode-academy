// Secret bindings, uploaded from Infisical by the deploy task (see secrets.env).
interface CloudflareEnv {
  YOUTUBE_SYNC_CLIENT_ID: string;
  YOUTUBE_SYNC_CLIENT_SECRET: string;
  YOUTUBE_SYNC_REFRESH_TOKEN: string;
  // Bearer token for plan, apply and rollback. Held by CI only.
  SYNC_ADMIN_TOKEN: string;
}
