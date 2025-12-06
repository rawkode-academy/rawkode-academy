import { decodeJwt } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
	DEFAULT_IMAGE_SERVICE_BASE_URL,
	generateBadgeImageUrl,
} from "../../image-service.js";
import {
	type BadgeKeyEnv,
	type BuildCredentialParams,
	CredentialValidationError,
	KeyManagementError,
	OPENBADGE_CONTEXT,
	type Profile,
	buildAchievement,
	buildCredential,
	createIssuerProfile,
	createSignedCredential,
	loadRSAKeys,
	signCredentialAsJWT,
	validateCredential,
	validateCredentialOrThrow,
} from "../index.js";

const TEST_ISSUER_URL = "https://badges.rawkode.academy";

const TEST_RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7QXdoLMHLyRcw
h5CfH3KgWv7kqHkjjjxr9Q7Rz6v5L6WV8L8lzK8zWJNhN5F6kJ7Qv6Z9w3X6c6hY
YQh3V8T9x4b6X5Y8D6m7vP9xN3r5sLl3F6h9j8K2mQ5y7v4B3w8Y6R5t9e2K5H6L
8J9M6N5O4P3Q2R1S0T9U8V7W6X5Y4Z3A2B1C0D9E8F7G6H5I4J3K2L1M0N9O8P7Q
6R5S4T3U2V1W0X9Y8Z7A6B5C4D3E2F1G0H9I8J7K6L5M4N3O2P1Q0R9S8T7U6V5W
4X3Y2Z1A0B9C8D7E6F5G4H3I2J1K0L9M8N7O6P5Q4R3S2T1U0V9W8X7Y6Z5A4B3C
2D1E0F9G8H7AgMBAAECggEAYQi9bEQZCVBEu8C4WbQ4pF6K6J5X7k2h3L6m9n0o1
P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6O7P8Q9R0S1T2U
3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4
A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F
6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F2G3H4I5J6K7L
8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6E7F8G9H0I1J2K3L4M5N6QKBgQD
q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w
2x3y4z5a6b7c8d9e0f1g2h3i4j5k6l7m8n9o0p1q2r3s4t5u6v7w8x9y0z1a2b3c4
d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j
7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9
-----END PRIVATE KEY-----`;

const TEST_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu0F3aCzBy8kXMIeQnx9y
oFr+5Kh5I448a/UO0c+r+S+llfC/JcyvM1iTYTeRepCe0L+mfcN1+nOoWGEId1fE
/ceG+l+WPA+pu7z/cTd6+bC5dxeofY/CtpkOcu7+Ad8PGOkebfXtiuR+i/CfTOje
TuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3S
QuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3S
QuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3SQuD90kLg/dJC4P3S
QwIDAQAB
-----END PUBLIC KEY-----`;

describe("OpenBadge Types", () => {
	it("should have correct OPENBADGE_CONTEXT", () => {
		expect(OPENBADGE_CONTEXT).toEqual([
			"https://www.w3.org/ns/credentials/v2",
			"https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
		]);
	});
});

describe("createIssuerProfile", () => {
	it("should create a valid issuer profile", () => {
		const profile = createIssuerProfile(
			TEST_ISSUER_URL,
			"Rawkode Academy",
			"badges@rawkode.academy",
		);

		expect(profile.id).toBe(`${TEST_ISSUER_URL}/issuer`);
		expect(profile.type).toEqual(["Profile"]);
		expect(profile.name).toBe("Rawkode Academy");
		expect(profile.url).toBe(TEST_ISSUER_URL);
		expect(profile.email).toBe("badges@rawkode.academy");
	});

	it("should create profile without email when not provided", () => {
		const profile = createIssuerProfile(TEST_ISSUER_URL, "Rawkode Academy");

		expect(profile.email).toBeUndefined();
	});
});

