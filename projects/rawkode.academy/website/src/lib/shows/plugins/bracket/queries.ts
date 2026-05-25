import { queryShowsApi } from "@/lib/shows/client";

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
	teamSize?: number;
	startsAt?: string | null;
	registrationClosesAt?: string | null;
	entries: BracketSide[];
	matches: BracketMatch[];
}

export interface MyTeam {
	id: string;
	name: string;
	slug: string;
	isCaptain: boolean;
	memberCount: number;
}

export interface MyBracketParticipation {
	bracketId: string;
	bracketSlug: string;
	bracketName: string;
	bracketKind: string;
	teamSize: number;
	registrationClosesAt: string | null;
	applied: boolean;
	team: MyTeam | null;
}

export interface MyParticipation {
	brackets: MyBracketParticipation[];
}

export interface BracketsReadBinding {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
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
					id slug name kind format status maxEntries teamSize startsAt registrationClosesAt
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
				openBrackets { id slug name kind maxEntries teamSize registrationClosesAt }
			}
		}`,
		{ id: showId },
	);
	return data?.showById?.openBrackets ?? [];
}

function participationFromBrackets(brackets: Bracket[]): MyParticipation {
	return {
		brackets: brackets.map((bracket) => ({
			bracketId: bracket.id,
			bracketSlug: bracket.slug,
			bracketName: bracket.name,
			bracketKind: bracket.kind,
			teamSize: bracket.teamSize ?? 2,
			registrationClosesAt: bracket.registrationClosesAt ?? null,
			applied: false,
			team: null,
		})),
	};
}

export async function loadMyParticipation(
	showId: string,
	options: {
		readModel?: BracketsReadBinding | null;
		user?: { id: string } | null;
	} = {},
): Promise<MyParticipation> {
	const loadFallback = async () =>
		participationFromBrackets(await loadOpenBrackets(showId));

	if (!options.readModel) {
		return loadFallback();
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (options.user) {
		headers["X-Gateway-User-Id"] = options.user.id;
	}

	try {
		const response = await options.readModel.fetch("https://internal/", {
			method: "POST",
			headers,
			body: JSON.stringify({
				query: `query MyBracketParticipation($showId: String!) {
					myBracketParticipation(showId: $showId) {
						brackets {
							bracketId
							bracketSlug
							bracketName
							bracketKind
							teamSize
							registrationClosesAt
							applied
							team { id name slug isCaptain memberCount }
						}
					}
				}`,
				variables: { showId },
			}),
		});
		if (!response.ok) {
			return loadFallback();
		}
		const json = (await response.json()) as {
			data?: { myBracketParticipation?: MyParticipation };
		};
		return json.data?.myBracketParticipation ?? loadFallback();
	} catch {
		return loadFallback();
	}
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
