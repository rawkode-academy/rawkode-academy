// Admin match commands. Team brackets assign a slot by team. Solo brackets
// have no team: a slot is the bracket entry itself, and a slot the form does
// not send stays as it is.

export const MATCH_STATUSES = [
	"scheduled",
	"live",
	"completed",
	"cancelled",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];
export type BracketKind = "solo" | "team";

export type MatchSides = {
	entryAId: string | null;
	entryBId: string | null;
	teamAId: string | null;
	teamBId: string | null;
};

export type BracketEntryRef = {
	id: string;
	teamId: string | null;
};

export type EntryPatch = {
	entryAId?: string | null;
	entryBId?: string | null;
};

export type MatchEditCommand = EntryPatch & {
	judgeUserId: string | null;
	scheduledAt: number | null;
	status: MatchStatus;
};

export type MatchResultCommand = {
	winnerEntryId: string;
	scoreA: number | null;
	scoreB: number | null;
	timeToResolveSeconds: number | null;
	notes: string | null;
};

export type WinnerOption = {
	value: string;
	label: string;
	selected: boolean;
};

export type WinnerSelect = {
	name: "winnerTeamId" | "winnerEntryId";
	options: WinnerOption[];
};

type MatchAdminFailure = {
	ok: false;
	status: 400;
	message: string;
};

type SlotRead =
	| { ok: true; present: false }
	| { ok: true; present: true; id: string | null }
	| MatchAdminFailure;

const ENTRY_FIELDS = ["entryAId", "entryBId"] as const;
const TEAM_FIELDS = [
	["teamAId", "entryAId"],
	["teamBId", "entryBId"],
] as const;

function blankToNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function fieldValue(form: FormData, key: string): string | null {
	return blankToNull(String(form.get(key) ?? ""));
}

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
	const raw = String(value ?? "").trim();
	if (!raw) return null;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function isMatchStatus(value: string): value is MatchStatus {
	return (MATCH_STATUSES as readonly string[]).includes(value);
}

function participantFailure(): MatchAdminFailure {
	return {
		ok: false,
		status: 400,
		message: "winner is not a participant in this match",
	};
}

function readEntrySlot(
	form: FormData,
	key: (typeof ENTRY_FIELDS)[number],
	entries: readonly BracketEntryRef[],
): SlotRead {
	if (!form.has(key)) return { ok: true, present: false };
	const id = fieldValue(form, key);
	if (id === null) return { ok: true, present: true, id: null };
	if (!entries.some((entry) => entry.id === id)) {
		return {
			ok: false,
			status: 400,
			message: "entry is not in this bracket",
		};
	}
	return { ok: true, present: true, id };
}

function readTeamSlot(
	form: FormData,
	key: "teamAId" | "teamBId",
	entries: readonly BracketEntryRef[],
): SlotRead {
	if (!form.has(key)) return { ok: true, present: false };
	const teamId = fieldValue(form, key);
	if (teamId === null) return { ok: true, present: true, id: null };
	return {
		ok: true,
		present: true,
		id: entries.find((entry) => entry.teamId === teamId)?.id ?? null,
	};
}

function entryPatch(
	reads: ReadonlyArray<{
		key: "entryAId" | "entryBId";
		slot: SlotRead;
	}>,
): { ok: true; entries: EntryPatch } | MatchAdminFailure {
	const failure = reads.find((read) => !read.slot.ok);
	if (failure && !failure.slot.ok) return failure.slot;

	const entries = reads.reduce<EntryPatch>((patch, read) => {
		if (!read.slot.ok || !read.slot.present) return patch;
		return { ...patch, [read.key]: read.slot.id };
	}, {});
	return { ok: true, entries };
}

function planSoloEntryEdit(
	form: FormData,
	entries: readonly BracketEntryRef[],
): { ok: true; entries: EntryPatch } | MatchAdminFailure {
	return entryPatch(
		ENTRY_FIELDS.map((key) => ({
			key,
			slot: readEntrySlot(form, key, entries),
		})),
	);
}

function planTeamEntryEdit(
	form: FormData,
	entries: readonly BracketEntryRef[],
): { ok: true; entries: EntryPatch } | MatchAdminFailure {
	return entryPatch(
		TEAM_FIELDS.map(([field, key]) => ({
			key,
			slot: readTeamSlot(form, field, entries),
		})),
	);
}

