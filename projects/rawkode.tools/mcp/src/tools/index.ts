import { McpServer } from "@modelcontextprotocol/server";
import { roleOf, type Caller, type CallerRole } from "../identity.ts";
import { analytics } from "./analytics.ts";
import { guest } from "./guest.ts";
import { handles } from "./handles.ts";
import type { ToolModule } from "./module.ts";
import { video } from "./video.ts";

export const MODULES: readonly ToolModule[] = [analytics, guest, video, handles];
export const MODULE_SCOPES = MODULES.map(module => module.scope);

// The modules a grant's scopes unlock for a role. A scope never reaches a
// module meant for the other role.
export function modulesFor(scopes: readonly string[], role: CallerRole = "operator") {
  return MODULES.filter(module => module.audience === role && scopes.includes(module.scope));
}

// What consent grants: the module scopes the client asked for, or every
// read-only module of the caller's role when it asked for none.
export function grantedScopes(requested: readonly string[], role: CallerRole = "operator") {
  const mine = MODULES.filter(module => module.audience === role);
  const asked = mine.filter(module => requested.includes(module.scope));
  return (asked.length > 0 ? asked : mine.filter(module => module.readOnly)).map(module => module.scope);
}

export function createServer(env: CloudflareEnv, scopes: readonly string[], caller: Caller) {
  const server = new McpServer({ name: "rawkode-tools", version: "0.1.0" });
  for (const module of modulesFor(scopes, roleOf(caller))) module.register(server, env, caller);
  return server;
}
