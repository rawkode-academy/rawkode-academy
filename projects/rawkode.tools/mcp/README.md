# Rawkode Tools MCP

`https://mcp.rawkode.tools/mcp` is a remote MCP server (Streamable HTTP) for Claude, ChatGPT or any MCP client. It is the Worker `rawkode-tools-mcp`.

## Tools

Tools come in modules (`src/tools/`), one OAuth scope each. A client gets a module's tools only when its grant includes that scope.

| Module | Scope | Tools | Reaches |
| --- | --- | --- | --- |
| Analytics | `analytics:read` | `describe_analytics`, `query_analytics` (one `SELECT`/`WITH`, at most 500 rows), `youtube_daily`, `youtube_traffic` | Basin SQL over the analytics lake, with the read-only `BASIN_SQL_TOKEN` |
| Guest | `guest:read` | `my_episodes`, `my_episode_daily` | The Academy GraphQL API (`api.rawkode.academy`) for who is on what, and Basin SQL for the numbers. No SQL tool |

The analytics tools never call YouTube: `youtube-control`'s daily sync already lands YouTube Analytics in the lake. A module that needs another Worker (such as publishing through `youtube-control`) takes a service binding to that Worker's RPC entrypoint; analytics needs none.

Consent grants the module scopes a client asks for, or every read-only module when it names none. Modules that change anything must be asked for by name.

Each module is for one role. Operators get operator modules and guests get the guest module, whatever scope a client asks for: the scope is fixed at sign-in from the role, and the tools are filtered by role again on every request.

### Guests

The `guest` role (assigned like `operator`, in the identity admin) is for a guest or host who should see their own numbers and nothing else. A guest sees the YouTube numbers of the episodes they are on, never the channel or anyone else's:

- **Guest of a video**: `getAllVideos { guests { id githubHandle } }` lists their GitHub username (or person id) among the video's guests.
- **Host of a show**: every episode of any show whose `hosts` include them, even ones they weren't on.

Nothing is listed by hand. The person is their verified GitHub username (identity refreshes it from GitHub at each sign-in), matched with the Academy's own handle rule. Each Academy video is tied to a YouTube video by the YouTube ID stored on it, or else by a title that is equal (ignoring case and punctuation) and unique among both the Academy's videos and the lake's `youtube.video` catalogue. A video that can't be tied to exactly one YouTube video is listed with `youtubeVideoId: null` and has no numbers, rather than guessed. The lists are cached for five minutes. Guest tools take no SQL: queries are built from the resolved video IDs, so a guest can't name another video.

A guest account needs a verified GitHub username; without one sign-in is refused. A role change (guest to operator or back) needs a new connection.

`rawkode-tools-mcp-preview` (manual, on `main`) prints what a username would see from the live Academy API and lake: `cuenv ci --pipeline preview`, which runs `scripts/preview-guest.ts icepuma`.

## Sign-in

Clients connect with OAuth 2.1 (dynamic client registration, PKCE S256). The consent page shows the client and its return address, then sends you to Rawkode Academy sign-in at `id.rawkode.academy`, where this Worker is the public PKCE client `rawkode-tools-mcp`. Access needs one of that client's roles, `operator` or `guest`, read from the identity service's userinfo. Identity admins get it from migration `0024`; assign it to anyone else in the identity admin (`id.rawkode.academy/admin`, access assignments).

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
