// Build-time loaders for the articles and series collections: every
// Markdown/MDX file in the repository's content/articles (or content/series)
// directory becomes an entry whose data is what the pages render (see
// ./source.ts).
//
//   content/articles/<slug>.mdx            → /read/<slug>
//   content/articles/<slug>/index.mdx      → /read/<slug>  (with images beside it)
//   content/series/<id>.md                 → /series/<id>
//
// Images referenced by a relative path are copied to public/_content/<dir>
// (generated, not committed) and served from /_content/<dir>/...
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedAsset } from "@rawkodeacademy/rich-text/markdown";
import type { Loader, LoaderContext } from "astro/loaders";
import type { ArticleData, SeriesData } from "../live-content/types";
import {
	type ArticleAssetResolver,
	ArticleError,
	type ArticleFile,
	checkSeries,
	parseArticle,
	parseSeries,
} from "./source";

export interface ArticlesLoaderOptions {
	/**
	 * Keep drafts and articles dated in the future (astro dev). A production
	 * build leaves them out, so they have no page, listing, feed or sitemap
	 * entry until a deploy after their publication date.
	 */
	includeUnpublished: boolean;
}

type ContentDirectory = "articles" | "series";

const ARTICLE_FILE = /\.mdx?$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
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

interface LoadedFile<T> {
	id: string;
	file: string;
	raw: string;
	data: T;
}

/**
 * Read every file under `root`, copying the local images they reference
 * into `assetsDir` (served from /_content/<directory>). Throws on the first
 * invalid file.
 */
async function loadContentFiles<T>(
	directory: ContentDirectory,
	root: string,
	assetsDir: string,
	parse: (file: ArticleFile, resolveAsset: ArticleAssetResolver) => T,
	display: (path: string) => string,
): Promise<LoadedFile<T>[]> {
	const urlBase = `/_content/${directory}`;
	rmSync(assetsDir, { recursive: true, force: true });
	const seen = new Map<string, string>();
	const loaded: LoadedFile<T>[] = [];
	for (const path of walk(root)) {
		const file = display(path);
		const id = articleId(root, path);
		if (!SLUG.test(id)) {
			throw new ArticleError(
				file,
				`"${id}" is not a valid slug (lowercase letters, digits and hyphens, in content/${directory}/<slug>.mdx or content/${directory}/<slug>/index.mdx)`,
			);
		}
		const duplicate = seen.get(id);
		if (duplicate) {
			throw new ArticleError(file, `duplicates the slug of ${duplicate}`);
		}
		seen.set(id, file);

		const source: ArticleFile = {
			id,
			file,
			mdx: path.endsWith(".mdx"),
			raw: readFileSync(path, "utf8"),
		};

		// The resolver is synchronous, reading image sizes is not: collect
		// the paths first, then parse again with the resolved assets.
		const referenced = new Set<string>();
		parse(source, (assetPath) => {
			referenced.add(assetPath);
			return { src: assetPath, width: 1, height: 1 };
		});
		const assets = new Map<string, ResolvedAsset>();
		for (const assetPath of referenced) {
			const asset = resolve(dirname(path), assetPath);
			const inside = relative(root, asset);
			if (inside.startsWith("..")) {
				throw new ArticleError(
					file,
					`${assetPath} is outside content/${directory}`,
				);
			}
			const target = join(assetsDir, inside);
			try {
				mkdirSync(dirname(target), { recursive: true });
				copyFileSync(asset, target);
			} catch {
				throw new ArticleError(file, `${assetPath} does not exist`);
			}
			assets.set(assetPath, {
				src: `${urlBase}/${inside.split(sep).join("/")}`,
				...(await imageSize(asset)),
			});
		}
		loaded.push({
			id,
			file,
			raw: source.raw,
			data: parse(source, (assetPath) => {
				const asset = assets.get(assetPath);
				if (!asset) throw new ArticleError(file, `${assetPath} not resolved`);
				return asset;
			}),
		});
	}
	return loaded;
}

export function loadArticleFiles(
	root: string,
	assetsDir: string,
	display: (path: string) => string = (path) => path,
): Promise<LoadedFile<ArticleData>[]> {
	return loadContentFiles("articles", root, assetsDir, parseArticle, display);
}

export function loadSeriesFiles(
	root: string,
	assetsDir: string,
	display: (path: string) => string = (path) => path,
): Promise<LoadedFile<SeriesData>[]> {
	return loadContentFiles("series", root, assetsDir, parseSeries, display);
}

interface FileCollectionOptions<T> {
	name: string;
	directory: ContentDirectory;
	load: (
		root: string,
		assetsDir: string,
		display: (path: string) => string,
	) => Promise<LoadedFile<T>[]>;
	/** Runs over every file before `keep`: throw to fail the build. */
	check?: (files: LoadedFile<T>[], repository: string) => void;
	/** Leave a file out of the collection (and say why). */
	keep?: (file: LoadedFile<T>, log: (message: string) => void) => boolean;
}

function fileCollectionLoader<T>(options: FileCollectionOptions<T>): Loader {
	return {
		name: options.name,
		async load({
			store,
			config,
			logger,
			watcher,
			generateDigest,
		}: LoaderContext) {
			const repository = fileURLToPath(new URL("../../../", config.root));
			const root = join(repository, "content", options.directory);
			const assetsDir = join(
				fileURLToPath(config.publicDir),
				"_content",
				options.directory,
			);

			const sync = async () => {
				const files = await options.load(root, assetsDir, (path) =>
					relative(repository, path),
				);
				options.check?.(files, repository);
				store.clear();
				for (const file of files) {
					if (options.keep && !options.keep(file, logger.info.bind(logger)))
						continue;
					store.set({
						id: file.id,
						data: file.data as unknown as Record<string, unknown>,
						filePath: file.file,
						digest: generateDigest(file.raw),
					});
				}
				logger.info(`Loaded ${store.keys().length} ${options.directory}`);
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

export function articlesLoader(options: ArticlesLoaderOptions): Loader {
	return fileCollectionLoader<ArticleData>({
		name: "rawkode-academy-articles",
		directory: "articles",
		load: loadArticleFiles,
		check: (articles, repository) => {
			const seriesRoot = join(repository, "content", "series");
			checkSeries(
				articles,
				new Set(walk(seriesRoot).map((path) => articleId(seriesRoot, path))),
			);
		},
		keep: ({ file, data }, log) => {
			if (options.includeUnpublished) return true;
			if (data.draft) {
				log(`${file}: draft, not published`);
				return false;
			}
			if (data.publishedAt.getTime() > Date.now()) {
				log(
					`${file}: dated ${data.publishedAt.toISOString()}, published by the first deploy after that`,
				);
				return false;
			}
			return true;
		},
	});
}

export function seriesLoader(): Loader {
	return fileCollectionLoader<SeriesData>({
		name: "rawkode-academy-series",
		directory: "series",
		load: loadSeriesFiles,
	});
}
