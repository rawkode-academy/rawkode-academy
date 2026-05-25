// Typed client for the platform/brackets write-model, reached via the
// BRACKETS_WRITE service binding. The admin issues commands here instead of
// writing D1 directly.

export const SHOW_ID = "klustered";

export interface BracketsWrite {
	selfRegisterCompetitor(input: {
		bracketId: string;
		userId: string;
		displayName: string;
	}): Promise<{ competitorId: string; seasonId: string; bracketKind: string }>;
	formTeam(input: {
		bracketId: string;
		name: string;
		userId: string;
	}): Promise<{ teamId: string; token: string }>;
	joinTeamViaInvite(input: {
		token: string;
		userId: string;
		displayName: string;
	}): Promise<{ teamId: string; seasonId: string }>;
	renameTeam(input: {
		teamId: string;
		name: string;
		userId: string;
	}): Promise<{ ok: true }>;
	createTeamInvite(input: {
		teamId: string;
		userId: string;
	}): Promise<{ token: string }>;
	revokeTeamInvite(input: {
		token: string;
		userId: string;
	}): Promise<{ ok: true }>;
	leaveTeam(input: { teamId: string; userId: string }): Promise<{ ok: true }>;
	submitRegistration(input: {
		showId: string;
		bracketId: string;
		displayName: string;
		email: string;
		teamName?: string | null;
		preferredSlot?: number | null;
		message?: string | null;
		userId?: string | null;
	}): Promise<{ id: string }>;
	decideRegistration(input: {
		registrationId: string;
		decision: "approved" | "rejected";
		reviewedByUserId: string;
	}): Promise<{ ok: true }>;
	decideApplication(input: {
		applicationId: string;
		decision: "approved" | "rejected";
		reviewedByUserId: string;
	}): Promise<{ ok: true }>;
	generateBracket(input: {
		bracketId: string;
		startsAt?: number | null;
	}): Promise<{ workflowId: string }>;
	recordResult(input: {
		matchId: string;
		winnerEntryId: string;
		scoreA?: number | null;
		scoreB?: number | null;
		timeToResolveSeconds?: number | null;
		notes?: string | null;
		recordedByUserId?: string | null;
	}): Promise<{ workflowId: string }>;
	setMatchLiveState(input: {
		matchId: string;
		state: "live" | "scheduled" | "cancelled";
	}): Promise<{ ok: true }>;
	createSeason(input: {
		showId: string;
		slug: string;
		name: string;
		status?: "interest" | "active" | "finished";
		startDate?: number | null;
		endDate?: number | null;
	}): Promise<{ id: string }>;
	updateSeason(input: {
		id: string;
		slug?: string | null;
		name?: string | null;
		status?: "interest" | "active" | "finished" | null;
		startDate?: number | null;
		endDate?: number | null;
	}): Promise<{ ok: true }>;
	deleteSeason(input: { id: string }): Promise<{ ok: true }>;
	createBracket(input: {
		seasonId: string;
		name: string;
		slug: string;
		kind?: "solo" | "team";
		startsAt: number;
		registrationClosesAt?: number | null;
		maxEntries?: number;
		teamSize?: number;
		cadenceDays?: number;
	}): Promise<{ id: string }>;
	updateBracket(input: {
		id: string;
		status?: "draft" | "active" | "finished" | null;
		startsAt?: number | null;
		registrationClosesAt?: number | null;
	}): Promise<{ ok: true }>;
	deleteBracket(input: { id: string }): Promise<{ ok: true }>;
	createBracketEntry(input: {
		bracketId: string;
		competitorId?: string | null;
		teamId?: string | null;
		seed?: number | null;
	}): Promise<{ id: string }>;
	deleteBracketEntry(input: { id: string }): Promise<{ ok: true }>;
	createBracketBreak(input: {
		bracketId: string;
		label: string;
		startsAt: number;
		endsAt: number;
	}): Promise<{ id: string }>;
	deleteBracketBreak(input: { id: string }): Promise<{ ok: true }>;
	createCompetitor(input: {
		seasonId: string;
		personSlug: string;
		displayName: string;
		bio?: string | null;
		userId?: string | null;
	}): Promise<{ id: string }>;
	deleteCompetitor(input: { id: string }): Promise<{ ok: true }>;
	createTeam(input: {
		bracketId: string;
		slug: string;
		name: string;
	}): Promise<{ id: string }>;
	deleteTeam(input: { id: string }): Promise<{ ok: true }>;
	addTeamMember(input: {
		teamId: string;
		competitorId: string;
		role?: string | null;
	}): Promise<{ ok: true }>;
	removeTeamMember(input: {
		teamId: string;
		competitorId: string;
	}): Promise<{ ok: true }>;
	editMatch(input: {
		matchId: string;
		entryAId?: string | null;
		entryBId?: string | null;
		judgeUserId?: string | null;
		scheduledAt?: number | null;
		status?: "scheduled" | "live" | "completed" | "cancelled";
	}): Promise<{ ok: true }>;
}

export function bracketsWrite(env: { BRACKETS_WRITE: unknown }): BracketsWrite {
	return env.BRACKETS_WRITE as BracketsWrite;
}
