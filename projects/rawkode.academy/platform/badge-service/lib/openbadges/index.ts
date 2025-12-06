export {
	buildAchievement,
	buildCredential,
	createSignedCredential,
	createIssuerProfile,
} from "./credential.js";

export {
	loadRSAKeys,
	getPublicKeyJWK,
	signCredentialAsJWT,
} from "./crypto.js";

export type { BadgeKeyEnv } from "./crypto.js";

export {
	validateCredential,
	validateCredentialOrThrow,
} from "./validation.js";

export type { ValidationResult, ValidationError } from "./validation.js";

export {
	OpenBadgeError,
	KeyManagementError,
	CredentialValidationError,
	SigningError,
} from "./errors.js";

export type {
	Achievement,
	AchievementCredential,
	BuildAchievementParams,
	BuildCredentialParams,
	CredentialSubject,
	Image,
	JWTClaims,
	JWTProof,
	Profile,
	RSAKeys,
} from "./types.js";

export { OPENBADGE_CONTEXT } from "./types.js";
