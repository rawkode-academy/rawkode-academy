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
	startsAt: string;
	registrationClosesAt?: string | null;
	entries: BracketSide[];
	matches: BracketMatch[];
}

export interface BracketSeason {
	id: string;
	slug: string;
	name: string;
	status: string;
	startDate?: string | null;
	endDate?: string | null;
	brackets: Bracket[];
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

type BracketsReadResult<T> = { data?: T; errors?: unknown };

export function requireBracketsReadBinding(env: {
	BRACKETS_READ?: unknown;
}): BracketsReadBinding {
	const readModel = env.BRACKETS_READ;
	if (
		!readModel ||
		(typeof readModel !== "object" && typeof readModel !== "function") ||
		typeof (readModel as { fetch?: unknown }).fetch !== "function"
	) {
		throw new Error("BRACKETS_READ service binding is required");
	}
	return readModel as BracketsReadBinding;
}

async function queryBracketsRead<T>(
	readModel: BracketsReadBinding,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const response = await readModel.fetch("https://internal/", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) {
		throw new Error(`BRACKETS_READ query failed with ${response.status}`);
	}
	const json = (await response.json()) as BracketsReadResult<T>;
	if (json.errors) {
		throw new Error("BRACKETS_READ returned GraphQL errors");
	}
	if (!json.data) {
		throw new Error("BRACKETS_READ returned no data");
	}
	return json.data;
}

const MATCH_FIELDS = `
	id
	roundNumber
	positionInRound
	status
	scheduledAt
	startedAt
	endedAt
	sideA { kind id displayName seed }
	sideB { kind id displayName seed }
	winner { kind id displayName seed }
`;

export async function loadSeasons(
	showId: string,
	readModel: BracketsReadBinding,
): Promise<BracketSeason[]> {
	const data = await queryBracketsRead<{
		seasons?: BracketSeason[];
	}>(
		readModel,
		`query ShowSeasons($showId: String!) {
			seasons(showId: $showId) {
				id slug name status startDate endDate
				brackets {
					id slug name kind format status maxEntries teamSize startsAt registrationClosesAt
					entries { kind id displayName seed }
					matches { ${MATCH_FIELDS} }
				}
			}
		}`,
		{ showId },
	);
	return data.seasons ?? [];
}

export async function loadBrackets(
	showId: string,
	readModel: BracketsReadBinding,
): Promise<Bracket[]> {
	const data = await queryBracketsRead<{ brackets?: Bracket[] }>(
		readModel,
		`query ShowBrackets($showId: String!) {
			brackets(showId: $showId) {
				id slug name kind format status maxEntries teamSize startsAt registrationClosesAt
				entries { kind id displayName seed }
				matches { ${MATCH_FIELDS} }
			}
		}`,
		{ showId },
	);
	return data.brackets ?? [];
}

export async function loadSchedule(
	showId: string,
	readModel: BracketsReadBinding,
): Promise<BracketMatch[]> {
	const data = await queryBracketsRead<{
		schedule?: BracketMatch[];
	}>(
		readModel,
		`query ShowSchedule($showId: String!) {
			schedule(showId: $showId) { ${MATCH_FIELDS} }
		}`,
		{ showId },
	);
	return data.schedule ?? [];
}

export async function loadOpenBrackets(
	showId: string,
	readModel: BracketsReadBinding,
): Promise<Bracket[]> {
	const data = await queryBracketsRead<{
		openBrackets?: Bracket[];
	}>(
		readModel,
		`query ShowOpenBrackets($showId: String!) {
			openBrackets(showId: $showId) {
				id slug name kind format status maxEntries teamSize startsAt registrationClosesAt
				entries { kind id displayName seed }
				matches { ${MATCH_FIELDS} }
			}
		}`,
		{ showId },
	);
	return data.openBrackets ?? [];
}

export async function loadMyParticipation(
	showId: string,
	options: {
		readModel: BracketsReadBinding;
		user?: { id: string } | null;
	},
): Promise<MyParticipation> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (options.user) {
		headers["X-Gateway-User-Id"] = options.user.id;
	}

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
		throw new Error(
			`BRACKETS_READ participation query failed with ${response.status}`,
		);
	}
	const json = (await response.json()) as {
		data?: { myBracketParticipation?: MyParticipation };
		errors?: unknown;
	};
	if (json.errors) {
		throw new Error("BRACKETS_READ returned participation errors");
	}
	if (!json.data?.myBracketParticipation) {
		throw new Error("BRACKETS_READ returned no participation data");
	}
	return json.data.myBracketParticipation;
}

export async function loadLiveMatch(
	showId: string,
	readModel: BracketsReadBinding,
): Promise<BracketMatch | null> {
	const data = await queryBracketsRead<{
		liveMatch?: BracketMatch | null;
	}>(
		readModel,
		`query ShowLiveMatch($showId: String!) {
			liveMatch(showId: $showId) { ${MATCH_FIELDS} }
		}`,
		{ showId },
	);
	return data.liveMatch ?? null;
}
