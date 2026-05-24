import { queryShowsApi } from "@/lib/shows/client";

// Shapes mirror the brackets subgraph fields federated onto `Show`.

export interface BracketSide {
	kind?: string;
	id?: string;
	displayName: string;
	seed?: number | null;
}

export interface BracketMatch {
	id: string;
	roundNumber: number;
	positionInRound: number;
	status: string;
	scheduledAt?: string | null;
	startedAt?: string | null;
	endedAt?: string | null;
	sideA?: BracketSide | null;
	sideB?: BracketSide | null;
	winner?: BracketSide | null;
	scenarioTitle?: string | null;
}

export interface Bracket {
	id: string;
	slug: string;
	name: string;
	kind: string;
	format: string;
	status: string;
	maxEntries: number;
	startsAt?: string | null;
	registrationClosesAt?: string | null;
	entries: BracketSide[];
	matches: BracketMatch[];
}

export interface Standing {
	id: string;
	displayName: string;
	wins: number;
	losses: number;
}

const MATCH_FIELDS = `
	id
	roundNumber
	positionInRound
	status
	scheduledAt
	startedAt
	endedAt
	scenarioTitle
	sideA { kind id displayName seed }
	sideB { kind id displayName seed }
	winner { kind id displayName seed }
`;

export async function loadBrackets(showId: string): Promise<Bracket[]> {
	const data = await queryShowsApi<{ showById?: { brackets?: Bracket[] } }>(
		`query ShowBrackets($id: String!) {
			showById(id: $id) {
				brackets {
					id slug name kind format status maxEntries startsAt registrationClosesAt
					entries { kind id displayName seed }
					matches { ${MATCH_FIELDS} }
				}
			}
		}`,
		{ id: showId },
	);
	return data?.showById?.brackets ?? [];
}

export async function loadSchedule(showId: string): Promise<BracketMatch[]> {
	const data = await queryShowsApi<{
		showById?: { schedule?: BracketMatch[] };
	}>(
		`query ShowSchedule($id: String!) {
			showById(id: $id) { schedule { ${MATCH_FIELDS} } }
		}`,
		{ id: showId },
	);
	return data?.showById?.schedule ?? [];
}

export async function loadLeaderboard(showId: string): Promise<Standing[]> {
	const data = await queryShowsApi<{ showById?: { leaderboard?: Standing[] } }>(
		`query ShowLeaderboard($id: String!) {
			showById(id: $id) { leaderboard { id displayName wins losses } }
		}`,
		{ id: showId },
	);
	return data?.showById?.leaderboard ?? [];
}

export async function loadOpenBrackets(showId: string): Promise<Bracket[]> {
	const data = await queryShowsApi<{ showById?: { openBrackets?: Bracket[] } }>(
		`query ShowOpenBrackets($id: String!) {
			showById(id: $id) {
				openBrackets { id slug name kind maxEntries registrationClosesAt }
			}
		}`,
		{ id: showId },
	);
	return data?.showById?.openBrackets ?? [];
}

export async function loadLiveMatch(
	showId: string,
): Promise<BracketMatch | null> {
	const data = await queryShowsApi<{
		showById?: { liveMatch?: BracketMatch | null };
	}>(
		`query ShowLiveMatch($id: String!) {
			showById(id: $id) { liveMatch { ${MATCH_FIELDS} } }
		}`,
		{ id: showId },
	);
	return data?.showById?.liveMatch ?? null;
}
