/** A GitHub login: 1 to 39 alphanumerics, with single hyphens between them. */
const LOGIN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

export const ORG_ROLES = [
	"owner",
	"admin",
	"moderator",
	"contributor",
	"member",
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const normaliseGithubLogin = (input: string): string | null => {
	const login = input.trim().replace(/^@/, "");
	return login.length > 0 && login.length <= 39 && LOGIN.test(login)
		? login
		: null;
};

export const isOrgRole = (value: unknown): value is OrgRole =>
	typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);

export interface GithubProfile {
	id: string;
	login: string;
}

/** Looks a login up on GitHub. The id is what we store: logins are renamed. */
export const lookupGithubProfile = async (
	login: string,
	fetcher: typeof fetch = fetch,
): Promise<GithubProfile | null> => {
	const response = await fetcher(`https://api.github.com/users/${login}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": "rawkode-academy-identity",
		},
	});
	if (response.status === 404) return null;
	if (!response.ok) {
		throw new Error(`GitHub profile lookup failed: ${response.status}`);
	}
	const body = (await response.json()) as { id?: unknown; login?: unknown };
	if (typeof body.id !== "number" || typeof body.login !== "string") {
		throw new Error("GitHub profile is missing an id or login");
	}
	return { id: String(body.id), login: body.login };
};
