export interface ServiceBinding {
	fetch: (request: Request) => Promise<Response>;
}

// RPC request/response types
export interface RPCRequest {
	service: string;
	resource?: string;
	params?: unknown;
}

export interface RPCResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
}

// Service registry type
export type ServiceRegistry = {
	[key: string]: {
		binding: keyof Env;
		supportedMethods: string[];
		resources?: string[];
	};
};
