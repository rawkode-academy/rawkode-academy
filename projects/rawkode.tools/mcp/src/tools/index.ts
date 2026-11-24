import { McpServer } from "@modelcontextprotocol/server";
import { analytics } from "./analytics.ts";
import type { ToolModule } from "./module.ts";

export const MODULES: readonly ToolModule[] = [analytics];
export const MODULE_SCOPES = MODULES.map(module => module.scope);

// The modules a grant's scopes unlock.
export function modulesFor(scopes: readonly string[]) {
  return MODULES.filter(module => scopes.includes(module.scope));
}

// What consent grants: the module scopes the client asked for, or every
// read-only module when it asked for none.
export function grantedScopes(requested: readonly string[]) {
  const asked = MODULE_SCOPES.filter(scope => requested.includes(scope));
  return asked.length > 0 ? asked : MODULES.filter(module => module.readOnly).map(module => module.scope);
}

export function createServer(env: CloudflareEnv, scopes: readonly string[]) {
  const server = new McpServer({ name: "rawkode-tools", version: "0.1.0" });
  for (const module of modulesFor(scopes)) module.register(server, env);
  return server;
}
