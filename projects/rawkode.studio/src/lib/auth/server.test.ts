import { describe, expect, it } from "vitest";
import {
	createStoredSession,
	getUserInfoGithubHandle,
	normalizeGithubHandle,
} from "./server";

describe("Studio identity normalization", () => {
	it("uses normalized GitHub handles as Studio user IDs", () => {
		const session = createStoredSession(
			{
				sub: "better-auth-user-id",
				email: "rawkode@example.com",
				name: "Rawkode",
				picture: "https://example.com/rawkode.png",
				username: "Rawkode",
			},
			12345,
		);

		expect(session.userId).toBe("rawkode");
		expect(session.user).toMatchObject({
			id: "rawkode",
			image: "https://example.com/rawkode.png",
			username: "rawkode",
		});
	});

	it("falls back to preferred_username before opaque identity subjects", () => {
		expect(
			getUserInfoGithubHandle({
				sub: "opaque-user-id",
				preferred_username: "@GuestUser",
			}),
		).toBe("guestuser");
	});

	it("keeps opaque subjects only when identity does not provide a GitHub handle", () => {
		const session = createStoredSession(
			{
				sub: "opaque-user-id",
				name: "Fallback User",
			},
			12345,
		);

		expect(session.userId).toBe("opaque-user-id");
		expect(session.user.id).toBe("opaque-user-id");
		expect(session.user.username).toBeNull();
	});

	it("normalizes development handles the same way as OAuth handles", () => {
		expect(normalizeGithubHandle(" @Rawkode ")).toBe("rawkode");
	});
});
