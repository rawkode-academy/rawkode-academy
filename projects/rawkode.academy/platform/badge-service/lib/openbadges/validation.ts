import { z } from "zod";
import { CredentialValidationError } from "./errors.js";
import type { AchievementCredential } from "./types.js";

const ImageSchema = z.object({
	id: z.string(),
	type: z.literal("Image"),
});

const ProfileSchema = z.object({
	id: z.string(),
	type: z.array(z.string()).min(1),
	name: z.string().min(1),
	url: z.string().optional(),
	email: z.string().email().optional(),
});

const CriteriaSchema = z.object({
	id: z.string().optional(),
	type: z.string().optional(),
	narrative: z.string(),
});

const AchievementSchema = z.object({
	id: z.string(),
	type: z.array(z.string()).min(1),
	creator: ProfileSchema,
	name: z.string().min(1),
	description: z.string(),
	criteria: CriteriaSchema,
	image: ImageSchema.optional(),
});

const CredentialSubjectSchema = z.object({
	id: z.string(),
	type: z.array(z.string()).min(1),
	achievement: AchievementSchema,
});

const ProofSchema = z.object({
	type: z.string(),
	created: z.string().datetime().optional(),
	verificationMethod: z.string().optional(),
	proofPurpose: z.string().optional(),
	jwt: z.string().optional(),
});

const AchievementCredentialSchema = z.object({
	"@context": z.array(z.string()).min(2),
	id: z.string(),
	type: z.array(z.string()).min(1),
	name: z.string().min(1),
	issuer: ProfileSchema,
	credentialSubject: CredentialSubjectSchema,
	validFrom: z.string().datetime(),
	validUntil: z.string().datetime().optional(),
	proof: z.array(ProofSchema).optional(),
});

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationError {
	path: string;
	message: string;
}

export function validateCredential(
	credential: AchievementCredential,
): ValidationResult {
	const result = AchievementCredentialSchema.safeParse(credential);

	if (!result.success) {
		const errors: ValidationError[] = result.error.errors.map((error) => ({
			path: error.path.join("/") || "/",
			message: error.message,
		}));

		return { valid: false, errors };
	}

	return { valid: true, errors: [] };
}

export function validateCredentialOrThrow(
	credential: AchievementCredential,
): void {
	const result = validateCredential(credential);

	if (!result.valid) {
		throw new CredentialValidationError(
			`Credential validation failed: ${result.errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`,
			result.errors,
		);
	}
}
