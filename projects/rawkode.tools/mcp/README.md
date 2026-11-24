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

Clients connect with OAuth 2.1 (dynamic client registration, PKCE S256). The consent page shows the client and its return address, then sends you to Rawkode Academy sign-in at `id.rawkode.academy`, where this Worker is the public PKCE client `rawkode-tools-mcp`. Access needs that client's `operator` role, read from the identity service's userinfo. Identity admins get it from migration `0024`; assign it to anyone else in the identity admin (`id.rawkode.academy/admin`, access assignments).

Every MCP token refresh refreshes the identity session and checks the role again, so removing the role cuts a client off within an hour (the access token's lifetime). Grants and tokens live in the `OAUTH_KV` namespace, which Wrangler creates on the first deploy; refresh tokens last 30 days. There is no OAuth client secret: the identity client is public and PKCE-bound.

## Deploy

CI on `main` (`rawkode-tools-mcp-default`) runs the tests and `wrangler deploy --secrets-file secrets.env`, reading `BASIN_SQL_TOKEN` from Infisical `/projects/basin` as the `github-actions` identity. The custom domain needs the Workers deploy token to cover the `rawkode.tools` zone.

Connect with `https://mcp.rawkode.tools/mcp` as a custom connector in Claude or ChatGPT.

## Verify locally

```sh
cuenv task check
cuenv task test
```

`test` builds the Worker and runs unit tests plus a Miniflare test of the whole OAuth flow and every tool, with the identity service and Basin SQL mocked. The project is excluded from the root Bun workspaces and has its own npm lockfile.
