import type { StudioEnv } from "../env";

export interface StudioContentPerson {
	avatarUrl: string | null;
	githubHandle: string | null;
	id: string;
	name: string;
}

export interface StudioContentVideo {
	guests: StudioContentPerson[];
	id: string;
	publishedAt: string | null;
	show: {
		hosts: StudioContentPerson[];
		id: string;
		name: string;
	} | null;
	slug: string | null;
	title: string;
}

type GraphQLPerson = {
	avatarUrl?: string | null;
	githubHandle?: string | null;
	id?: string | null;
	name?: string | null;
};

type GraphQLVideo = {
	episode?: {
		show?: GraphQLShow | null;
	} | null;
	guests?: GraphQLPerson[] | null;
	id?: string | null;
	publishedAt?: string | null;
	slug?: string | null;
	title?: string | null;
	type?: string | null;
};

type GraphQLShow = {
	hosts?: GraphQLPerson[] | null;
	id?: string | null;
	name?: string | null;
};

const studioContentVideoQuery = `
	query StudioContentVideo($id: String!) {
		videoByID(id: $id) {
			id
			slug
			title
			publishedAt
			guests {
				id
				name
			}
			episode {
				show {
					id
					name
					hosts {
						id
						name
					}
				}
			}
		}
		episodeByVideoId(videoId: $id) {
			show {
				id
				name
				hosts {
					id
					name
				}
			}
		}
	}
`;

const studioContentEventFields = `
	id
	slug
	title
	publishedAt
	type
	guests {
		id
		name
	}
	episode {
		show {
			id
			name
			hosts {
				id
				name
			}
		}
	}
`;

const studioContentEventsQuery = `
	query StudioContentEvents {
		getAllVideos {
			${studioContentEventFields}
		}
	}
`;

const studioUpcomingContentEventsQuery = `
	query StudioUpcomingContentEvents($limit: Int!) {
		getUpcomingVideos(limit: $limit) {
			${studioContentEventFields}
		}
	}
`;

const studioPersonByGithubQuery = `
	query StudioPersonByGithub($username: String!) {
		personByGithub(username: $username) {
			id
			name
		}
	}
`;

function normalizeVideo(video: GraphQLVideo | null | undefined): StudioContentVideo | null {
	if (!video?.id || !video.title) {
		return null;
	}

	const show = video.episode?.show ?? null;
	return {
		guests: normalizePeople(video.guests ?? []),
		id: video.id,
		publishedAt: video.publishedAt ?? null,
		show: show?.id && show.name
			? {
					hosts: normalizePeople(show.hosts ?? []),
					id: show.id,
					name: show.name,
				}
			: null,
		slug: normalizeSlug(video.slug),
		title: video.title,
	};
}

function sortContentVideos(
	left: StudioContentVideo,
	right: StudioContentVideo,
): number {
	const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : Number.MAX_SAFE_INTEGER;
	const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : Number.MAX_SAFE_INTEGER;
	return leftTime - rightTime || left.title.localeCompare(right.title);
}

function firstGraphQLError(payload: {
	errors?: Array<{ message?: string }>;
}): string | null {
	return payload.errors?.[0]?.message ?? null;
}

function isMissingUpcomingVideosField(message: string | null): boolean {
	return message?.includes('Cannot query field "getUpcomingVideos"') ?? false;
}

async function fetchStudioContentEvents(
	env: StudioEnv,
	input: {
		query: string;
		resultKey: "getAllVideos" | "getUpcomingVideos";
		variables?: Record<string, unknown>;
	},
): Promise<StudioContentVideo[]> {
	const endpoint = env.RAWKODE_GRAPHQL_URL ?? "https://api.rawkode.academy/";
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: input.query,
			variables: input.variables,
		}),
	});
	if (!response.ok) {
		throw new Error(`Rawkode content graph returned ${response.status}`);
	}

	const payload = (await response.json()) as {
		data?: {
			getAllVideos?: GraphQLVideo[] | null;
			getUpcomingVideos?: GraphQLVideo[] | null;
		};
		errors?: Array<{ message?: string }>;
	};
	const graphQLError = firstGraphQLError(payload);
	if (graphQLError) {
		throw new Error(graphQLError);
	}

	return (payload.data?.[input.resultKey] ?? [])
		.map(normalizeVideo)
		.filter((video): video is StudioContentVideo => Boolean(video))
		.sort(sortContentVideos);
}

