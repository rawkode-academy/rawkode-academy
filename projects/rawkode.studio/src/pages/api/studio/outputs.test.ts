import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { GET, POST } from "./outputs";

describe("Studio output API authorization", () => {
	it("requires an authenticated user before loading output state", async () => {
		const response = await GET({
			locals: {},
			url: new URL("https://rawkode.studio/api/studio/outputs?sessionId=session-1"),
		} as never);
		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Sign in with rawkode.academy identity.",
		});
	});

	it("rejects cross-origin mutations before parsing destination secrets", async () => {
		const request = new Request("https://rawkode.studio/api/studio/outputs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://attacker.example",
			},
			body: JSON.stringify({
				action: "create",
				sessionId: "session-1",
				streamKey: "must-not-be-processed",
				url: "rtmps://example.com/live",
			}),
		});
		const response = await POST({
			locals: { user: { id: "operator" } },
			request,
		} as never);
		expect(response.status).toBe(403);
		expect(await response.text()).not.toContain("must-not-be-processed");
	});

	it("fails closed for unknown mutation actions", async () => {
		const request = new Request("https://rawkode.studio/api/studio/outputs", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://rawkode.studio",
			},
			body: JSON.stringify({ action: "unexpected", sessionId: "session-1" }),
		});
		const response = await POST({
			locals: { user: { id: "operator" } },
			request,
		} as never);
		expect(response.status).toBe(400);
	});
});