function resolveWinnerEntryId(
	match: MatchSides,
	form: FormData,
): { ok: true; winnerEntryId: string } | MatchAdminFailure {
	const winnerEntryId = fieldValue(form, "winnerEntryId");
	if (winnerEntryId) {
		if (
			winnerEntryId === match.entryAId ||
			winnerEntryId === match.entryBId
		) {
			return { ok: true, winnerEntryId };
		}
		return participantFailure();
	}

	const winnerTeamId = fieldValue(form, "winnerTeamId");
	if (!winnerTeamId) {
		return { ok: false, status: 400, message: "winner required" };
	}
	if (winnerTeamId === match.teamAId) {
		return match.entryAId
			? { ok: true, winnerEntryId: match.entryAId }
			: participantFailure();
	}
	if (winnerTeamId === match.teamBId) {
		return match.entryBId
			? { ok: true, winnerEntryId: match.entryBId }
			: participantFailure();
	}
	return participantFailure();
}

export function matchResultCommand(
	form: FormData,
	match: MatchSides,
): { ok: true; result: MatchResultCommand } | MatchAdminFailure {
	const winner = resolveWinnerEntryId(match, form);
	if (!winner.ok) return winner;
	return {
		ok: true,
		result: {
			winnerEntryId: winner.winnerEntryId,
			scoreA: parseIntOrNull(form.get("scoreA")),
			scoreB: parseIntOrNull(form.get("scoreB")),
			timeToResolveSeconds: parseIntOrNull(form.get("timeToResolveSeconds")),
			notes: fieldValue(form, "notes"),
		},
	};
}

export function matchEditCommand(input: {
	kind: BracketKind;
	form: FormData;
	entries: readonly BracketEntryRef[];
}): { ok: true; command: MatchEditCommand } | MatchAdminFailure {
	const status = String(input.form.get("status") ?? "").trim();
	if (!isMatchStatus(status)) {
		return { ok: false, status: 400, message: "invalid status" };
	}

	const planned =
		input.kind === "solo"
			? planSoloEntryEdit(input.form, input.entries)
			: planTeamEntryEdit(input.form, input.entries);
	if (!planned.ok) return planned;

	const scheduledAt = fieldValue(input.form, "scheduledAt");
	return {
		ok: true,
		command: {
			...planned.entries,
			judgeUserId: fieldValue(input.form, "judgeUserId"),
			scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : null,
			status,
		},
	};
}

export function winnerSelect(input: {
	kind: BracketKind;
	match: MatchSides;
	teamNames: Readonly<Record<string, string>>;
	entryNames: Readonly<Record<string, string>>;
	selectedWinnerTeamId?: string | null;
	selectedWinnerEntryId?: string | null;
}): WinnerSelect {
	const sides = [
		{ entryId: input.match.entryAId, teamId: input.match.teamAId },
		{ entryId: input.match.entryBId, teamId: input.match.teamBId },
	];
	const options = sides.flatMap((side): WinnerOption[] => {
		if (input.kind === "solo") {
			if (!side.entryId) return [];
			return [
				{
					value: side.entryId,
					label: input.entryNames[side.entryId] ?? side.entryId,
					selected: input.selectedWinnerEntryId === side.entryId,
				},
			];
		}
		if (!side.teamId) return [];
		return [
			{
				value: side.teamId,
				label: input.teamNames[side.teamId] ?? side.teamId,
				selected: input.selectedWinnerTeamId === side.teamId,
			},
		];
	});
	return {
		name: input.kind === "solo" ? "winnerEntryId" : "winnerTeamId",
		options,
	};
}

export function recordedWinnerName(input: {
	winnerTeamId: string | null;
	winnerEntryId: string | null;
	teamNames: Readonly<Record<string, string>>;
	entryNames: Readonly<Record<string, string>>;
}): string {
	if (input.winnerTeamId) {
		return input.teamNames[input.winnerTeamId] ?? input.winnerTeamId;
	}
	if (input.winnerEntryId) {
		return input.entryNames[input.winnerEntryId] ?? input.winnerEntryId;
	}
	return "—";
}
