import { signCredentialAsJWT } from "./crypto.js";
import type {
	Achievement,
	AchievementCredential,
	BuildAchievementParams,
	BuildCredentialParams,
	OPENBADGE_CONTEXT,
	Profile,
} from "./types.js";
import { validateCredentialOrThrow } from "./validation.js";

export function buildAchievement(params: BuildAchievementParams): Achievement {
	return {
		id: params.id,
		type: ["Achievement"],
		creator: params.creatorProfile,
		name: params.name,
		description: params.description,
		criteria: {
			narrative: params.criteria || params.description,
		},
		image: {
			id: params.imageUrl,
			type: "Image",
		},
	};
}

export function buildCredential(
	params: BuildCredentialParams,
): AchievementCredential {
	const credential: AchievementCredential = {
		"@context": [
			"https://www.w3.org/ns/credentials/v2",
			"https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
		] as typeof OPENBADGE_CONTEXT,
		id: params.id,
		type: ["VerifiableCredential", "AchievementCredential"],
		name: params.name,
		issuer: params.issuerProfile,
		credentialSubject: {
			id: `mailto:${params.recipientEmail}`,
			type: ["AchievementSubject"],
			achievement: params.achievement,
		},
		validFrom: params.validFrom.toISOString(),
	};

	if (params.validUntil) {
		credential.validUntil = params.validUntil.toISOString();
	}

	return credential;
}

export async function createSignedCredential(
	params: BuildCredentialParams,
	privateKey: CryptoKey,
	issuerUrl: string,
): Promise<string> {
	const credential = buildCredential(params);
	validateCredentialOrThrow(credential);
	return signCredentialAsJWT(credential, privateKey, issuerUrl);
}

export function createIssuerProfile(
	issuerUrl: string,
	name: string,
	email?: string,
): Profile {
	return {
		id: `${issuerUrl}/issuer`,
		type: ["Profile"],
		name,
		url: issuerUrl,
		...(email && { email }),
	};
}
