// People come from the Rawkode Academy people service, read through the
// federation gateway at request time.
import { env } from "cloudflare:workers";

export const DEFAULT_GRAPHQL_ENDPOINT = "https://api.rawkode.academy/";

/** Upper bound for one gateway request, so a hung gateway fails fast. */
const GATEWAY_TIMEOUT_MS = 8_000;

/** How long a fetched copy is reused within one isolate. */
const MEMO_TTL_MS = 5 * 60_000;

export interface PersonData {
	name: string;
	/** GitHub handle (not a URL). */
	github?: string;
	/** Twitter / X handle (not a URL). */
	twitter?: string;
	website?: string;
}

export interface Person {
	id: string;
	data: PersonData;
}

interface RawPerson {
	id: string;
	name?: string | null;
	githubHandle?: string | null;
	twitterHandle?: string | null;
	websiteUrl?: string | null;
}

interface GraphQLResponse<T> {
	data?: T | null;
	errors?: { message: string }[];
}

interface Fetcher {
	fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

interface GatewayEnv {
	API?: Fetcher;
	GRAPHQL_ENDPOINT?: string;
}

const PERSON_FIELDS = `
	id
	name
	githubHandle
	twitterHandle
	websiteUrl
`;

const ALL_PEOPLE_QUERY = `query KlusteredPeople { allPeople { ${PERSON_FIELDS} } }`;
const PERSON_QUERY = `query KlusteredPerson($id: String!) { personById(id: $id) { ${PERSON_FIELDS} } }`;

function str(value: string | null | undefined): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function mapPerson(raw: RawPerson): Person {
	const data: PersonData = { name: str(raw.name) ?? raw.id };
	const github = str(raw.githubHandle);
	const twitter = str(raw.twitterHandle);
	const website = str(raw.websiteUrl);
	if (github) data.github = github;
	if (twitter) data.twitter = twitter;
	if (website) data.website = website;
	return { id: raw.id, data };
}

/**
 * Prefer the API service binding; when it is absent or has no worker behind
 * it (astro dev / preview), fetch the public endpoint instead.
 */
async function send(
	gateway: GatewayEnv,
	endpoint: string,
	init: RequestInit,
): Promise<Response> {
	if (gateway.API) {
		try {
			const response = await gateway.API.fetch(new Request(endpoint, init));
			if (response.ok) return response;
		} catch (error) {
			if (init.signal?.aborted) throw error;
		}
	}
	return fetch(endpoint, init);
}

async function queryGateway<T>(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const gateway = env as unknown as GatewayEnv;
	const endpoint = gateway.GRAPHQL_ENDPOINT || DEFAULT_GRAPHQL_ENDPOINT;
	const response = await send(gateway, endpoint, {
		method: "POST",
		signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
		headers: {
			"content-type": "application/json",
			accept: "application/graphql-response+json, application/json",
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) {
		throw new Error(`Gateway responded ${response.status}`);
	}
	const body = (await response.json()) as GraphQLResponse<T>;
	if (body.errors?.length) {
		throw new Error(
			`Gateway errors: ${body.errors.map((e) => e.message).join("; ")}`,
		);
	}
	if (!body.data) throw new Error("Gateway returned no data");
	return body.data;
}

interface Memo<T> {
	value: T;
	at: number;
}

let allPeopleMemo: Memo<Person[]> | undefined;
const personMemo = new Map<string, Memo<Person | undefined>>();

function fresh<T>(memo: Memo<T>): boolean {
	return Date.now() - memo.at < MEMO_TTL_MS;
}

/** Every person, in API order. Falls back to the last good copy on failure. */
export async function getPeople(): Promise<Person[]> {
	if (allPeopleMemo && fresh(allPeopleMemo)) return [...allPeopleMemo.value];
	try {
		const data = await queryGateway<{ allPeople: RawPerson[] | null }>(
			ALL_PEOPLE_QUERY,
		);
		const people = (data.allPeople ?? []).map(mapPerson);
		allPeopleMemo = { value: people, at: Date.now() };
		return [...people];
	} catch (error) {
		if (allPeopleMemo) return [...allPeopleMemo.value];
		throw error;
	}
}

/** One person by id (the slug competitors are registered with). */
export async function getPerson(slug: string): Promise<Person | undefined> {
	const memo = personMemo.get(slug);
	if (memo && fresh(memo)) return memo.value;
	try {
		const data = await queryGateway<{ personById: RawPerson | null }>(
			PERSON_QUERY,
			{ id: slug },
		);
		const person = data.personById ? mapPerson(data.personById) : undefined;
		personMemo.set(slug, { value: person, at: Date.now() });
		return person;
	} catch (error) {
		if (memo) return memo.value;
		throw error;
	}
}
