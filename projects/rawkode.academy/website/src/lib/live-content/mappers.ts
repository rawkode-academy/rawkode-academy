// Gateway payloads → entry data shaped like the old content.config.ts output.
// GraphQL nulls become undefined, dates become Date objects, relations become
// `{ collection, id }` references, and the old zod defaults are re-applied.
import { type DocNode, isEmptyDoc, toText } from "@rawkodeacademy/rich-text";
import type {
	AdrData,
	ArticleData,
	ChangelogData,
	CollectionDataMap,
	CollectionName,
	ContentEntry,
	CourseData,
	CourseModuleData,
	Cover,
	Difficulty,
	EmbedConfig,
	LearningPathData,
	NewsData,
	PersonData,
	Reference,
	Resource,
	ShowData,
	TechnologyData,
	TestimonialData,
	VideoData,
} from "./types";

// biome-ignore lint/suspicious/noExplicitAny: raw gateway JSON
type Raw = Record<string, any>;

const str = (value: unknown): string | undefined =>
	typeof value === "string" && value.length > 0 ? value : undefined;
const num = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;
const positive = (value: unknown): number | undefined => {
	const n = num(value);
	return n !== undefined && n > 0 ? n : undefined;
};
const bool = (value: unknown, fallback: boolean): boolean =>
	typeof value === "boolean" ? value : fallback;
const strings = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((v): v is string => typeof v === "string" && v.length > 0)
		: [];
const optionalStrings = (value: unknown): string[] | undefined =>
	Array.isArray(value) ? strings(value) : undefined;

export function toDate(value: unknown): Date | undefined {
	if (value === null || value === undefined || value === "") return undefined;
	const date = new Date(value as string | number);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Required dates: an invalid value stays an Invalid Date, as z.coerce did. */
const requiredDate = (value: unknown): Date =>
	toDate(value) ?? new Date(Number.NaN);

export function doc(value: unknown): DocNode | undefined {
	if (
		value &&
		typeof value === "object" &&
		(value as { type?: unknown }).type === "doc" &&
		Array.isArray((value as { content?: unknown }).content)
	) {
		return value as DocNode;
	}
	return undefined;
}

// Code is left out (blocks and inline code): reading time and word counts used
// to strip it from the Markdown body, so including it inflated "N min read".
export function docText(value: DocNode | undefined): string {
	if (!value || isEmptyDoc(value)) return "";
	return toText(withoutInlineCode(value) as DocNode, { code: false });
}

function withoutInlineCode(node: unknown): unknown {
	if (!node || typeof node !== "object") return node;
	const n = node as { content?: unknown[] };
	if (!Array.isArray(n.content)) return node;
	return {
		...n,
		content: n.content
			.filter(
				(child) =>
					!(child as { marks?: { type: string }[] }).marks?.some(
						(mark) => mark.type === "code",
					),
			)
			.map(withoutInlineCode),
	};
}

/** Technology ids never carry the old glob-loader "/index" suffix. */
export function normalizeTechnologyId(id: string): string {
	return id.replace(/\/index$/, "");
}

function ref<C extends CollectionName>(
	collection: C,
	value: unknown,
): Reference<C> | undefined {
	const id =
		typeof value === "string"
			? value
			: value && typeof value === "object"
				? str((value as Raw).id)
				: undefined;
	if (!id) return undefined;
	return {
		collection,
		id: collection === "technologies" ? normalizeTechnologyId(id) : id,
	};
}

function refs<C extends CollectionName>(
	collection: C,
	value: unknown,
): Reference<C>[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((v) => ref(collection, v))
		.filter((r): r is Reference<C> => Boolean(r));
}

/** Authors default to ["rawkode"] like the old schemas. */
function authors(value: unknown): Reference<"people">[] {
	const list = refs("people", value);
	return list.length > 0 ? list : [{ collection: "people", id: "rawkode" }];
}

function guessFormat(url: string): string {
	const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
	return ext === "jpeg" ? "jpg" : ext || "png";
}

function cover(
	url: unknown,
	alt: unknown,
	width: unknown,
	height: unknown,
): Cover | undefined {
	const src = str(url);
	if (!src) return undefined;
	return {
		image: {
			src,
			// Remote images need dimensions; 16:9 matches the site's cards.
			width: num(width) ?? 1280,
			height: num(height) ?? 720,
			format: guessFormat(src),
		},
		alt: str(alt) ?? "",
	};
}

const coverFrom = (raw: Raw | null | undefined) =>
	raw ? cover(raw.url, raw.alt, raw.width, raw.height) : undefined;

function embedConfig(raw: unknown): EmbedConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const e = raw as Raw;
	const src = str(e.src);
	const container = e.container === "iframe" ? "iframe" : "webcontainer";
	if (!src) return undefined;
	const localDir = str(e.importLocalDir) ?? str(e.import?.localDir);
	return {
		container,
		src,
		height: str(e.height) ?? "600px",
		width: str(e.width) ?? "100%",
		...(e.files && typeof e.files === "object" ? { files: e.files } : {}),
		...(localDir ? { import: { localDir } } : {}),
		...(str(e.startCommand) ? { startCommand: str(e.startCommand) } : {}),
	};
}

