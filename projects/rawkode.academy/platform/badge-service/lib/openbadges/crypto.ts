import { SignJWT, exportJWK, importPKCS8, importSPKI } from "jose";
import type { JWK } from "jose";
import { KeyManagementError, SigningError } from "./errors.js";
import type { AchievementCredential, RSAKeys } from "./types.js";

type SecretString = string | { get(): Promise<string> };

export interface BadgeKeyEnv {
	BADGE_ISSUER_RSA_PRIVATE_KEY: SecretString;
	BADGE_ISSUER_RSA_PUBLIC_KEY: SecretString;
}

async function readSecretString(
	value: SecretString | undefined,
	name: string,
): Promise<string> {
	if (typeof value === "string" && value.trim()) {
		return value.trim().replaceAll("\\n", "\n");
	}

	if (typeof value === "string") {
		throw new KeyManagementError(`${name} environment variable is not set`);
	}

	const secret = await value?.get();
	if (typeof secret === "string" && secret.trim()) {
		return secret.trim().replaceAll("\\n", "\n");
	}

	throw new KeyManagementError(`${name} environment variable is not set`);
}

export function issuerKeyId(issuerUrl: string): string {
	return `${issuerUrl}/issuer/key-1`;
}

async function assertKeyPairMatches(
	privateKey: CryptoKey,
	publicKey: CryptoKey,
): Promise<void> {
	const probe = new TextEncoder().encode("rawkode-academy-badge-key-check");
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		privateKey,
		probe,
	);
	const verified = await crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		signature,
		probe,
	);

	if (!verified) {
		throw new KeyManagementError(
			"BADGE_ISSUER_RSA_PRIVATE_KEY and BADGE_ISSUER_RSA_PUBLIC_KEY do not match",
		);
	}
}

export async function loadRSAKeys(env: BadgeKeyEnv): Promise<RSAKeys> {
	try {
		const privatePem = await readSecretString(
			env.BADGE_ISSUER_RSA_PRIVATE_KEY,
			"BADGE_ISSUER_RSA_PRIVATE_KEY",
		);
		const publicPem = await readSecretString(
			env.BADGE_ISSUER_RSA_PUBLIC_KEY,
			"BADGE_ISSUER_RSA_PUBLIC_KEY",
		);
		const privateKey = await importPKCS8(privatePem, "RS256");
		const publicKey = await importSPKI(publicPem, "RS256");
		await assertKeyPairMatches(privateKey, publicKey);

		return { privateKey, publicKey };
	} catch (error) {
		if (error instanceof KeyManagementError) {
			throw error;
		}

		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		throw new KeyManagementError(`Failed to import RSA keys: ${message}`);
	}
}

export async function getPublicKeyJWK(
	publicKey: CryptoKey,
	issuerUrl: string,
): Promise<JWK & { kid: string }> {
	const jwk = await exportJWK(publicKey);
	return {
		...jwk,
		kid: issuerKeyId(issuerUrl),
	} as JWK & { kid: string };
}

export async function signCredentialAsJWT(
	credential: AchievementCredential,
	privateKey: CryptoKey,
	issuerUrl: string,
): Promise<string> {
	try {
		const nbf = Math.floor(new Date(credential.validFrom).getTime() / 1000);
		const exp = credential.validUntil
			? Math.floor(new Date(credential.validUntil).getTime() / 1000)
			: undefined;

		const jwt = new SignJWT({
			...credential,
			iss: credential.issuer.id,
			jti: credential.id,
			sub: credential.credentialSubject.id,
			nbf,
			...(exp !== undefined && { exp }),
		}).setProtectedHeader({
			alg: "RS256",
			typ: "JWT",
			kid: issuerKeyId(issuerUrl),
		});

		return await jwt.sign(privateKey);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		throw new SigningError(`Failed to sign credential as JWT: ${message}`);
	}
}
