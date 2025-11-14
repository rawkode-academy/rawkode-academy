import {
	RpcSession,
	type RpcPromise,
	type RpcTransport,
} from "capnweb";
import type { AuthRpcService } from "../../../../platform/authentication/rpc/rpc-service.ts";

/**
 * Authentication Service Client using capnweb
 * Uses Cloudflare Service Binding for efficient RPC communication
 */

export interface AuthServiceBinding {
	fetch(request: Request): Promise<Response>;
}

const SERVICE_BINDING_RPC_ENDPOINT = "https://auth.internal/rpc";

type BatchSender = (batch: string[]) => Promise<string[]>;

class ServiceBindingBatchTransport implements RpcTransport {
	private readonly schedulePromise: Promise<void>;
	private aborted: unknown;
	private batchToSend: string[] | null = [];
	private batchToReceive: string[] | null = null;

	constructor(private readonly sendBatch: BatchSender) {
		this.schedulePromise = this.scheduleBatch();
	}

	async send(message: string) {
		if (this.batchToSend) {
			this.batchToSend.push(message);
		}
	}

	async receive() {
		if (!this.batchToReceive) {
			await this.schedulePromise;
		}
		const next = this.batchToReceive?.shift();
		if (next !== undefined) {
			return next;
		}
		throw new Error("Batch RPC request ended.");
	}

	abort(reason: unknown) {
		this.aborted = reason;
	}

	private async scheduleBatch() {
		await new Promise((resolve) => setTimeout(resolve, 0));
		if (this.aborted !== undefined) {
			throw this.aborted;
		}
		const batch = this.batchToSend ?? [];
		this.batchToSend = null;
		this.batchToReceive = await this.sendBatch(batch);
	}
}

function newServiceBindingRpcSession(
	service: AuthServiceBinding,
): RpcPromise<AuthRpcService> {
	const sendBatch: BatchSender = async (batch) => {
		const request = new Request(SERVICE_BINDING_RPC_ENDPOINT, {
			method: "POST",
			body: batch.join("\n"),
		});
		const response = await service.fetch(request);
		if (!response.ok) {
			response.body?.cancel();
			throw new Error(
				`RPC request failed: ${response.status} ${response.statusText}`,
			);
		}
		const payload = await response.text();
		return payload === "" ? [] : payload.split("\n");
	};

	const transport = new ServiceBindingBatchTransport(sendBatch);
	const rpc = new RpcSession(transport);
	// capnweb's RpcPromise type is structurally compatible but recursive; narrow via unknown first.
	return rpc.getRemoteMain() as unknown as RpcPromise<AuthRpcService>;
}

/**
 * Create an authentication client from a service binding
 */
export function createAuthClient(
	service: AuthServiceBinding,
): RpcPromise<AuthRpcService> {
	return newServiceBindingRpcSession(service);
}

/**
 * Helper class for backward compatibility
 * @deprecated Use createAuthClient() directly with the service binding
 */
export class AuthClient {
	private rpcSession: RpcPromise<AuthRpcService>;

	constructor(service: AuthServiceBinding) {
		this.rpcSession = newServiceBindingRpcSession(service);
	}

	/**
	 * Verify a session token and return user info
	 */
	async verifySession(sessionToken: string) {
		return await this.rpcSession.verifySession(sessionToken);
	}

	/**
	 * Get user by ID
	 */
	async getUser(userId: string) {
		return await this.rpcSession.getUser(userId);
	}

	/**
	 * Get user by email
	 */
	async getUserByEmail(email: string) {
		return await this.rpcSession.getUserByEmail(email);
	}

	/**
	 * List sessions for a user
	 */
	async listUserSessions(userId: string) {
		return await this.rpcSession.listUserSessions(userId);
	}

	/**
	 * Revoke a session
	 */
	async revokeSession(sessionId: string) {
		return await this.rpcSession.revokeSession(sessionId);
	}

	/**
	 * Validate passkey credential
	 */
	async validatePasskey(userId: string, credentialId: string) {
		return await this.rpcSession.validatePasskey(userId, credentialId);
	}
}