export async function getStudioContentVideo(
	env: StudioEnv,
	videoId: string,
): Promise<StudioContentVideo | null> {
	const endpoint = env.RAWKODE_GRAPHQL_URL ?? "https://api.rawkode.academy/";
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: studioContentVideoQuery,
			variables: { id: videoId },
		}),
	});
	if (!response.ok) {
		throw new Error(`Rawkode content graph returned ${response.status}`);
	}

	const payload = (await response.json()) as {
		data?: {
			episodeByVideoId?: { show?: GraphQLShow | null } | null;
			videoByID?: GraphQLVideo | null;
		};
		errors?: Array<{ message?: string }>;
	};
	if (payload.errors?.length) {
		throw new Error(payload.errors[0]?.message ?? "Rawkode content graph failed");
	}

	const video = payload.data?.videoByID;
	const normalized = normalizeVideo({
		...video,
		episode: {
			show: video?.episode?.show ?? payload.data?.episodeByVideoId?.show ?? null,
		},
	});
	return normalized;
}

export async function getStudioContentEvents(
	env: StudioEnv,
): Promise<StudioContentVideo[]> {
	return fetchStudioContentEvents(env, {
		query: studioContentEventsQuery,
		resultKey: "getAllVideos",
	});
}

export async function getStudioUpcomingContentEvents(
	env: StudioEnv,
	limit = 25,
): Promise<StudioContentVideo[]> {
	try {
		return await fetchStudioContentEvents(env, {
			query: studioUpcomingContentEventsQuery,
			resultKey: "getUpcomingVideos",
			variables: { limit },
		});
	} catch (error) {
		if (
			error instanceof Error &&
			isMissingUpcomingVideosField(error.message)
		) {
			return getStudioContentEvents(env);
		}
		throw error;
	}
}

export async function getStudioContentPersonByGithub(
	env: StudioEnv,
	username: string,
): Promise<StudioContentPerson | null> {
	const githubHandle = normalizeGithubHandle(username);
	if (!githubHandle) return null;

	const endpoint = env.RAWKODE_GRAPHQL_URL ?? "https://api.rawkode.academy/";
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: studioPersonByGithubQuery,
			variables: { username: githubHandle },
		}),
	});
	if (!response.ok) {
		throw new Error(`Rawkode content graph returned ${response.status}`);
	}

	const payload = (await response.json()) as {
		data?: {
			personByGithub?: GraphQLPerson | null;
		};
		errors?: Array<{ message?: string }>;
	};
	if (payload.errors?.length) {
		throw new Error(payload.errors[0]?.message ?? "Rawkode content graph failed");
	}

	const [person] = normalizePeople(
		payload.data?.personByGithub ? [payload.data.personByGithub] : [],
	);
	return person ?? null;
}

function normalizePeople(people: GraphQLPerson[]): StudioContentPerson[] {
	const seen = new Set<string>();
	const normalized: StudioContentPerson[] = [];
	for (const person of people) {
		const githubHandle = normalizeGithubHandle(person.githubHandle ?? person.id);
		const id = githubHandle ?? person.id?.trim();
		const name = person.name ?? githubHandle ?? person.id;
		if (!id || !name || seen.has(id)) {
			continue;
		}
		seen.add(id);
		normalized.push({
			avatarUrl: person.avatarUrl ?? null,
			githubHandle,
			id,
			name,
		});
	}
	return normalized;
}

function normalizeGithubHandle(value: string | null | undefined): string | null {
	const handle = value?.trim().replace(/^@/, "").toLowerCase();
	return handle || null;
}

function normalizeSlug(value: string | null | undefined): string | null {
	const slug = value?.trim().replace(/^\/+|\/+$/g, "");
	return slug || null;
}
