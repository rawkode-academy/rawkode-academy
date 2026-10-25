// Entry shapes for the live content collections. They mirror what the old
// build-time collections (src/content.config.ts) produced after zod parsing,
// so call sites keep reading the same `entry.data.<field>` names: dates are
// Date objects, relations are `{ collection, id }` references, and optional
// frontmatter stays optional (undefined, never null).
import type { DocNode } from "@rawkodeacademy/rich-text";

export const COLLECTIONS = [
	"videos",
	"shows",
	"people",
	"technologies",
	"articles",
	"news",
	"changelog",
	"adrs",
	"testimonials",
	"courses",
	"courseModules",
	"learningPaths",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export interface Reference<C extends CollectionName = CollectionName> {
	collection: C;
	id: string;
}

/** ImageMetadata-compatible remote image (was `image()` in content.config). */
export interface RemoteImage {
	src: string;
	width: number;
	height: number;
	format: string;
}

export interface Cover {
	image: RemoteImage;
	alt: string;
}

export interface EmbedConfig {
	container: "webcontainer" | "iframe";
	src: string;
	height: string;
	width: string;
	files?: Record<string, string> | undefined;
	/** `localDir` is now a demo id under src/webcontainer-demos (`<course>/<demo>`). */
	import?: { localDir: string } | undefined;
	startCommand?: string | undefined;
}

export interface Resource {
	id?: string | undefined;
	title: string;
	description?: string | undefined;
	type: "url" | "file" | "embed";
	url?: string | undefined;
	filePath?: string | undefined;
	embedConfig?: EmbedConfig | undefined;
	category: "slides" | "code" | "documentation" | "demos" | "other";
}

export interface VideoData {
	id: string;
	slug: string;
	title: string;
	tagline?: string | undefined;
	subtitle?: string | undefined;
	/** Markdown (rendered with marked before; prefer `descriptionDoc`). */
	description: string;
	descriptionDoc?: DocNode | undefined;
	whatYouWillLearn: string[];
	terms?: string[] | undefined;
	publishedAt: Date;
	duration?: number | undefined;
	audioFileSize?: number | undefined;
	type?: "live" | "recorded" | undefined;
	realtimeKit?:
		| {
				streamId?: string | undefined;
				meetingId?: string | undefined;
				livestreamName?: string | undefined;
				roomName?: string | undefined;
		  }
		| undefined;
	youtubeId?: string | undefined;
	category?:
		| "editorial"
		| "tutorial"
		| "review"
		| "interview"
		| "announcement"
		| undefined;
	/** Ids no longer carry "/index"; see the migration guide. */
	technologies: Reference<"technologies">[];
	show?: Reference<"shows"> | undefined;
	/** Episode code within the show (new; was not in content). */
	episodeCode?: string | undefined;
	chapters: { startTime: number; title: string }[];
	guests: Reference<"people">[];
	resources?: Resource[] | undefined;
	streamUrl?: string | undefined;
	thumbnailUrl?: string | undefined;
	/** Row change time from the API (not an editorial date). */
	recordUpdatedAt?: Date | undefined;
}

export type ShowStatus = "coming-soon" | "active" | "archived";

export interface ShowData {
	id: string;
	name: string;
	status: ShowStatus;
	tagline?: string | undefined;
	gameFormatUrl?: string | undefined;
	/** Markdown; prefer `descriptionDoc` for rendering. */
	description?: string | undefined;
	descriptionDoc?: DocNode | undefined;
	terms?: string[] | undefined;
	hosts: Reference<"people">[];
	publish: boolean;
	cover?: Cover | undefined;
	podcast?:
		| {
				guid?: string | undefined;
				email: string;
				category: string;
				subcategory?: string | undefined;
				explicit: boolean;
				copyright?: string | undefined;
				artworkUrl?: string | undefined;
		  }
		| undefined;
	subscribeLinks: {
		platform: string;
		url: string;
		icon:
			| "apple-podcasts"
			| "spotify"
			| "youtube"
			| "pocket-casts"
			| "amazon-music"
			| "overcast"
			| "rss"
			| "other";
	}[];
	recordUpdatedAt?: Date | undefined;
}

export interface PersonData {
	id: string;
	name: string;
	terms?: string[] | undefined;
	/** Full profile URLs, as the old zod transform produced. */
	github?: string | undefined;
	twitter?: string | undefined;
	bluesky?: string | undefined;
	mastodon?: string | undefined;
	linkedin?: string | undefined;
	website?: string | undefined;
	youtube?: string | undefined;
	forename?: string | undefined;
	surname?: string | undefined;
	links: { url: string; name: string }[];
	avatarUrl?: string | undefined;
	handles: {
		github?: string | undefined;
		twitter?: string | undefined;
		bluesky?: string | undefined;
		linkedin?: string | undefined;
	};
	/** Biography document (was the MDX body). */
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface TechnologyData {
	name: string;
	seo?:
		| { title?: string | undefined; description?: string | undefined }
		| undefined;
	logos?:
		| {
				icon?: boolean | undefined;
				horizontal?: boolean | undefined;
				stacked?: boolean | undefined;
		  }
		| undefined;
	website: string;
	source?: string | undefined;
	documentation?: string | undefined;
	license: string;
	category?: string | undefined;
	subcategory?: string | undefined;
	aliases?: string[] | undefined;
	relatedTechnologies?: string[] | undefined;
	terms?: string[] | undefined;
	cncf?:
		| {
				status?: string | undefined;
				accepted?: string | undefined;
				incubating?: string | undefined;
				graduated?: string | undefined;
				archived?: string | undefined;
				devStatsUrl?: string | undefined;
				annualReviewUrl?: string | undefined;
				personas?: string[] | undefined;
				tags?: string[] | undefined;
				useCase?: string | undefined;
				businessUseCase?: string | undefined;
				releaseRate?: string | undefined;
				integrations?: string[] | undefined;
		  }
		| undefined;
	community?:
		| {
				twitter?: string | undefined;
				youtube?: string | undefined;
				slack?: string | undefined;
				discord?: string | undefined;
				chat?: string | undefined;
				blog?: string | undefined;
				mailingList?: string | undefined;
				githubDiscussions?: string | undefined;
		  }
		| undefined;
	useCases?: string[] | undefined;
	features?: string[] | undefined;
	learningResources?:
		| {
				official?: string[] | undefined;
				community?: string[] | undefined;
				tutorials?: string[] | undefined;
		  }
		| undefined;
	status: string;
	matrix?:
		| {
				grouping?: string | undefined;
				status: string;
				confidence?: string | undefined;
				trajectory?: string | undefined;
				firstUsed?: string | undefined;
				lastUsed?: string | undefined;
				makesMeFeel?: string | undefined;
				why?: string | undefined;
				spicyTake?: string | undefined;
		  }
		| undefined;
	/** Logo URLs from the API (content.rawkode.academy), when the flag is set. */
	icon?: string | undefined;
	horizontalLogo?: string | undefined;
	stackedLogo?: string | undefined;
	/** Profile body. Only loaded by getEntry(); list entries leave it unset. */
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface ArticleData {
	title: string;
	publishedAt: Date;
	/** Editorial "last revised" date (API `revisedAt`), as before. */
	updatedAt?: Date | undefined;
	subtitle?: string | undefined;
	description: string;
	authors: Reference<"people">[];
	categories: string[];
	tags: string[];
	cover?: Cover | undefined;
	type: "tutorial" | "article" | "guide" | "news";
	howto: boolean;
	draft: boolean;
	/** Plain technology ids (not references), as before. */
	technologies: string[];
	openGraph?: { title: string; subtitle?: string | undefined } | undefined;
	updates?: { date: Date; description: string }[] | undefined;
	resources?: Resource[] | undefined;
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface NewsData {
	title: string;
	description: string;
	publishedAt: Date;
	authors: Reference<"people">[];
	technologies: string[];
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface ChangelogData {
	title: string;
	date: Date;
	type: "feature" | "fix" | "improvement" | "breaking";
	/** Plain text of the description document (was a Markdown string). */
	description: string;
	descriptionDoc?: DocNode | undefined;
	pullRequest?: number | undefined;
	author: Reference<"people">;
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface AdrData {
	title: string;
	adoptedAt: Date;
	authors: Reference<"people">[];
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface TestimonialData {
	quote: string;
	author: {
		name: string;
		title: string;
		image: string;
		link?: string | undefined;
	};
	type: "maintainer" | "partner" | "viewer";
	recordUpdatedAt?: Date | undefined;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface CourseData {
	title: string;
	description: string;
	cover?: Cover | undefined;
	publishedAt: Date;
	/** No content sets an editorial updatedAt; the row time is recordUpdatedAt. */
	updatedAt?: Date | undefined;
	authors: Reference<"people">[];
	difficulty: Difficulty;
	learningPath: string[];
	technologies: Reference<"technologies">[];
	resources?: Resource[] | undefined;
	signupConfig?:
		| {
				audienceId: string;
				sponsor?: string | undefined;
				sponsorAudienceId?: string | undefined;
				allowSponsorContact: boolean;
		  }
		| undefined;
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface CourseModuleData {
	title: string;
	description: string;
	course: Reference<"courses">;
	/** The module's slug within its course (entry id is `<course>/<slug>`). */
	slug: string;
	section?: string | undefined;
	order: number;
	video?:
		| {
				id: string;
				thumbnailUrl?: string | undefined;
				youtube?: string | undefined;
				rawkode?: string | undefined;
				poster?: string | undefined;
		  }
		| undefined;
	duration?: number | undefined;
	cover?: Cover | undefined;
	publishedAt: Date;
	updatedAt?: Date | undefined;
	draft: boolean;
	difficulty?: Difficulty | undefined;
	authors: Reference<"people">[];
	resources?: Resource[] | undefined;
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface LearningPathData {
	title: string;
	description: string;
	difficulty: Difficulty;
	estimatedDuration: number;
	prerequisites: string[];
	/** Plain technology ids, as before. */
	technologies: string[];
	publishedAt: Date;
	authors: Reference<"people">[];
	body?: DocNode | undefined;
	recordUpdatedAt?: Date | undefined;
}

export interface CollectionDataMap {
	videos: VideoData;
	shows: ShowData;
	people: PersonData;
	technologies: TechnologyData;
	articles: ArticleData;
	news: NewsData;
	changelog: ChangelogData;
	adrs: AdrData;
	testimonials: TestimonialData;
	courses: CourseData;
	courseModules: CourseModuleData;
	learningPaths: LearningPathData;
}

export interface CacheHint {
	tags?: string[];
	lastModified?: Date;
}

/** What the live loaders return and what the wrappers hand to call sites. */
export interface ContentEntry<C extends CollectionName = CollectionName> {
	id: string;
	collection: C;
	data: CollectionDataMap[C];
	/**
	 * Plain text of the entry's main document (bodies, biographies, technology
	 * profiles), for reading time and word counts. Technology listings skip the
	 * profile body to stay small, so it is "" there; getEntry() loads it.
	 */
	body: string;
	rendered?: { html: string };
	cacheHint?: CacheHint;
}

export type AnyEntry = {
	[C in CollectionName]: ContentEntry<C>;
}[CollectionName];
