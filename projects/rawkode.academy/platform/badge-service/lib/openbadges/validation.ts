import { z } from "zod";
import { CredentialValidationError } from "./errors.js";
import type { AchievementCredential } from "./types.js";

const ImageSchema = z.object({
	id: z.string(),
	type: z.literal("Image"),
});

const arrayContaining = (value: string) =>
	z.array(z.string()).refine((values) => values.includes(value), {
		message: `must include ${value}`,
	});

const ProfileSchema = z.object({
	id: z.string(),
	type: arrayContaining("Profile"),
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
	type: arrayContaining("Achievement"),
	creator: ProfileSchema,
	name: z.string().min(1),
	description: z.string(),
	criteria: CriteriaSchema,
	image: ImageSchema.optional(),
});

const CredentialSubjectSchema = z.object({
	id: z.string(),
	type: arrayContaining("AchievementSubject"),
	achievement: AchievementSchema,
});

const ProofSchema = z.object({
	type: z.literal("JwtProof2020"),
	jwt: z.string().min(1),
});

const AchievementCredentialSchema = z.object({
	"@context": z
		.array(z.string())
		.refine(
			(values) =>
				values.includes("https://www.w3.org/ns/credentials/v2") &&
				values.includes(
					"https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
				),
			{ message: "must include W3C VC v2 and OpenBadge v3 contexts" },
		),
	id: z.string(),
	type: z
		.array(z.string())
		.refine(
			(values) =>
				values.includes("VerifiableCredential") &&
				values.includes("AchievementCredential"),
			{
				message: "must include VerifiableCredential and AchievementCredential",
			},
		),
	name: z.string().min(1),
	issuer: ProfileSchema,
	credentialSubject: CredentialSubjectSchema,
	validFrom: z.string().datetime(),
	validUntil: z.string().datetime().optional(),
	proof: ProofSchema.optional(),
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
