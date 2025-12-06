import { decodeJwt, exportPKCS8, exportSPKI } from "jose";
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

let TEST_RSA_PRIVATE_KEY: string;
let TEST_RSA_PUBLIC_KEY: string;

beforeAll(async () => {
	const { privateKey, publicKey } = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);
	TEST_RSA_PRIVATE_KEY = await exportPKCS8(privateKey);
	TEST_RSA_PUBLIC_KEY = await exportSPKI(publicKey);
});

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
			name: "Kubernetes Basics",
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
			name: "Test",
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
			name: "Test Achievement",
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
			name: "Test Achievement",
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
			name: "Test Achievement",
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
			name: "Test Achievement",
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