describe("buildAchievement", () => {
	it("should build a valid achievement", () => {
		const creatorProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/kubernetes-basics`,
			name: "Kubernetes Basics",
			description: "Completed the Kubernetes basics course",
			imageUrl: "https://image.rawkode.academy/image?payload=abc123",
			creatorProfile,
		});

		expect(achievement.id).toBe(
			`${TEST_ISSUER_URL}/achievements/kubernetes-basics`,
		);
		expect(achievement.type).toEqual(["Achievement"]);
		expect(achievement.creator).toBe(creatorProfile);
		expect(achievement.name).toBe("Kubernetes Basics");
		expect(achievement.description).toBe(
			"Completed the Kubernetes basics course",
		);
		expect(achievement.image).toEqual({
			id: "https://image.rawkode.academy/image?payload=abc123",
			type: "Image",
		});
	});
});

describe("buildCredential", () => {
	it("should build a valid credential", () => {
		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const creatorProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/kubernetes-basics`,
			name: "Kubernetes Basics",
			description: "Completed the Kubernetes basics course",
			imageUrl: "https://image.rawkode.academy/image?payload=abc123",
			creatorProfile,
		});

		const validFrom = new Date("2024-01-01T00:00:00Z");
		const validUntil = new Date("2025-01-01T00:00:00Z");

		const credential = buildCredential({
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom,
			validUntil,
		});

		expect(credential["@context"]).toEqual(OPENBADGE_CONTEXT);
		expect(credential.id).toBe(`${TEST_ISSUER_URL}/credentials/cred123`);
		expect(credential.type).toEqual([
			"VerifiableCredential",
			"AchievementCredential",
		]);
		expect(credential.issuer).toBe(issuerProfile);
		expect(credential.credentialSubject.id).toBe("mailto:user@example.com");
		expect(credential.credentialSubject.type).toEqual(["AchievementSubject"]);
		expect(credential.credentialSubject.achievement).toBe(achievement);
		expect(credential.validFrom).toBe("2024-01-01T00:00:00.000Z");
		expect(credential.validUntil).toBe("2025-01-01T00:00:00.000Z");
	});

	it("should build credential without validUntil when not provided", () => {
		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/test`,
			name: "Test",
			description: "Test achievement",
			imageUrl: "https://example.com/image.svg",
			creatorProfile: issuerProfile,
		});

		const credential = buildCredential({
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom: new Date(),
		});

		expect(credential.validUntil).toBeUndefined();
	});
});

describe("validateCredential", () => {
	it("should validate a correct credential", () => {
		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/test`,
			name: "Test Achievement",
			description: "A test achievement",
			imageUrl: "https://example.com/image.svg",
			creatorProfile: issuerProfile,
		});

		const credential = buildCredential({
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom: new Date(),
		});

		const result = validateCredential(credential);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("should return errors for invalid credential", () => {
		const invalidCredential = {
			"@context": [],
			id: "not-a-uri",
			type: [],
			issuer: {},
			credentialSubject: {},
			validFrom: "invalid-date",
		} as never;

		const result = validateCredential(invalidCredential);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});

describe("validateCredentialOrThrow", () => {
	it("should throw CredentialValidationError for invalid credential", () => {
		const invalidCredential = {
			"@context": [],
			id: "not-a-uri",
			type: [],
		} as never;

		expect(() => validateCredentialOrThrow(invalidCredential)).toThrow(
			CredentialValidationError,
		);
	});
});

describe("loadRSAKeys", () => {
	it("should throw KeyManagementError when private key is missing", async () => {
		const env = {
			BADGE_ISSUER_RSA_PRIVATE_KEY: "",
			BADGE_ISSUER_RSA_PUBLIC_KEY: TEST_RSA_PUBLIC_KEY,
		};

		await expect(loadRSAKeys(env)).rejects.toThrow(KeyManagementError);
		await expect(loadRSAKeys(env)).rejects.toThrow(
			"BADGE_ISSUER_RSA_PRIVATE_KEY environment variable is not set",
		);
	});

	it("should throw KeyManagementError when public key is missing", async () => {
		const env = {
			BADGE_ISSUER_RSA_PRIVATE_KEY: TEST_RSA_PRIVATE_KEY,
			BADGE_ISSUER_RSA_PUBLIC_KEY: "",
		};

		await expect(loadRSAKeys(env)).rejects.toThrow(KeyManagementError);
		await expect(loadRSAKeys(env)).rejects.toThrow(
			"BADGE_ISSUER_RSA_PUBLIC_KEY environment variable is not set",
		);
	});

	it("should throw KeyManagementError for invalid PEM format", async () => {
		const env = {
			BADGE_ISSUER_RSA_PRIVATE_KEY: "invalid-pem-data",
			BADGE_ISSUER_RSA_PUBLIC_KEY: TEST_RSA_PUBLIC_KEY,
		};

		await expect(loadRSAKeys(env)).rejects.toThrow(KeyManagementError);
		await expect(loadRSAKeys(env)).rejects.toThrow("Failed to import RSA keys");
	});
});

