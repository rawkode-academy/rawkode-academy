import type { McpServer } from "@modelcontextprotocol/server";
import { errorBody } from "../errors.ts";
import type { Caller, CallerRole } from "../identity.ts";

// A group of MCP tools behind one OAuth scope. A client gets a module's tools
// only when its grant includes the module's scope. Modules that call another
// Worker take a service binding to its RPC entrypoint; modules that call a
// public API (Basin SQL) need none.
export type ToolModule = {
  scope: string;
  // Who the module is for: operators get operator modules, guests get guest modules, never both.
  audience: CallerRole;
  // Read-only modules are granted when a client asks for no specific scope;
  // anything that changes state must be asked for by name.
  readOnly: boolean;
  // Shown on the consent page: "This connection can …".
  description: string;
  // Guidance for the model, added to the server instructions when the grant includes this module.
  instructions?: string;
  register(server: McpServer, env: CloudflareEnv, caller: Caller): void;
};

export const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export async function reply(work: () => Promise<unknown>) {
  try { return { content: [{ type: "text" as const, text: JSON.stringify(await work()) }], isError: false }; }
  catch (error) { return { content: [{ type: "text" as const, text: JSON.stringify(errorBody(error)) }], isError: true }; }
}