const RESOURCE_CATEGORIES = new Set([
	"slides",
	"code",
	"documentation",
	"demos",
	"other",
]);

function resources(value: unknown): Resource[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value
		.filter((r): r is Raw => Boolean(r) && typeof r === "object")
		.map((r) => {
			const resource: Resource = {
				title: str(r.title) ?? "",
				type: r.type === "file" || r.type === "embed" ? r.type : "url",
				category: RESOURCE_CATEGORIES.has(r.category) ? r.category : "other",
			};
			if (str(r.id)) resource.id = str(r.id);
			if (str(r.description)) resource.description = str(r.description);
			if (str(r.url)) resource.url = str(r.url);
			if (str(r.filePath)) resource.filePath = str(r.filePath);
			const embed = embedConfig(r.embedConfig);
			if (embed) resource.embedConfig = embed;
			return resource;
		});
}

const difficulty = (value: unknown): Difficulty =>
	value === "intermediate" || value === "advanced" ? value : "beginner";

function compact<T extends object>(value: T): T {
	for (const key of Object.keys(value) as (keyof T)[]) {
		if (value[key] === undefined) delete value[key];
	}
	return value;
}

function compactObject<T extends object>(raw: unknown): T | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const out: Raw = {};
	for (const [key, value] of Object.entries(raw as Raw)) {
		if (value === null || value === undefined) continue;
		if (Array.isArray(value)) out[key] = strings(value);
		else out[key] = value;
	}
	return Object.keys(out).length > 0 ? (out as T) : undefined;
}

