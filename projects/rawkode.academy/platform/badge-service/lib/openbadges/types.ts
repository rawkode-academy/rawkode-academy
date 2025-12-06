export const OPENBADGE_CONTEXT = [
	"https://www.w3.org/ns/credentials/v2",
	"https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
] as const;

export interface Image {
	id: string;
	type: "Image";
}

export interface Profile {
	id: string;
	type: ["Profile"];
	name: string;
	url?: string;
	email?: string;
}

export interface Criteria {
	id?: string;
	type?: string;
	narrative: string;
}

export interface Achievement {
	id: string;
	type: ["Achievement"];
	creator: Profile;
	name: string;
	description: string;
	criteria: Criteria;
	image: Image;
}

export interface CredentialSubject {
	id: string;
	type: ["AchievementSubject"];
	achievement: Achievement;
}

export interface JWTProof {
	type: "DataIntegrityProof";
	created: string;
	verificationMethod: string;
	proofPurpose: "assertionMethod";
	jwt: string;
}

export interface AchievementCredential {
	"@context": typeof OPENBADGE_CONTEXT;
	id: string;
	type: ["VerifiableCredential", "AchievementCredential"];
	name: string;
	issuer: Profile;
	credentialSubject: CredentialSubject;
	validFrom: string;
	validUntil?: string;
	proof?: JWTProof[];
}

export interface BuildAchievementParams {
	id: string;
	name: string;
	description: string;
	criteria?: string;
	imageUrl: string;
	creatorProfile: Profile;
}

export interface BuildCredentialParams {
	id: string;
	name: string;
	issuerProfile: Profile;
	recipientEmail: string;
	achievement: Achievement;
	validFrom: Date;
	validUntil?: Date;
}

export interface JWTClaims {
	iss: string;
	jti: string;
	sub: string;
	nbf: number;
	exp?: number;
}

export interface RSAKeys {
	privateKey: CryptoKey;
	publicKey: CryptoKey;
}
