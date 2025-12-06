import { SignJWT, exportJWK, importPKCS8, importSPKI } from "jose";
import type { JWK } from "jose";
import { KeyManagementError, SigningError } from "./errors.js";
import type { AchievementCredential, RSAKeys } from "./types.js";

export interface BadgeKeyEnv {
	BADGE_ISSUER_RSA_PRIVATE_KEY: string;
	BADGE_ISSUER_RSA_PUBLIC_KEY: string;
}

export async function loadRSAKeys(env: BadgeKeyEnv): Promise<RSAKeys> {
	const { BADGE_ISSUER_RSA_PRIVATE_KEY, BADGE_ISSUER_RSA_PUBLIC_KEY } = env;

	if (!BADGE_ISSUER_RSA_PRIVATE_KEY) {
		throw new KeyManagementError(
			"BADGE_ISSUER_RSA_PRIVATE_KEY environment variable is not set",
		);
	}

	if (!BADGE_ISSUER_RSA_PUBLIC_KEY) {
		throw new KeyManagementError(
			"BADGE_ISSUER_RSA_PUBLIC_KEY environment variable is not set",
		);
	}

	try {
		const privateKey = await importPKCS8(BADGE_ISSUER_RSA_PRIVATE_KEY, "RS256");
		const publicKey = await importSPKI(BADGE_ISSUER_RSA_PUBLIC_KEY, "RS256");

		return { privateKey, publicKey };
	} catch (error) {
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
		kid: `${issuerUrl}/issuer#key-1`,
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
			kid: `${issuerUrl}/issuer#key-1`,
		});

		return await jwt.sign(privateKey);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error occurred";
		throw new SigningError(`Failed to sign credential as JWT: ${message}`);
	}
}