export function mapVideo(raw: Raw): VideoData {
	const type =
		raw.type === "live" || raw.type === "recorded" ? raw.type : undefined;
	const rtk = compactObject<NonNullable<VideoData["realtimeKit"]>>(
		raw.realtimeKit,
	);
	return compact<VideoData>({
		id: raw.id,
		slug: str(raw.slug) ?? raw.id,
		// The old videos schema trimmed these (YAML ">" scalars end in "\n").
		title: str(raw.title)?.trim() ?? "",
		tagline: str(raw.tagline?.trim?.()),
		subtitle: str(raw.subtitle),
		description:
			typeof raw.description === "string" ? raw.description.trim() : "",
		descriptionDoc: doc(raw.descriptionDoc),
		whatYouWillLearn: strings(raw.whatYouWillLearn).map((s) => s.trim()),
		terms: optionalStrings(raw.terms),
		publishedAt: requiredDate(raw.publishedAt),
		duration: positive(raw.duration),
		audioFileSize: positive(raw.audioFileSize),
		type,
		realtimeKit: rtk,
		youtubeId: str(raw.youtubeId),
		category: str(raw.category) as VideoData["category"],
		technologies: refs("technologies", raw.technologies),
		show: ref("shows", raw.episode?.show),
		episodeCode: str(raw.episode?.code),
		chapters: Array.isArray(raw.chapters)
			? raw.chapters
					.filter((c: Raw) => c && typeof c.title === "string")
					.map((c: Raw) => ({
						startTime: Math.max(0, num(c.startTime) ?? 0),
						title: c.title as string,
					}))
					.sort(
						(a: { startTime: number }, b: { startTime: number }) =>
							a.startTime - b.startTime,
					)
			: [],
		guests: refs("people", raw.guests),
		resources: resources(raw.resources),
		streamUrl: str(raw.streamUrl),
		thumbnailUrl: str(raw.thumbnailUrl),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

const SHOW_ICONS = new Set([
	"apple-podcasts",
	"spotify",
	"youtube",
	"pocket-casts",
	"amazon-music",
	"overcast",
	"rss",
	"other",
]);

export function mapShowStatus(value: unknown): ShowData["status"] {
	// GraphQL enum values cannot contain "-", so the API says coming_soon.
	if (value === "coming_soon" || value === "coming-soon") return "coming-soon";
	if (value === "archived") return "archived";
	return "active";
}

export function mapShow(raw: Raw): ShowData {
	const podcast = raw.podcast as Raw | null | undefined;
	return compact<ShowData>({
		id: raw.id,
		name: str(raw.name) ?? raw.id,
		status: mapShowStatus(raw.status),
		tagline: str(raw.tagline),
		gameFormatUrl: str(raw.gameFormatUrl),
		description: str(raw.description),
		descriptionDoc: doc(raw.descriptionDoc),
		terms: optionalStrings(raw.terms),
		hosts: refs("people", raw.hosts),
		publish: bool(raw.published, false),
		cover: cover(raw.coverUrl, raw.coverAlt, raw.coverWidth, raw.coverHeight),
		podcast:
			podcast && str(podcast.email)
				? compact({
						guid: str(podcast.guid),
						email: podcast.email as string,
						category: str(podcast.category) ?? "",
						subcategory: str(podcast.subcategory),
						explicit: bool(podcast.explicit, false),
						copyright: str(podcast.copyright),
						artworkUrl: str(podcast.artworkUrl),
					})
				: undefined,
		subscribeLinks: Array.isArray(raw.subscribeLinks)
			? raw.subscribeLinks
					.filter((l: Raw) => l && str(l.url))
					.map((l: Raw) => ({
						platform: str(l.platform) ?? "",
						url: l.url as string,
						icon: SHOW_ICONS.has(l.icon) ? l.icon : "other",
					}))
			: [],
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapPerson(raw: Raw): PersonData {
	const github = str(raw.githubHandle);
	return compact<PersonData>({
		id: raw.id,
		name: str(raw.name) ?? raw.id,
		terms: optionalStrings(raw.terms),
		github:
			str(raw.githubUrl) ??
			(github ? `https://github.com/${github}` : undefined),
		twitter:
			str(raw.twitterUrl) ??
			(str(raw.twitterHandle)
				? `https://x.com/${raw.twitterHandle}`
				: undefined),
		bluesky:
			str(raw.blueskyUrl) ??
			(str(raw.blueskyHandle)
				? `https://bsky.app/profile/${raw.blueskyHandle}`
				: undefined),
		mastodon: str(raw.mastodonUrl),
		linkedin:
			str(raw.linkedinUrl) ??
			(str(raw.linkedinHandle)
				? `https://www.linkedin.com/in/${raw.linkedinHandle}`
				: undefined),
		website: str(raw.websiteUrl),
		youtube: str(raw.youtubeUrl),
		forename: str(raw.forename),
		surname: str(raw.surname),
		links: Array.isArray(raw.links)
			? raw.links
					.filter((l: Raw) => l && str(l.url))
					.map((l: Raw) => ({
						url: l.url as string,
						name: str(l.name) ?? l.url,
					}))
			: [],
		avatarUrl:
			str(raw.avatarUrl) ??
			(github ? `https://avatars.githubusercontent.com/${github}` : undefined),
		handles: compact({
			github,
			twitter: str(raw.twitterHandle),
			bluesky: str(raw.blueskyHandle),
			linkedin: str(raw.linkedinHandle),
		}),
		body: doc(raw.biographyDoc),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapTechnology(raw: Raw): TechnologyData {
	const logos = raw.logos as Raw | null | undefined;
	const matrix = compactObject<NonNullable<TechnologyData["matrix"]>>(
		raw.matrix,
	);
	return compact<TechnologyData>({
		name: str(raw.name) ?? raw.id,
		seo: compactObject(raw.seo),
		logos: logos
			? compact({
					icon: logos.icon ? true : undefined,
					horizontal: logos.horizontal ? true : undefined,
					stacked: logos.stacked ? true : undefined,
				})
			: undefined,
		website: str(raw.website) ?? "",
		source: str(raw.source),
		documentation: str(raw.documentation),
		license: str(raw.license) ?? "Unknown",
		category: str(raw.category),
		subcategory: str(raw.subcategory),
		aliases: optionalStrings(raw.aliases),
		relatedTechnologies: optionalStrings(raw.relatedTechnologies)?.map(
			normalizeTechnologyId,
		),
		terms: optionalStrings(raw.terms),
		cncf: compactObject(raw.cncf),
		community: compactObject(raw.community),
		useCases: optionalStrings(raw.useCases),
		features: optionalStrings(raw.features),
		learningResources: compactObject(raw.learningResources),
		status: str(raw.status) ?? "stable",
		matrix: matrix?.status ? matrix : undefined,
		icon: logos?.icon ? str(raw.icon) : undefined,
		horizontalLogo: logos?.horizontal ? str(raw.horizontalLogo) : undefined,
		stackedLogo: logos?.stacked ? str(raw.stackedLogo) : undefined,
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

const ARTICLE_TYPES = new Set(["tutorial", "article", "guide", "news"]);

export function mapArticle(raw: Raw): ArticleData {
	const updates = Array.isArray(raw.updates)
		? raw.updates
				.filter((u: Raw) => u && toDate(u.date))
				.map((u: Raw) => ({
					date: toDate(u.date) as Date,
					description: str(u.description) ?? "",
				}))
		: undefined;
	// revisedAt already falls back to the latest update; repeat it so a
	// missing resolver value keeps the old transform's behaviour.
	const latestUpdate = updates?.reduce<Date | undefined>(
		(acc, u) => (!acc || u.date > acc ? u.date : acc),
		undefined,
	);
	const og = raw.openGraph as Raw | null | undefined;
	return compact<ArticleData>({
		title: str(raw.title) ?? "",
		publishedAt: requiredDate(raw.publishedAt),
		updatedAt: toDate(raw.revisedAt) ?? latestUpdate,
		subtitle: str(raw.subtitle),
		description: str(raw.description) ?? "",
		authors: authors(raw.authors),
		categories: strings(raw.categories),
		tags: strings(raw.tags),
		cover: coverFrom(raw.cover),
		type: ARTICLE_TYPES.has(raw.type) ? raw.type : "tutorial",
		howto: bool(raw.howto, false),
		draft: bool(raw.draft, false),
		technologies: refs("technologies", raw.technologies).map((r) => r.id),
		openGraph:
			og && str(og.title)
				? compact({ title: og.title as string, subtitle: str(og.subtitle) })
				: undefined,
		updates: updates && updates.length > 0 ? updates : undefined,
		resources: resources(raw.resources),
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapNews(raw: Raw): NewsData {
	return compact<NewsData>({
		title: str(raw.title) ?? "",
		description: str(raw.description) ?? "",
		publishedAt: requiredDate(raw.publishedAt),
		authors: authors(raw.authors),
		technologies: refs("technologies", raw.technologies).map((r) => r.id),
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

const CHANGELOG_TYPES = new Set(["feature", "fix", "improvement", "breaking"]);

export function mapChangelog(raw: Raw): ChangelogData {
	const descriptionDoc = doc(raw.description);
	return compact<ChangelogData>({
		title: str(raw.title) ?? "",
		date: requiredDate(raw.date),
		type: CHANGELOG_TYPES.has(raw.type) ? raw.type : "improvement",
		description:
			typeof raw.description === "string"
				? raw.description
				: docText(descriptionDoc),
		descriptionDoc,
		pullRequest: num(raw.pullRequest),
		author: ref("people", raw.author) ?? {
			collection: "people",
			id: "rawkode",
		},
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapAdr(raw: Raw): AdrData {
	return compact<AdrData>({
		title: str(raw.title) ?? "",
		adoptedAt: requiredDate(raw.adoptedAt),
		authors: authors(raw.authors),
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapTestimonial(raw: Raw): TestimonialData {
	const author = (raw.author ?? {}) as Raw;
	return compact<TestimonialData>({
		quote: typeof raw.quote === "string" ? raw.quote : "",
		author: compact({
			name: str(author.name) ?? "",
			title: str(author.title) ?? "",
			image: str(author.image) ?? "",
			link: str(author.link),
		}),
		type:
			raw.type === "maintainer" || raw.type === "partner" ? raw.type : "viewer",
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapCourse(raw: Raw): CourseData {
	const signup = raw.signupConfig as Raw | null | undefined;
	return compact<CourseData>({
		title: str(raw.title) ?? "",
		description: str(raw.description) ?? "",
		cover: coverFrom(raw.cover),
		publishedAt: requiredDate(raw.publishedAt),
		// The API's updatedAt is the row change time, not an editorial date.
		updatedAt: undefined,
		authors: authors(raw.authors),
		difficulty: difficulty(raw.difficulty),
		learningPath: strings(raw.learningPath),
		technologies: refs("technologies", raw.technologies),
		resources: resources(raw.resources),
		signupConfig:
			signup && str(signup.audienceId)
				? compact({
						audienceId: signup.audienceId as string,
						sponsor: str(signup.sponsor),
						sponsorAudienceId: str(signup.sponsorAudienceId),
						allowSponsorContact: bool(signup.allowSponsorContact, false),
					})
				: undefined,
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function courseModuleId(courseId: string, slug: string): string {
	return `${courseId}/${slug}`;
}

export function mapCourseModule(raw: Raw, courseId?: string): CourseModuleData {
	const course = str(raw.courseId) ?? courseId ?? "";
	const id = str(raw.id) ?? "";
	const slug = str(raw.slug) ?? id.split("/").pop() ?? id;
	const video = raw.video as Raw | null | undefined;
	return compact<CourseModuleData>({
		title: str(raw.title) ?? "",
		description: str(raw.description) ?? "",
		course: { collection: "courses", id: course },
		slug,
		section: str(raw.section),
		order: num(raw.order) ?? 0,
		video:
			video && str(video.id)
				? compact({
						id: video.id as string,
						thumbnailUrl: str(video.thumbnailUrl),
						youtube: str(video.youtube),
						rawkode: str(video.rawkode),
						poster: str(video.poster),
					})
				: undefined,
		duration: num(raw.duration),
		cover: coverFrom(raw.cover),
		publishedAt: requiredDate(raw.publishedAt),
		updatedAt: undefined,
		// The old schema defaulted modules to draft.
		draft: bool(raw.draft, true),
		difficulty: raw.difficulty ? difficulty(raw.difficulty) : undefined,
		authors: authors(raw.authors),
		resources: resources(raw.resources),
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

export function mapLearningPath(raw: Raw): LearningPathData {
	return compact<LearningPathData>({
		title: str(raw.title) ?? "",
		description: str(raw.description) ?? "",
		difficulty: difficulty(raw.difficulty),
		estimatedDuration: num(raw.estimatedDuration) ?? 0,
		prerequisites: strings(raw.prerequisites),
		technologies: refs("technologies", raw.technologies).map((r) => r.id),
		publishedAt: requiredDate(raw.publishedAt),
		authors: authors(raw.authors),
		body: doc(raw.body),
		recordUpdatedAt: toDate(raw.updatedAt),
	});
}

/** The document whose text becomes `entry.body`. */
export function mainDocument<C extends CollectionName>(
	collection: C,
	data: CollectionDataMap[C],
): DocNode | undefined {
	if (collection === "videos" || collection === "shows") {
		return (data as VideoData | ShowData).descriptionDoc;
	}
	if (collection === "testimonials") return undefined;
	return (data as { body?: DocNode }).body;
}

/** Date that controls scheduled publication, per collection. */
export function publicationDate<C extends CollectionName>(
	collection: C,
	data: CollectionDataMap[C],
): Date | undefined {
	switch (collection) {
		case "changelog":
			return (data as ChangelogData).date;
		case "adrs":
			return (data as AdrData).adoptedAt;
		case "videos":
		case "articles":
		case "news":
		case "courses":
		case "courseModules":
		case "learningPaths":
			return (data as { publishedAt: Date }).publishedAt;
		default:
			return undefined;
	}
}

/** Entity tags of the references an entry displays (names, avatars, logos). */
export function relatedTags<C extends CollectionName>(
	collection: C,
	data: CollectionDataMap[C],
): string[] {
	const tags: string[] = [];
	const add = (r: Reference | undefined) => {
		if (r) tags.push(`${r.collection}:${r.id}`);
	};
	if (collection === "videos") {
		const v = data as VideoData;
		v.guests.forEach(add);
		v.technologies.forEach(add);
		add(v.show);
	} else if (collection === "shows") {
		(data as ShowData).hosts.forEach(add);
	} else if (collection === "courses") {
		const c = data as CourseData;
		c.authors.forEach(add);
		c.technologies.forEach(add);
	} else if (collection === "courseModules") {
		const m = data as CourseModuleData;
		m.authors.forEach(add);
		add(m.course);
	} else if (collection === "changelog") {
		add((data as ChangelogData).author);
	} else {
		const d = data as { authors?: Reference[]; technologies?: unknown[] };
		d.authors?.forEach(add);
		for (const t of d.technologies ?? []) {
			if (typeof t === "string") tags.push(`technologies:${t}`);
		}
	}
	return [...new Set(tags)];
}

export function entryTags<C extends CollectionName>(
	collection: C,
	id: string,
	data: CollectionDataMap[C],
): string[] {
	return [collection, `${collection}:${id}`, ...relatedTags(collection, data)];
}

export function lastModified<C extends CollectionName>(
	collection: C,
	data: CollectionDataMap[C],
	now: number,
): Date | undefined {
	const candidates: Date[] = [];
	const record = (data as { recordUpdatedAt?: Date }).recordUpdatedAt;
	if (record) candidates.push(record);
	const published = publicationDate(collection, data);
	if (published && published.getTime() <= now) candidates.push(published);
	const revised = (data as { updatedAt?: Date }).updatedAt;
	if (revised instanceof Date && revised.getTime() <= now)
		candidates.push(revised);
	const valid = candidates.filter((d) => !Number.isNaN(d.getTime()));
	if (valid.length === 0) return undefined;
	return new Date(Math.max(...valid.map((d) => d.getTime())));
}

export function toEntry<C extends CollectionName>(
	collection: C,
	id: string,
	data: CollectionDataMap[C],
	now: number,
): ContentEntry<C> {
	const modified = lastModified(collection, data, now);
	return {
		id,
		collection,
		data,
		body: docText(mainDocument(collection, data)),
		cacheHint: {
			tags: entryTags(collection, id, data),
			...(modified ? { lastModified: modified } : {}),
		},
	};
}
