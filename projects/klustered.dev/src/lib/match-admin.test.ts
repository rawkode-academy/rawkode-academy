import { describe, expect, it } from "bun:test";
import {
	matchEditCommand,
	matchResultCommand,
	recordedWinnerName,
	winnerSelect,
	type BracketEntryRef,
	type MatchSides,
} from "./match-admin";

const soloEntries: readonly BracketEntryRef[] = [
	{ id: "entry-ada", teamId: null },
	{ id: "entry-grace", teamId: null },
];

const teamEntries: readonly BracketEntryRef[] = [
	{ id: "entry-red", teamId: "team-red" },
	{ id: "entry-blue", teamId: "team-blue" },
];

const soloMatch: MatchSides = {
	entryAId: "entry-ada",
	entryBId: "entry-grace",
	teamAId: null,
	teamBId: null,
};

const teamMatch: MatchSides = {
	entryAId: "entry-red",
	entryBId: "entry-blue",
	teamAId: "team-red",
	teamBId: "team-blue",
};

const entryNames = {
	"entry-ada": "Ada",
	"entry-grace": "Grace",
	"entry-red": "Red",
	"entry-blue": "Blue",
};

const teamNames = {
	"team-red": "Red Team",
	"team-blue": "Blue Team",
};

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe("recording a match result", () => {
	it("records a solo result for the competitor chosen by name", () => {
		const select = winnerSelect({
			kind: "solo",
			match: soloMatch,
			teamNames,
			entryNames,
			selectedWinnerEntryId: "entry-grace",
		});
		expect(select.name).toBe("winnerEntryId");
		expect(select.options).toEqual([
			{ value: "entry-ada", label: "Ada", selected: false },
			{ value: "entry-grace", label: "Grace", selected: true },
		]);

		const recorded = matchResultCommand(
			form({
				[select.name]: select.options[1].value,
				scoreA: "2",
				scoreB: "1",
				timeToResolveSeconds: "95",
				notes: "clean run",
			}),
			soloMatch,
		);

		expect(recorded).toEqual({
			ok: true,
			result: {
				winnerEntryId: "entry-grace",
				scoreA: 2,
				scoreB: 1,
				timeToResolveSeconds: 95,
				notes: "clean run",
			},
		});
	});

	it("records the other solo competitor and keeps an empty score blank", () => {
		const recorded = matchResultCommand(
			form({
				winnerEntryId: "entry-ada",
				scoreA: "",
				scoreB: "",
				notes: "",
			}),
			soloMatch,
		);

		expect(recorded).toEqual({
			ok: true,
			result: {
				winnerEntryId: "entry-ada",
				scoreA: null,
				scoreB: null,
				timeToResolveSeconds: null,
				notes: null,
			},
		});
	});

	it("rejects a solo result that only names a team", () => {
		const recorded = matchResultCommand(
			form({ winnerTeamId: "team-red" }),
			soloMatch,
		);
		expect(recorded).toEqual({
			ok: false,
			status: 400,
			message: "winner is not a participant in this match",
		});
	});

	it("rejects a solo winner who is not in the match", () => {
		const recorded = matchResultCommand(
			form({ winnerEntryId: "entry-red" }),
			soloMatch,
		);
		expect(recorded.ok).toBe(false);
		if (recorded.ok) return;
		expect(recorded.status).toBe(400);
		expect(recorded.message).toBe(
			"winner is not a participant in this match",
		);
	});

	it("rejects a result with no winner", () => {
		const recorded = matchResultCommand(form({ notes: "unfinished" }), soloMatch);
		expect(recorded).toEqual({
			ok: false,
			status: 400,
			message: "winner required",
		});
	});

	it("records a team result for the team chosen in the winner picker", () => {
		const select = winnerSelect({
			kind: "team",
			match: teamMatch,
			teamNames,
			entryNames,
			selectedWinnerTeamId: "team-red",
		});
		expect(select.name).toBe("winnerTeamId");
		expect(select.options).toEqual([
			{ value: "team-red", label: "Red Team", selected: true },
			{ value: "team-blue", label: "Blue Team", selected: false },
		]);

		const recorded = matchResultCommand(
			form({
				[select.name]: select.options[0].value,
				scoreA: "1",
				scoreB: "0",
				timeToResolveSeconds: "40",
			}),
			teamMatch,
		);

		expect(recorded).toEqual({
			ok: true,
			result: {
				winnerEntryId: "entry-red",
				scoreA: 1,
				scoreB: 0,
				timeToResolveSeconds: 40,
				notes: null,
			},
		});
	});

	it("records the other team and a live-end form that only sends the winner", () => {
		const recorded = matchResultCommand(
			form({ winnerTeamId: "team-blue", notes: "fixed" }),
			teamMatch,
		);
		expect(recorded).toEqual({
			ok: true,
			result: {
				winnerEntryId: "entry-blue",
				scoreA: null,
				scoreB: null,
				timeToResolveSeconds: null,
				notes: "fixed",
			},
		});
	});

	it("rejects a team that is not playing", () => {
		const recorded = matchResultCommand(
			form({ winnerTeamId: "team-green" }),
			teamMatch,
		);
		expect(recorded).toEqual({
			ok: false,
			status: 400,
			message: "winner is not a participant in this match",
		});
	});

	it("rejects a team side that has no entry yet", () => {
		const recorded = matchResultCommand(
			form({ winnerTeamId: "team-red" }),
			{ ...teamMatch, entryAId: null },
		);
		expect(recorded.ok).toBe(false);
	});

	it("shows the saved solo winner by name and the saved team winner by team", () => {
		expect(
			recordedWinnerName({
				winnerTeamId: null,
				winnerEntryId: "entry-grace",
				teamNames,
				entryNames,
			}),
		).toBe("Grace");
		expect(
			recordedWinnerName({
				winnerTeamId: "team-blue",
				winnerEntryId: "entry-blue",
				teamNames,
				entryNames,
			}),
		).toBe("Blue Team");
	});
});

