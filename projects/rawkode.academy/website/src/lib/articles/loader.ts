// Build-time loader for the articles collection: every Markdown/MDX file in
// the repository's content/articles directory becomes an entry whose data is
// the ArticleData the pages already render (see ./source.ts).
//
//   content/articles/<slug>.mdx            → /read/<slug>
//   content/articles/<slug>/index.mdx      → /read/<slug>  (with images beside it)
//
// Images referenced by a relative path are copied to public/_content/articles
// (generated, not committed) and served from /_content/articles/...
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedAsset } from "@rawkodeacademy/rich-text/markdown";
import type { Loader, LoaderContext } from "astro/loaders";
import { ArticleError, type ArticleFile, parseArticle } from "./source";

export interface ArticlesLoaderOptions {
	/**
	 * Keep drafts and articles dated in the future (astro dev). A production
	 * build leaves them out, so they have no page, listing, feed or sitemap
	 * entry until a deploy after their publication date.
	 */
	includeUnpublished: boolean;
}

const ASSET_URL_BASE = "/_content/articles";
const ARTICLE_FILE = /\.mdx?$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

function walk(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else if (ARTICLE_FILE.test(entry.name)) files.push(path);
	}
	return files.sort();
}

export function articleId(root: string, path: string): string {
	return relative(root, path)
		.split(sep)
		.join("/")
		.replace(ARTICLE_FILE, "")
		.replace(/\/index$/, "");
}

async function imageSize(
	path: string,
): Promise<{ width?: number; height?: number }> {
	try {
		const { default: sharp } = await import("sharp");
		const { width, height } = await sharp(path).metadata();
		return { ...(width ? { width } : {}), ...(height ? { height } : {}) };
	} catch {
		return {};
	}
}

export interface LoadedArticle {
	id: string;
	file: string;
	raw: string;
	data: ReturnType<typeof parseArticle>;
}

/**
 * Read every article under `root`, copying the local images they reference
 * into `assetsDir`. Throws on the first invalid article.
 */
export async function loadArticleFiles(
	root: string,
	assetsDir: string,
	display: (path: string) => string = (path) => path,
): Promise<LoadedArticle[]> {
	rmSync(assetsDir, { recursive: true, force: true });
	const seen = new Map<string, string>();
	const articles: LoadedArticle[] = [];
	for (const path of walk(root)) {
		const file = display(path);
		const id = articleId(root, path);
		if (!SLUG.test(id)) {
			throw new ArticleError(
				file,
				`"${id}" is not a valid slug (lowercase letters, digits and hyphens, in content/articles/<slug>.mdx or content/articles/<slug>/index.mdx)`,
			);
		}
		const duplicate = seen.get(id);
		if (duplicate) {
			throw new ArticleError(file, `duplicates the slug of ${duplicate}`);
		}
		seen.set(id, file);

		const article: ArticleFile = {
			id,
			file,
			mdx: path.endsWith(".mdx"),
			raw: readFileSync(path, "utf8"),
		};

		// The resolver is synchronous, reading image sizes is not: collect
		// the paths first, then parse again with the resolved assets.
		const referenced = new Set<string>();
		parseArticle(article, (assetPath) => {
			referenced.add(assetPath);
			return { src: assetPath, width: 1, height: 1 };
		});
		const assets = new Map<string, ResolvedAsset>();
		for (const assetPath of referenced) {
			const source = resolve(dirname(path), assetPath);
			const inside = relative(root, source);
			if (inside.startsWith("..")) {
				throw new ArticleError(
					file,
					`${assetPath} is outside content/articles`,
				);
			}
			const target = join(assetsDir, inside);
			try {
				mkdirSync(dirname(target), { recursive: true });
				copyFileSync(source, target);
			} catch {
				throw new ArticleError(file, `${assetPath} does not exist`);
			}
			assets.set(assetPath, {
				src: `${ASSET_URL_BASE}/${inside.split(sep).join("/")}`,
				...(await imageSize(source)),
			});
		}
		articles.push({
			id,
			file,
			raw: article.raw,
			data: parseArticle(article, (assetPath) => {
				const asset = assets.get(assetPath);
				if (!asset) throw new ArticleError(file, `${assetPath} not resolved`);
				return asset;
			}),
		});
	}
	return articles;
}

export function articlesLoader(options: ArticlesLoaderOptions): Loader {
	return {
		name: "rawkode-academy-articles",
		async load({
			store,
			config,
			logger,
			watcher,
			generateDigest,
		}: LoaderContext) {
			const repository = fileURLToPath(new URL("../../../", config.root));
			const root = join(repository, "content", "articles");
			const assetsDir = join(
				fileURLToPath(config.publicDir),
				...ASSET_URL_BASE.split("/").filter(Boolean),
			);

			const sync = async () => {
				const articles = await loadArticleFiles(root, assetsDir, (path) =>
					relative(repository, path),
				);
				const now = Date.now();
				store.clear();
				for (const article of articles) {
					const { draft, publishedAt } = article.data;
					if (!options.includeUnpublished) {
						if (draft) {
							logger.info(`${article.file}: draft, not published`);
							continue;
						}
						if (publishedAt.getTime() > now) {
							logger.info(
								`${article.file}: dated ${publishedAt.toISOString()}, published by the first deploy after that`,
							);
							continue;
						}
					}
					store.set({
						id: article.id,
						data: article.data as unknown as Record<string, unknown>,
						filePath: article.file,
						digest: generateDigest(article.raw),
					});
				}
				logger.info(`Loaded ${store.keys().length} articles`);
			};

			await sync();

			if (watcher) {
				watcher.add(root);
				const reload = (path: string) => {
					if (!path.startsWith(root)) return;
					sync().catch((error) => logger.error(String(error)));
				};
				watcher.on("add", reload);
				watcher.on("change", reload);
				watcher.on("unlink", reload);
			}
		},
	};
}
