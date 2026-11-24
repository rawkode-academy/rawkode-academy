import { ensure, readLimited, ServiceError } from "./errors.ts";
import { appearsInAcademy } from "./guest.ts";

// Sign-in goes to Rawkode Academy's identity service (id.rawkode.academy),
// where this Worker is the public PKCE client `rawkode-tools-mcp`. Access
// needs the client's `operator` role (every module), assigned in the identity
// admin, or no role at all: anyone whose verified GitHub username is a guest or
// show host in the Academy's data may use the guest module for their episodes.
export const IDENTITY_ORIGIN = "https://id.rawkode.academy";
export const IDENTITY_CLIENT_ID = "rawkode-tools-mcp";
export const OPERATOR_ROLE = "operator";
const ROLES_CLAIM = "https://rawkode.academy/roles";
const CLIENT_CLAIM = "https://rawkode.academy/client_id";

type Tokens = { access_token: string; refresh_token?: string };
export type CallerRole = "operator" | "guest";
// "guest" is anyone scoped to their own episodes: a guest or a show host. role is absent on grants made before it existed: those are operators.
export type Caller = { userId: string; role?: CallerRole; username?: string; upstreamRefreshToken?: string };
export const roleOf = (caller: Pick<Caller, "role">): CallerRole => caller.role ?? "operator";

export function authorizeUrl(redirectUri: string, state: string, codeChallenge: string) {
  const url = new URL("/auth/oauth2/authorize", IDENTITY_ORIGIN);
  url.search = new URLSearchParams({ client_id: IDENTITY_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid profile email offline_access", state, code_challenge: codeChallenge, code_challenge_method: "S256" }).toString();
  return url.toString();
}

async function token(parameters: Record<string, string>): Promise<Tokens> {
  const response = await fetch(`${IDENTITY_ORIGIN}/auth/oauth2/token`, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: IDENTITY_CLIENT_ID, ...parameters }),
  });
  ensure(response.ok, "identity_sign_in_failed", "Rawkode Academy sign-in could not be completed; start again", 502);
  let tokens: Partial<Tokens>;
  try { tokens = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 65536))); }
  catch { tokens = {}; }
  ensure(typeof tokens.access_token === "string" && tokens.access_token, "identity_sign_in_failed", "Rawkode Academy didn't return an access token", 502);
  return tokens as Tokens;
}

// Reads the user, their roles for this client and their verified GitHub
// username over TLS from the identity service itself, so no token signature
// needs checking here.
async function caller(tokens: Tokens, previousRefreshToken?: string): Promise<Caller> {
  const response = await fetch(`${IDENTITY_ORIGIN}/auth/oauth2/userinfo`, {
    redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  ensure(response.ok, "identity_sign_in_failed", "Rawkode Academy sign-in could not be completed; start again", 502);
  let info: Record<string, unknown>;
  try { info = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 65536))); }
  catch { info = {}; }
  const roles = Array.isArray(info[ROLES_CLAIM]) ? info[ROLES_CLAIM] as unknown[] : [];
  ensure(typeof info.sub === "string" && info.sub, "identity_sign_in_failed", "Rawkode Academy didn't identify the user", 502);
  const upstreamRefreshToken = tokens.refresh_token ?? previousRefreshToken;
  if (info[CLIENT_CLAIM] === IDENTITY_CLIENT_ID && roles.includes(OPERATOR_ROLE)) return { userId: info.sub, role: "operator", upstreamRefreshToken };
  // Anyone else is a possible guest, scoped by GitHub username, which identity
  // verifies with GitHub. Whether they appear in the Academy's data is checked
  // by the caller of this function.
  const username = info.preferred_username;
  if (typeof username === "string" && username.length <= 39 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(username)) return { userId: info.sub, role: "guest", username, upstreamRefreshToken };
  // Opaque ids and role names only, so a refusal can be traced without exposing PII.
  const seen = roles.filter((role): role is string => typeof role === "string").join(", ") || "none";
  throw new ServiceError("forbidden", `This Rawkode Academy account isn't a Rawkode Tools operator, and has no verified GitHub username to find its episodes with. Identity user: ${info.sub}. Client claim: ${typeof info[CLIENT_CLAIM] === "string" ? info[CLIENT_CLAIM] : "missing"}. Roles: ${seen}.`, 403);
}

// A non-operator is let in only while they appear in the Academy's data as a
// guest or show host. Identity's `username` is the verified GitHub login.
async function admitted(who: Caller) {
  if (roleOf(who) === "guest" && !await appearsInAcademy(who.username ?? "")) {
    throw new ServiceError("forbidden", `GitHub user ${who.username} isn't a Rawkode Tools operator, and no Rawkode Academy episode lists them as a guest or host. Identity user: ${who.userId}.`, 403);
  }
  return who;
}

export async function signInCaller(code: string, verifier: string, redirectUri: string) {
  return admitted(await caller(await token({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri })));
}

// Run on every MCP token refresh: the role is checked again, so removing it
// in the identity admin cuts access off within an access token's lifetime. A
// changed role (guest to operator or back) needs a new connection, because the
// grant's scope was fixed by the role it was made with.
export async function recheckCaller(props: Caller) {
  ensure(props.upstreamRefreshToken, "forbidden", "Reconnect to Rawkode Tools", 403);
  const next = await admitted(await caller(await token({ grant_type: "refresh_token", refresh_token: props.upstreamRefreshToken }), props.upstreamRefreshToken));
  ensure(roleOf(next) === roleOf(props), "forbidden", "Your Rawkode Tools role changed; reconnect", 403);
  return next;
}
