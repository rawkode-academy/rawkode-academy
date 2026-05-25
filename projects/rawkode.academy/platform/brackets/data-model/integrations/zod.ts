import { z } from "zod";

// Command payloads accepted by the write-model. These are the contracts the
// admin (and the public apply form) write through; they are intentionally
// decoupled from the Drizzle row shapes.

export const SubmitRegistration = z.object({
	showId: z.string().min(1),
	bracketId: z.string().min(1),
	displayName: z.string().min(1),
	email: z.string().email(),
	teamName: z.string().min(1).nullish(),
	preferredSlot: z.number().int().nullish(),
	message: z.string().nullish(),
	userId: z.string().nullish(),
});
export type SubmitRegistration = z.infer<typeof SubmitRegistration>;

export const DecideRegistration = z.object({
	registrationId: z.string().min(1),
	decision: z.enum(["approved", "rejected"]),
	reviewedByUserId: z.string().min(1),
});
export type DecideRegistration = z.infer<typeof DecideRegistration>;

export const DecideApplication = z.object({
	applicationId: z.string().min(1),
	decision: z.enum(["approved", "rejected"]),
	reviewedByUserId: z.string().min(1),
});
export type DecideApplication = z.infer<typeof DecideApplication>;

export const GenerateBracket = z.object({
	bracketId: z.string().min(1),
	// Optional override of the first match time; defaults to bracket.startsAt.
	startsAt: z.number().int().nullish(),
});
export type GenerateBracket = z.infer<typeof GenerateBracket>;

export const RecordResult = z.object({
	matchId: z.string().min(1),
	// The winning bracket entry. Team winners are derived from the entry's teamId.
	winnerEntryId: z.string().min(1),
	scoreA: z.number().int().nullish(),
	scoreB: z.number().int().nullish(),
	timeToResolveSeconds: z.number().int().nullish(),
	notes: z.string().nullish(),
	recordedByUserId: z.string().nullish(),
});
export type RecordResult = z.infer<typeof RecordResult>;

export const SetMatchLiveState = z.object({
	matchId: z.string().min(1),
	state: z.enum(["live", "scheduled", "cancelled"]),
});
export type SetMatchLiveState = z.infer<typeof SetMatchLiveState>;

export const SelfRegisterCompetitor = z.object({
	bracketId: z.string().min(1),
	userId: z.string().min(1),
	displayName: z.string().min(1),
});
export type SelfRegisterCompetitor = z.infer<typeof SelfRegisterCompetitor>;

export const FormTeam = z.object({
	bracketId: z.string().min(1),
	name: z.string().min(1),
	userId: z.string().min(1),
});
export type FormTeam = z.infer<typeof FormTeam>;

export const JoinTeamViaInvite = z.object({
	token: z.string().min(1),
	userId: z.string().min(1),
	displayName: z.string().min(1),
});
export type JoinTeamViaInvite = z.infer<typeof JoinTeamViaInvite>;

export const RenameTeam = z.object({
	teamId: z.string().min(1),
	name: z.string().min(1),
	userId: z.string().min(1),
});
export type RenameTeam = z.infer<typeof RenameTeam>;

export const CreateTeamInvite = z.object({
	teamId: z.string().min(1),
	userId: z.string().min(1),
});
export type CreateTeamInvite = z.infer<typeof CreateTeamInvite>;

export const RevokeTeamInvite = z.object({
	token: z.string().min(1),
	userId: z.string().min(1),
});
export type RevokeTeamInvite = z.infer<typeof RevokeTeamInvite>;

export const LeaveTeam = z.object({
	teamId: z.string().min(1),
	userId: z.string().min(1),
});
export type LeaveTeam = z.infer<typeof LeaveTeam>;
