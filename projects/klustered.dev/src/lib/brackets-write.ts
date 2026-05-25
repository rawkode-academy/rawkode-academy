// Typed client for the platform/brackets write-model, reached via the
// BRACKETS_WRITE service binding. The admin issues commands here instead of
// writing D1 directly.

export const SHOW_ID = "klustered";

export interface BracketsWrite {
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
	deleteSeason(input: { id: string }): Promise<{ ok: true }>;
	createBracket(input: {
		seasonId: string;
		name: string;
		slug: string;
		kind?: "solo" | "team";
		startsAt?: number | null;
		registrationClosesAt?: number | null;
		maxEntries?: number;
		cadenceDays?: number;
	}): Promise<{ id: string }>;
	deleteBracket(input: { id: string }): Promise<{ ok: true }>;
	createScenario(input: {
		slug: string;
		title: string;
		description: string;
		difficulty?: "easy" | "medium" | "hard";
		tags?: string[];
		notes?: string | null;
	}): Promise<{ id: string }>;
	deleteScenario(input: { id: string }): Promise<{ ok: true }>;
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
		seasonId: string;
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
		scenarioId?: string | null;
		judgeUserId?: string | null;
		scheduledAt?: number | null;
		status?: "scheduled" | "live" | "completed" | "cancelled";
	}): Promise<{ ok: true }>;
}

export function bracketsWrite(env: { BRACKETS_WRITE: unknown }): BracketsWrite {
	return env.BRACKETS_WRITE as BracketsWrite;
}
