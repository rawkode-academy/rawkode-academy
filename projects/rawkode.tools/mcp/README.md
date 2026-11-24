# Rawkode Tools MCP

`https://mcp.rawkode.tools/mcp` is a remote MCP server (Streamable HTTP) for Claude, ChatGPT or any MCP client. It is the Worker `rawkode-tools-mcp`.

## Tools

Tools come in modules (`src/tools/`), one OAuth scope each. A client gets a module's tools only when its grant includes that scope.

| Module | Scope | Tools | Reaches |
| --- | --- | --- | --- |
| Analytics | `analytics:read` | `describe_analytics`, `query_analytics` (one `SELECT`/`WITH`, at most 500 rows), `youtube_daily`, `youtube_traffic` | Basin SQL over the analytics lake, with the read-only `BASIN_SQL_TOKEN` |

The analytics tools never call YouTube: `youtube-control`'s daily sync already lands YouTube Analytics in the lake. A module that needs another Worker (such as publishing through `youtube-control`) takes a service binding to that Worker's RPC entrypoint; analytics needs none.

Consent grants the module scopes a client asks for, or every read-only module when it names none. Modules that change anything must be asked for by name.

## Sign-in

Clients connect with OAuth 2.1: dynamic client registration and PKCE S256. Only the owner can approve. The consent page sends them to Google sign-in (`openid` only), and the Worker accepts the ID token only if its subject is `MCP_OWNER_GOOGLE_SUB`. Grants and tokens live in the `OAUTH_KV` namespace, which Wrangler creates on the first deploy. Access tokens last an hour and refresh tokens 30 days. Changing or removing the owner ID revokes every client on its next request or refresh.

## Setting it up

1. In the Google Cloud project that holds youtube-control's OAuth client, create a **Web application** OAuth client with the redirect URI `https://mcp.rawkode.tools/oauth/callback`. Store its client ID and secret in 1Password at `op://Employee/565nub77bcoxqd5a77kbdets3q/mcp/client-id` and `.../mcp/client-secret`.
2. Run `cuenv task owner` in this directory. It signs in with Google through youtube-control's Desktop client (pick the account you'll approve connections with), writes that account's ID and the Web client to Infisical `/projects/basin` as `MCP_OWNER_GOOGLE_SUB`, `MCP_GOOGLE_CLIENT_ID` and `MCP_GOOGLE_CLIENT_SECRET`, and starts the deploy.
3. Add `https://mcp.rawkode.tools/mcp` as a custom connector in Claude or ChatGPT, and sign in when asked.

## Deploy

CI on `main` (`rawkode-tools-mcp-default`) runs the tests and `wrangler deploy --secrets-file secrets.env`, reading the four secrets from Infisical `/projects/basin` as the `github-actions` identity. The deploy fails until step 2 has run. The custom domain needs the Workers deploy token to cover the `rawkode.tools` zone.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests plus a Miniflare test of the whole OAuth flow and every tool, with Google sign-in and Basin SQL mocked. The project is excluded from the root Bun workspaces and has its own npm lockfile.
