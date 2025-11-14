import { describe, expect, test } from "vitest";
import { user, session, account, passkey } from "../data-model/schema";

describe("Authentication Schema", () => {
	test("user table has required columns", () => {
		expect(user).toBeDefined();
		expect(user.id).toBeDefined();
		expect(user.email).toBeDefined();
		expect(user.emailVerified).toBeDefined();
		expect(user.name).toBeDefined();
		expect(user.image).toBeDefined();
		expect(user.createdAt).toBeDefined();
		expect(user.updatedAt).toBeDefined();
	});

	test("session table has required columns", () => {
		expect(session).toBeDefined();
		expect(session.id).toBeDefined();
		expect(session.userId).toBeDefined();
		expect(session.expiresAt).toBeDefined();
		expect(session.createdAt).toBeDefined();
	});

	test("account table has required columns for GitHub OAuth", () => {
		expect(account).toBeDefined();
		expect(account.id).toBeDefined();
		expect(account.userId).toBeDefined();
		expect(account.providerId).toBeDefined();
		expect(account.accountId).toBeDefined();
		expect(account.accessToken).toBeDefined();
	});

	test("passkey table has required columns for WebAuthn", () => {
		expect(passkey).toBeDefined();
		expect(passkey.id).toBeDefined();
		expect(passkey.userId).toBeDefined();
		expect(passkey.publicKey).toBeDefined();
		expect(passkey.credentialID).toBeDefined();
		expect(passkey.counter).toBeDefined();
		expect(passkey.deviceType).toBeDefined();
	});
});
