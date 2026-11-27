import type { Env, Org, OrgLink } from "./types.ts";

export interface Named {
	id: string;
	name: string;
}

/** A video made with a collaborator. */
export interface Collaboration {
	videoId: string;
	title: string;
	slug: string;
	collaboratorId: string;
	/** ISO dates; null leaves that side open. */
	startsAt: string | null;
	endsAt: string | null;
}

/** The company records the portal reads. Read-only: the portal never writes them. */
export interface Directory {
	collaborators(): Promise<Named[]>;
	supporters(): Promise<Named[]>;
	collaborationsFor(collaboratorId: string): Promise<Collaboration[]>;
	/** Collaborators whose record already names an identity organisation. */
	collaboratorOrgLinks(): Promise<OrgLink[]>;
}

/** Links set in the portal win over the ones the company records carry. */
export const mergeLinks = (manual: readonly OrgLink[], derived: readonly OrgLink[]): OrgLink[] => {
	const manualIds = new Set(manual.map((link) => link.orgId));
	return [...manual, ...derived.filter((link) => !manualIds.has(link.orgId))];
};

const iso = (seconds: number | null): string | null =>
	seconds === null || seconds === undefined ? null : new Date(seconds * 1000).toISOString();

/** Builds the organisations the portal knows from their links and the company records. */
export const deriveOrgs = (
	links: readonly OrgLink[],
	collaborators: readonly Named[],
	supporters: readonly Named[],
): Org[] =>
	links.flatMap((link) => {
		const collaborator = link.collaboratorId
			? collaborators.find((item) => item.id === link.collaboratorId)
			: undefined;
		const supporter = link.supporterId
			? supporters.find((item) => item.id === link.supporterId)
			: undefined;
		if (!collaborator && !supporter) return [];
		return [
			{
				id: link.orgId,
				name: (collaborator ?? supporter)!.name,
				kind: collaborator && supporter ? ("both" as const) : collaborator ? ("partner" as const) : ("supporter" as const),
			},
		];
	});

export class D1Directory implements Directory {
	constructor(private readonly env: Env) {}

	async collaborators() {
		if (!this.env.COLLABORATIONS_DB) return [];
		const { results } = await this.env.COLLABORATIONS_DB.prepare(
			"SELECT id, name FROM collaborators ORDER BY name",
		).all<Named>();
		return results;
	}

	async collaboratorOrgLinks() {
		if (!this.env.COLLABORATIONS_DB) return [];
		const { results } = await this.env.COLLABORATIONS_DB.prepare(
			"SELECT id, organization_id FROM collaborators WHERE organization_id IS NOT NULL",
		).all<{ id: string; organization_id: string }>();
		return results.map((row) => ({ orgId: row.organization_id, collaboratorId: row.id }));
	}

	async supporters() {
		if (!this.env.SUPPORTERS_DB) return [];
		const { results } = await this.env.SUPPORTERS_DB.prepare(
			"SELECT id, name FROM supporters WHERE ended_at IS NULL ORDER BY name",
		).all<Named>();
		return results;
	}

	async collaborationsFor(collaboratorId: string) {
		const { COLLABORATIONS_DB, VIDEOS_DB } = this.env;
		if (!COLLABORATIONS_DB || !VIDEOS_DB) return [];
		const { results: links } = await COLLABORATIONS_DB.prepare(
			"SELECT video_id, starts_at, ends_at FROM video_collaborations WHERE collaborator_id = ? LIMIT 200",
		)
			.bind(collaboratorId)
			.all<{ video_id: string; starts_at: number | null; ends_at: number | null }>();
		if (links.length === 0) return [];
		const marks = links.map(() => "?").join(",");
		const { results: videos } = await VIDEOS_DB.prepare(
			`SELECT id, title, slug FROM videos WHERE id IN (${marks})`,
		)
			.bind(...links.map((link) => link.video_id))
			.all<{ id: string; title: string; slug: string }>();
		const byId = new Map(videos.map((video) => [video.id, video]));
		return links.flatMap((link) => {
			const video = byId.get(link.video_id);
			return video
				? [
						{
							videoId: video.id,
							title: video.title,
							slug: video.slug,
							collaboratorId,
							startsAt: iso(link.starts_at),
							endsAt: iso(link.ends_at),
						},
					]
				: [];
		});
	}
}