describe("editing a match", () => {
	const scheduledAt = "2026-11-01T18:30";

	it("keeps both solo entries when the admin form only changes the scheduled time", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				teamAId: "",
				teamBId: "",
				scheduledAt,
				status: "scheduled",
				judgeUserId: "judge-1",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command).toEqual({
			judgeUserId: "judge-1",
			scheduledAt: new Date(scheduledAt).getTime(),
			status: "scheduled",
		});
		expect(edited.command).not.toHaveProperty("entryAId");
		expect(edited.command).not.toHaveProperty("entryBId");
	});

	it("changes solo entries when the form sends entry ids", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				teamAId: "",
				teamBId: "",
				entryAId: "entry-grace",
				entryBId: "entry-ada",
				scheduledAt,
				status: "scheduled",
				judgeUserId: "",
			}),
		});

		expect(edited).toEqual({
			ok: true,
			command: {
				entryAId: "entry-grace",
				entryBId: "entry-ada",
				judgeUserId: null,
				scheduledAt: new Date(scheduledAt).getTime(),
				status: "scheduled",
			},
		});
	});

	it("leaves a solo entry unchanged when the form omits it", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				entryAId: "entry-grace",
				scheduledAt: "",
				status: "live",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command.entryAId).toBe("entry-grace");
		expect(edited.command).not.toHaveProperty("entryBId");
		expect(edited.command.scheduledAt).toBeNull();
		expect(edited.command.status).toBe("live");
	});

	it("clears only the solo slot the form sends as empty", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				entryAId: "",
				status: "scheduled",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command.entryAId).toBeNull();
		expect(edited.command).not.toHaveProperty("entryBId");
	});

	it("refuses a solo entry that is not in the bracket", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				entryAId: "entry-red",
				entryBId: "entry-ada",
				status: "scheduled",
			}),
		});

		expect(edited).toEqual({
			ok: false,
			status: 400,
			message: "entry is not in this bracket",
		});
	});

	it("keeps team entries when the admin form resubmits the same teams and a new time", () => {
		const edited = matchEditCommand({
			kind: "team",
			entries: teamEntries,
			form: form({
				teamAId: "team-red",
				teamBId: "team-blue",
				scheduledAt,
				status: "scheduled",
				judgeUserId: "judge-2",
			}),
		});

		expect(edited).toEqual({
			ok: true,
			command: {
				entryAId: "entry-red",
				entryBId: "entry-blue",
				judgeUserId: "judge-2",
				scheduledAt: new Date(scheduledAt).getTime(),
				status: "scheduled",
			},
		});
	});

	it("swaps team entries and clears a side set back to TBD", () => {
		const edited = matchEditCommand({
			kind: "team",
			entries: teamEntries,
			form: form({
				teamAId: "team-blue",
				teamBId: "",
				status: "scheduled",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command.entryAId).toBe("entry-blue");
		expect(edited.command.entryBId).toBeNull();
	});

	it("leaves a team slot unchanged when the form omits it", () => {
		const edited = matchEditCommand({
			kind: "team",
			entries: teamEntries,
			form: form({
				teamBId: "team-blue",
				status: "cancelled",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command).not.toHaveProperty("entryAId");
		expect(edited.command.entryBId).toBe("entry-blue");
		expect(edited.command.status).toBe("cancelled");
	});

	it("ignores entry ids on a team bracket and uses the selected teams", () => {
		const edited = matchEditCommand({
			kind: "team",
			entries: teamEntries,
			form: form({
				teamAId: "team-red",
				teamBId: "team-blue",
				entryAId: "entry-blue",
				entryBId: "entry-red",
				status: "scheduled",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command.entryAId).toBe("entry-red");
		expect(edited.command.entryBId).toBe("entry-blue");
	});

	it("clears a team slot when that team has no bracket entry", () => {
		const edited = matchEditCommand({
			kind: "team",
			entries: teamEntries,
			form: form({
				teamAId: "team-green",
				status: "scheduled",
			}),
		});

		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.command.entryAId).toBeNull();
	});

	it("rejects an invalid status before changing entries", () => {
		const edited = matchEditCommand({
			kind: "solo",
			entries: soloEntries,
			form: form({
				entryAId: "entry-ada",
				status: "postponed",
			}),
		});
		expect(edited).toEqual({
			ok: false,
			status: 400,
			message: "invalid status",
		});
	});
});
