import type { Review } from "./types.ts";

export interface IngestInput {
	orgId: string;
	videoId: string;
	title: string;
	videoUrl: string;
	dueAt?: string;
}

const ID = /^[\w-]{1,64}$/;
const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

/** Validates what the encode workflow sends when a draft is ready. */
export const parseIngest = (body: unknown): IngestInput | null => {
	if (typeof body !== "object" || body === null) return null;
	const { orgId, videoId, title, videoUrl, dueAt } = body as Record<string, unknown>;
	if (typeof orgId !== "string" || !ID.test(orgId)) return null;
	if (typeof videoId !== "string" || !ID.test(videoId)) return null;
	if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) return null;
	if (typeof videoUrl !== "string" || videoUrl.length > 2048) return null;
	try {
		if (new URL(videoUrl).protocol !== "https:") return null;
	} catch {
		return null;
	}
	if (dueAt !== undefined && (typeof dueAt !== "string" || Number.isNaN(Date.parse(dueAt)))) return null;
	return { orgId, videoId, title: title.trim(), videoUrl, dueAt };
};

/** A new draft opens a review; a re-upload of the same video bumps the cut and reopens it. */
export const applyIngest = (existing: Review | null, input: IngestInput, now: Date): Review => {
	if (existing) {
		const { partnerApprovedBy: _by, partnerApprovedAt: _at, scheduledFor: _sched, ...rest } = existing;
		return {
			...rest,
			title: input.title,
			videoUrl: input.videoUrl,
			draftVersion: existing.draftVersion + 1,
			state: "in_review",
			dueAt: input.dueAt ?? existing.dueAt,
		};
	}
	return {
		id: `${input.orgId}-${input.videoId}`,
		orgId: input.orgId,
		videoId: input.videoId,
		title: input.title,
		videoUrl: input.videoUrl,
		state: "in_review",
		draftVersion: 1,
		dueAt: input.dueAt ?? new Date(now.getTime() + WEEK_MS).toISOString(),
	};
};

/** Constant-time bearer token check. */
export const tokenMatches = (header: string | null, secret: string | undefined): boolean => {
	if (!secret || !header?.startsWith("Bearer ")) return false;
	const given = new TextEncoder().encode(header.slice(7));
	const want = new TextEncoder().encode(secret);
	let diff = given.length ^ want.length;
	for (let i = 0; i < want.length; i++) diff |= (given[i] ?? 0) ^ want[i];
	return diff === 0;
};
