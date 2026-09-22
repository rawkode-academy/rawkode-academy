import type { Bracket, BracketSide } from "./queries";

// Deliberately local specimens, not live entrants or service responses.
const sides: BracketSide[] = [
	{ id: "fixture-a", displayName: "Fixture Control Plane", seed: 1 },
	{ id: "fixture-b", displayName: "Fixture Packet Patrol", seed: 4 },
	{ id: "fixture-c", displayName: "Fixture Reconcile Crew", seed: 2 },
	{ id: "fixture-d", displayName: "Fixture Debug Squad", seed: 3 },
];
const [sideA, sideB, sideC, sideD] = sides;

export const twoRoundBracket: Bracket = {
	id: "fixture-bracket",
	slug: "fixture-bracket",
	name: "Local fixture tournament",
	kind: "team",
	format: "single_elimination",
	status: "live",
	maxEntries: 4,
	teamSize: 2,
	startsAt: "2026-09-20T14:00:00Z",
	entries: sides,
	matches: [
		{
			id: "fixture-final",
			roundNumber: 2,
			positionInRound: 1,
			status: "scheduled",
			sideA: sideA!,
			sideB: null,
		},
		{
			id: "fixture-match-b",
			roundNumber: 1,
			positionInRound: 2,
			status: "live",
			sideA: sideC!,
			sideB: sideD!,
		},
		{
			id: "fixture-match-a",
			roundNumber: 1,
			positionInRound: 1,
			status: "completed",
			sideA: sideA!,
			sideB: sideB!,
			winner: sideA!,
		},
	],
};

const longA = {
	id: "fixture-long-a",
	displayName:
		"Fixture team with a deliberately long name that must remain completely readable on a narrow screen",
	seed: 1234,
};
const longB = {
	id: "fixture-long-b",
	displayName:
		"FixtureUnbrokenParticipantIdentifierThatMustWrapWithoutEscapingTheRoundOrBeingTruncated",
	seed: 0,
};
export const longNamesBracket: Bracket = {
	...twoRoundBracket,
	id: "fixture-long",
	slug: "fixture-long",
	name: "Local fixture: a tournament title long enough to wrap across several lines on a mobile viewport",
	entries: [longA, longB],
	matches: [
		{
			id: "fixture-long-match",
			roundNumber: 1,
			positionInRound: 1,
			status: "completed",
			sideA: longA,
			sideB: longB,
			winner: longB,
		},
		{
			id: "fixture-long-final",
			roundNumber: 2,
			positionInRound: 1,
			status: "scheduled",
			sideA: longB,
			sideB: null,
		},
	],
};
