import type { Context } from "hono";
import type { RPCRequest, RPCResponse, ServiceRegistry } from "./bindings";
import { getTokenInfoFromContext } from "./middleware/token-context";

// Service registry mapping service names to their bindings and supported HTTP methods
const serviceRegistry: ServiceRegistry = {
	"casting-credits": {
		binding: "CASTING_CREDITS",
		supportedMethods: ["POST"],
	},
};

export async function handleRPC(
	c: Context<{ Bindings: Env }>,
): Promise<Response> {
	const rpcRequest = c.get("rpcRequest") as RPCRequest;
	const { service, resource, params } = rpcRequest;
	const httpMethod = c.req.method;

	// Check if service exists in registry
	const serviceConfig = serviceRegistry[service];
	if (!serviceConfig) {
		return c.json<RPCResponse>(
			{
				success: false,
				error: {
					code: "SERVICE_NOT_FOUND",
					message: `Service '${service}' not found`,
					details: {
						availableServices: Object.keys(serviceRegistry),
					},
				},
			},
			404,
		);
	}

	// Check if HTTP method is supported
	if (!serviceConfig.supportedMethods.includes(httpMethod)) {
		return c.json<RPCResponse>(
			{
				success: false,
				error: {
					code: "METHOD_NOT_ALLOWED",
					message: `HTTP method '${httpMethod}' not allowed for service '${service}'`,
					details: {
						allowedMethods: serviceConfig.supportedMethods,
					},
				},
			},
			405,
		);
	}

	// Get the service binding
	const serviceBinding = c.env[serviceConfig.binding];
	if (!serviceBinding) {
		return c.json<RPCResponse>(
			{
				success: false,
				error: {
					code: "SERVICE_UNAVAILABLE",
					message: `Service '${service}' is not available`,
				},
			},
			503,
		);
	}

	try {
		// Construct the path for the downstream service
		// If resource is provided, append it to the path
		const path = resource ? `/${resource}` : "/";
		const url = `http://internal${path}`;

		// Get token info if available
		const tokenInfo = getTokenInfoFromContext(c);

		// Build headers for downstream service
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		// Forward token claims as headers for downstream services
		if (tokenInfo) {
			// Forward user ID
			if (tokenInfo.sub) {
				headers["X-User-Id"] = tokenInfo.sub;
			}

			// Forward username
			if (tokenInfo.username) {
				headers["X-Username"] = tokenInfo.username;
			}

			// Forward organization ID
			const orgId = tokenInfo["urn:zitadel:iam:org:id"];
			if (orgId) {
				headers["X-Org-Id"] = orgId;
			}

			// Forward client ID (useful for service accounts/PATs)
			if (tokenInfo.client_id) {
				headers["X-Client-Id"] = tokenInfo.client_id;
			}
		}

		// Forward the request to the appropriate service
		const request = new Request(url, {
			method: httpMethod,
			headers,
			body: params ? JSON.stringify(params) : undefined,
		});

		const response = await serviceBinding.fetch(request);
		const data = await response.json();

		// If the downstream service returned an error status
		if (!response.ok) {
			return c.json<RPCResponse>(
				{
					success: false,
					error: {
						code: "SERVICE_ERROR",
						message: `Service '${service}' returned an error`,
						details: data,
					},
				},
				response.status,
			);
		}

		// Success response
		return c.json<RPCResponse>({
			success: true,
			data,
		});
	} catch (error) {
		console.error(`Error calling service ${service}:`, error);

		return c.json<RPCResponse>(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "An internal error occurred",
					details: error instanceof Error ? error.message : undefined,
				},
			},
			500,
		);
	}
}