describe("generateBadgeImageUrl", () => {
	it("should generate a valid image URL with title", () => {
		const url = generateBadgeImageUrl({ title: "Test Badge" });

		expect(url).toMatch(/^https:\/\/image\.rawkode\.academy\/image\?payload=/);
	});

	it("should include subtitle in payload when provided", () => {
		const url = generateBadgeImageUrl({
			title: "Test Badge",
			subtitle: "Completed",
		});

		expect(url).toMatch(/^https:\/\/image\.rawkode\.academy\/image\?payload=/);
	});

	it("should use default template when not provided", () => {
		const url = generateBadgeImageUrl({ title: "Test Badge" });
		expect(url).toContain("payload=");
	});

	it("should use custom template when provided", () => {
		const url = generateBadgeImageUrl({
			title: "Test Badge",
			template: "custom",
		});
		expect(url).toContain("payload=");
	});

	it("should use custom baseUrl when provided", () => {
		const customBaseUrl = "https://staging.image.example.com";
		const url = generateBadgeImageUrl({
			title: "Test Badge",
			baseUrl: customBaseUrl,
		});

		expect(url).toMatch(
			/^https:\/\/staging\.image\.example\.com\/image\?payload=/,
		);
		expect(url).not.toContain(DEFAULT_IMAGE_SERVICE_BASE_URL);
	});

	it("should use default baseUrl when not provided", () => {
		const url = generateBadgeImageUrl({ title: "Test Badge" });

		expect(url).toContain(DEFAULT_IMAGE_SERVICE_BASE_URL);
	});
});

describe("signCredentialAsJWT", () => {
	it("should not include iat claim in signed JWT", async () => {
		const { privateKey } = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/test`,
			name: "Test Achievement",
			description: "A test achievement",
			imageUrl: "https://example.com/image.svg",
			creatorProfile: issuerProfile,
		});

		const validFrom = new Date("2024-01-01T00:00:00Z");
		const validUntil = new Date("2025-01-01T00:00:00Z");

		const credential = buildCredential({
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom,
			validUntil,
		});

		const jwt = await signCredentialAsJWT(
			credential,
			privateKey,
			TEST_ISSUER_URL,
		);
		const payload = decodeJwt(jwt);

		expect(payload.iat).toBeUndefined();
		expect(payload.iss).toBe(issuerProfile.id);
		expect(payload.jti).toBe(credential.id);
		expect(payload.sub).toBe("mailto:user@example.com");
		expect(payload.nbf).toBe(Math.floor(validFrom.getTime() / 1000));
		expect(payload.exp).toBe(Math.floor(validUntil.getTime() / 1000));
	});

	it("should not include exp claim when validUntil is not set", async () => {
		const { privateKey } = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/test`,
			name: "Test Achievement",
			description: "A test achievement",
			imageUrl: "https://example.com/image.svg",
			creatorProfile: issuerProfile,
		});

		const credential = buildCredential({
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom: new Date("2024-01-01T00:00:00Z"),
		});

		const jwt = await signCredentialAsJWT(
			credential,
			privateKey,
			TEST_ISSUER_URL,
		);
		const payload = decodeJwt(jwt);

		expect(payload.exp).toBeUndefined();
	});
});

describe("createSignedCredential", () => {
	it("should produce a signed JWT for valid params", async () => {
		const { privateKey } = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		const issuerProfile: Profile = {
			id: `${TEST_ISSUER_URL}/issuer`,
			type: ["Profile"],
			name: "Rawkode Academy",
		};

		const achievement = buildAchievement({
			id: `${TEST_ISSUER_URL}/achievements/test`,
			name: "Test Achievement",
			description: "A test achievement",
			imageUrl: "https://example.com/image.svg",
			creatorProfile: issuerProfile,
		});

		const params: BuildCredentialParams = {
			id: `${TEST_ISSUER_URL}/credentials/cred123`,
			issuerProfile,
			recipientEmail: "user@example.com",
			achievement,
			validFrom: new Date("2024-01-01T00:00:00Z"),
		};

		const jwt = await createSignedCredential(
			params,
			privateKey,
			TEST_ISSUER_URL,
		);

		expect(typeof jwt).toBe("string");
		expect(jwt.split(".")).toHaveLength(3);
	});

	it("should throw CredentialValidationError for invalid params", async () => {
		const { privateKey } = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		const invalidParams = {
			id: "not-a-valid-uri",
			issuerProfile: { id: "invalid", type: [], name: "" },
			recipientEmail: "",
			achievement: { id: "invalid", type: [], name: "", description: "" },
			validFrom: new Date(),
		} as unknown as BuildCredentialParams;

		await expect(
			createSignedCredential(invalidParams, privateKey, TEST_ISSUER_URL),
		).rejects.toThrow(CredentialValidationError);
	});
});
