import { z } from "zod";

// An update is a patch: a section left out is untouched, a section given
// replaces what is stored (lists are replaced whole, in the order given).
const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "ids are letters, digits, dot, dash or underscore");
const https = z.string().url().max(2000).refine((u) => u.startsWith("https://"), "must be https");
const nullableText = (max: number) => z.string().max(max).nullable();

export const resource = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(1000).optional(),
	type: z.enum(["url", "file", "embed"]),
	url: https.optional(),
	filePath: z.string().max(500).optional(),
	category: z.enum(["slides", "code", "documentation", "demos", "other"]),
}).strict();

export const CREDIT_ROLES = ["host", "co_host", "guest", "author"] as const;

export const videoFields = z.object({
	title: z.string().min(1).max(300),
	subtitle: nullableText(500),
	tagline: nullableText(500),
	slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words joined by dashes"),
	// Markdown. The rich-text document is generated from it.
	description: z.string().min(1).max(20000),
	whatYouWillLearn: z.array(z.string().min(1).max(300)).max(20).nullable(),
	publishedAt: z.string().datetime(),
	type: z.enum(["live", "recorded"]).nullable(),
	category: z.enum(["editorial", "tutorial", "review", "interview", "announcement"]).nullable(),
	courseOnly: z.boolean(),
	// Links and downloads shown with the video.
	resources: z.array(resource).max(50).nullable(),
}).partial().strict();

const personFields = z.object({
	id,
	forename: z.string().min(1).max(100).optional(),
	surname: z.string().min(1).max(100).optional(),
	name: z.string().max(200).optional(),
	github: nullableText(100).optional(),
	twitter: nullableText(100).optional(),
	bluesky: nullableText(200).optional(),
	linkedin: nullableText(200).optional(),
	mastodon: nullableText(300).optional(),
	website: nullableText(300).optional(),
	youtube: nullableText(300).optional(),
	links: z.array(z.object({ url: https, name: z.string().min(1).max(100) })).max(20).optional(),
}).strict();

export const updateRequest = z.object({
	videoId: id,
	// Retrying with the same key returns the same update instead of making another.
	requestId: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/).optional(),
	video: videoFields.optional(),
	people: z.array(personFields).max(50).optional(),
	credits: z.array(z.object({ personId: id, role: z.enum(CREDIT_ROLES) })).max(50).optional(),
	technologies: z.array(id).max(50).optional(),
	chapters: z.array(z.object({ seconds: z.number().int().min(0).max(86400), title: z.string().min(1).max(200) })).max(100).optional(),
	show: z.object({ showId: id, code: z.string().min(1).max(100) }).nullable().optional(),
	// The lesson this video plays in, "<course id>/<module slug>"; null removes it from any lesson.
	courseModule: id.or(z.string().regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/)).nullable().optional(),
	collaborations: z.array(z.object({ collaboratorId: id, startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional(), ctaLink: https.nullable().optional() }).strict()).max(20).optional(),
	channels: z.array(z.object({ platform: z.enum(["youtube", "x", "linkedin"]), externalId: z.string().min(1).max(100) }).strict()).max(5).optional(),
}).strict();

export type UpdateRequest = z.infer<typeof updateRequest>;
export type Actor = { userId: string; username?: string };

export const SECTIONS = ["people", "video", "credits", "technologies", "chapters", "show", "courseModule", "collaborations", "channels"] as const;
export type Section = (typeof SECTIONS)[number];
export const touched = (r: UpdateRequest): Section[] => SECTIONS.filter((s) => r[s] !== undefined && (s !== "video" || Object.keys(r.video ?? {}).length > 0));
