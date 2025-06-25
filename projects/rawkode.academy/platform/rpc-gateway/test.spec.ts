import { describe, expect, it, vi } from "vitest";
import app from "./main";

// Mock fetch for token introspection
global.fetch = vi.fn();

// Helper to make requests with env
async function request(
	path: string,
	options?: RequestInit,
	env?: Partial<Env>,
	mockIntrospection = true,
): Promise<Response> {
	const mockEnv: Env = {
		CASTING_CREDITS: {
			fetch: async () => new Response("mock", { status: 200 }),
		},
		PLATFORM_RPC_TOKEN: "test-token",
		...env,
	};

	// Mock successful token introspection by default
	if (mockIntrospection && options?.headers?.["Authorization"]) {
		(global.fetch as any).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					active: true,
					sub: "test-user-id",
					username: "testuser",
					"urn:zitadel:iam:org:id": "test-org-id",
					client_id: "test-client-id",
				}),
				{ status: 200 },
			),
		);
	}

	const req = new Request(`http://localhost${path}`, options);
	return app.fetch(req, mockEnv);
}

describe("RPC Gateway", () => {
	describe("GET /health", () => {
		it("should return health status", async () => {
			const res = await request("/health");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("status", "healthy");
			expect(data).toHaveProperty("service", "rpc-gateway");
		});
	});

	describe("GET /services", () => {
		it("should return available services", async () => {
			const res = await request("/services");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("services");
			expect(data.services).toHaveProperty("casting-credits");
			expect(data.services["casting-credits"]).toHaveProperty("methods");
			expect(data.services["casting-credits"].methods).toContain("POST");
		});
	});

	describe("POST /rpc", () => {
		it("should return validation error for invalid request", async () => {
			const res = await request("/rpc", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer test-token",
				},
				body: JSON.stringify({ invalid: "request" }),
			});

			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return service not found for unknown service", async () => {
			const res = await request("/rpc", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer test-token",
				},
				body: JSON.stringify({
					service: "unknown-service",
				}),
			});

			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("SERVICE_NOT_FOUND");
		});

		it("should return method not allowed for unsupported HTTP method", async () => {
			const res = await request("/rpc", {
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "Bearer test-token",
				},
				body: JSON.stringify({
					service: "casting-credits",
				}),
			});

			expect(res.status).toBe(405);
			const data = await res.json();
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("METHOD_NOT_ALLOWED");
		});

		it("should return unauthorized when no token provided", async () => {
			const res = await request(
				"/rpc",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						service: "casting-credits",
						params: {},
					}),
				},
				{},
				false, // Don't mock introspection
			);

			expect(res.status).toBe(401);
			const data = await res.json();
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("UNAUTHORIZED");
		});

		it("should return unauthorized when token is inactive", async () => {
			// Mock inactive token response
			(global.fetch as any).mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						active: false,
					}),
					{ status: 200 },
				),
			);

			const res = await request(
				"/rpc",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": "Bearer inactive-token",
					},
					body: JSON.stringify({
						service: "casting-credits",
						params: {},
					}),
				},
				{},
				false, // Don't use default mock
			);

			expect(res.status).toBe(401);
			const data = await res.json();
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("UNAUTHORIZED");
			expect(data.error.message).toBe("Token is inactive or expired");
		});

		it("should forward token claims as headers to downstream service", async () => {
			let capturedRequest: Request | null = null;

			const res = await request(
				"/rpc",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": "Bearer test-token",
					},
					body: JSON.stringify({
						service: "casting-credits",
						params: { test: "data" },
					}),
				},
				{
					CASTING_CREDITS: {
						fetch: async (req) => {
							capturedRequest = req;
							return new Response(JSON.stringify({ success: true }), {
								status: 200,
							});
						},
					},
				},
			);

			expect(res.status).toBe(200);
			expect(capturedRequest).not.toBeNull();
			expect(capturedRequest!.headers.get("X-User-Id")).toBe("test-user-id");
			expect(capturedRequest!.headers.get("X-Username")).toBe("testuser");
			expect(capturedRequest!.headers.get("X-Org-Id")).toBe("test-org-id");
			expect(capturedRequest!.headers.get("X-Client-Id")).toBe("test-client-id");
		});
	});
});