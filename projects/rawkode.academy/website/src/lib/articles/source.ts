// Turns an article file (content/articles/<slug>.mdx) into the ArticleData the
// site renders: YAML frontmatter is validated, the Markdown/MDX body becomes a
// rich-text document. Runs at build time only (see ./loader.ts); nothing here
// reaches the Worker bundle.
import type { DocNode } from "@rawkodeacademy/rich-text";
import {
	fromMarkdown,
	type ResolvedAsset,
} from "@rawkodeacademy/rich-text/markdown";
import { z } from "astro/zod";
import { load as parseYaml } from "js-yaml";
import type { ArticleData, Resource } from "../live-content/types";

export interface ArticleFile {
	/** The public slug (/read/<id>). */
	id: string;
	/** Path shown in error messages. */
	file: string;
	/** .mdx files may use the site's components; .md files are plain Markdown. */
	mdx: boolean;
	raw: string;
}

/**
 * Maps a path relative to the article file (./cover.png) to its public URL
 * and, when known, its intrinsic size.
 */
export type ArticleAssetResolver = (path: string) => ResolvedAsset;

export class ArticleError extends Error {
	constructor(
		readonly file: string,
		message: string,
	) {
		super(`${file}: ${message}`);
		this.name = "ArticleError";
	}
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ABSOLUTE_URL = /^(?:https?:)?\/\//i;

const resource = z.strictObject({
	id: z.string().optional(),
	title: z.string().min(1),
	description: z.string().optional(),
	type: z.enum(["url", "file", "embed"]),
	url: z.string().optional(),
	filePath: z.string().optional(),
	embedConfig: z
		.strictObject({
			container: z.enum(["webcontainer", "iframe"]),
			src: z.string(),
			height: z.string().default("600px"),
			width: z.string().default("100%"),
			files: z.record(z.string(), z.string()).optional(),
			import: z.strictObject({ localDir: z.string() }).optional(),
			startCommand: z.string().optional(),
		})
		.optional(),
	category: z
		.enum(["slides", "code", "documentation", "demos", "other"])
		.default("other"),
});

// Unknown keys are errors, so a misspelt field never goes unnoticed.
const articleFrontmatter = z.strictObject({
	title: z.string().trim().min(1),
	subtitle: z.string().trim().min(1).optional(),
	description: z.string().trim().min(1),
	type: z.enum(["tutorial", "article", "guide", "news"]).default("tutorial"),
	howto: z.boolean().default(false),
	draft: z.boolean().default(false),
	publishedAt: z.coerce.date(),
	updatedAt: z.coerce.date().optional(),
	// People ids (/people/<id>), in byline order.
	authors: z.array(z.string().trim().min(1)).min(1),
	// Technology ids (/technology/<id>).
	technologies: z.array(z.string().trim().min(1)).default([]),
	categories: z.array(z.string()).default([]),
	tags: z.array(z.string()).default([]),
	cover: z
		.strictObject({
			// A path relative to the article file, or an absolute URL (which
			// needs width and height).
			image: z.string().min(1),
			alt: z.string(),
			width: z.number().int().positive().optional(),
			height: z.number().int().positive().optional(),
		})
		.optional(),
	openGraph: z
		.strictObject({
			title: z.string().min(1),
			subtitle: z.string().optional(),
		})
		.optional(),
	updates: z
		.array(z.strictObject({ date: z.coerce.date(), description: z.string() }))
		.default([]),
	resources: z.array(resource).default([]),
});

type ArticleFrontmatter = z.infer<typeof articleFrontmatter>;

function compact<T extends object>(value: T): T {
	for (const key of Object.keys(value) as (keyof T)[]) {
		if (value[key] === undefined) delete value[key];
	}
	return value;
}

function imageFormat(src: string): string {
	const ext = src.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
	return ext === "jpeg" ? "jpg" : ext || "png";
}

function splitFrontmatter(article: ArticleFile): {
	frontmatter: ArticleFrontmatter;
	body: string;
} {
	const match = article.raw.match(FRONTMATTER);
	if (!match) {
		throw new ArticleError(
			article.file,
			"missing frontmatter (the file must start with a --- block)",
		);
	}
	let data: unknown;
	try {
		data = parseYaml(match[1] ?? "") ?? {};
	} catch (error) {
		throw new ArticleError(
			article.file,
			`invalid frontmatter YAML: ${(error as Error).message}`,
		);
	}
	const parsed = articleFrontmatter.safeParse(data);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map(
				(issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`,
			)
			.join("; ");
		throw new ArticleError(article.file, `invalid frontmatter (${issues})`);
	}
	return {
		frontmatter: parsed.data,
		body: article.raw.slice(match[0].length),
	};
}

function coverFrom(
	article: ArticleFile,
	cover: ArticleFrontmatter["cover"],
	resolveAsset: ArticleAssetResolver,
): ArticleData["cover"] {
	if (!cover) return undefined;
	let src = cover.image;
	let { width, height } = cover;
	if (!ABSOLUTE_URL.test(src)) {
		const asset = resolveAsset(src);
		src = asset.src;
		width ??= asset.width ?? undefined;
		height ??= asset.height ?? undefined;
	}
	if (!width || !height) {
		throw new ArticleError(
			article.file,
			"cover.width and cover.height are required for a remote cover image",
		);
	}
	return {
		image: { src, width, height, format: imageFormat(src) },
		alt: cover.alt,
	};
}

/** Parse and validate one article file. Throws ArticleError (or RichTextError). */
export function parseArticle(
	article: ArticleFile,
	resolveAsset: ArticleAssetResolver,
): ArticleData {
	const { frontmatter, body } = splitFrontmatter(article);
	const doc: DocNode = fromMarkdown(body, {
		mdx: article.mdx,
		file: article.file,
		assetResolver: (path) => resolveAsset(path),
	});
	const latestUpdate = frontmatter.updates.reduce<Date | undefined>(
		(latest, update) =>
			!latest || update.date > latest ? update.date : latest,
		undefined,
	);
	return compact<ArticleData>({
		title: frontmatter.title,
		publishedAt: frontmatter.publishedAt,
		updatedAt: frontmatter.updatedAt ?? latestUpdate,
		subtitle: frontmatter.subtitle,
		description: frontmatter.description,
		authors: frontmatter.authors.map((id) => ({ collection: "people", id })),
		categories: frontmatter.categories,
		tags: frontmatter.tags,
		cover: coverFrom(article, frontmatter.cover, resolveAsset),
		type: frontmatter.type,
		howto: frontmatter.howto,
		draft: frontmatter.draft,
		technologies: frontmatter.technologies,
		openGraph: frontmatter.openGraph
			? compact({ ...frontmatter.openGraph })
			: undefined,
		updates: frontmatter.updates.length > 0 ? frontmatter.updates : undefined,
		resources:
			frontmatter.resources.length > 0
				? frontmatter.resources.map(
						(entry) => compact({ ...entry }) as Resource,
					)
				: undefined,
		body: doc,
	});
}
