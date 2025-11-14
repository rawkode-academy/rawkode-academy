import { newWorkersRpcResponse } from "capnweb";
import { createAuth, type Env } from "./auth-config";
import { AuthRpcService } from "./rpc-service";

// Export the RPC service for service bindings
export { AuthRpcService };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		// RPC endpoint for service-to-service communication using capnweb
		if (url.pathname === "/rpc") {
			return newWorkersRpcResponse(request, new AuthRpcService(env));
		}
		
		// Regular Better Auth routes
		const auth = createAuth(env);
		
		// Better Auth handles all authentication routes:
		// - GET/POST /sign-in/github - GitHub OAuth
		// - GET /sign-in/github/callback - GitHub callback
		// - POST /sign-out - Sign out
		// - GET /session - Get current session
		// - POST /passkey/register - Register passkey
		// - POST /passkey/authenticate - Authenticate with passkey
		// - GET /passkey/list - List user's passkeys
		// - DELETE /passkey/:id - Delete a passkey
		
		return auth.handler(request);
	},
};

