/**
 * Derives a slug from a content file path and optional frontmatter data.
 *
 * @param file - The file path (e.g., "content/videos/my-video/index.md")
 * @param data - Optional frontmatter data that may contain a slug field
 * @param contentDir - The content directory to strip from the path (e.g., "content/videos/")
 * @returns The derived slug
 */
export function deriveSlugFromFile(
	file: string,
	data?: Record<string, any>,
	contentDir?: string,
): string {
	// If slug is explicitly provided in frontmatter, use it
	if (data?.slug) {
		return data.slug;
	}

	// Otherwise, derive from file path
	let slug = file;

	// Strip content directory prefix if provided
	if (contentDir) {
		slug = slug.replace(new RegExp(`^${contentDir}`), "");
	}

	// Remove index files and extensions
	slug = slug.replace(/\/index\.(md|mdx)$/i, "").replace(/\.(md|mdx)$/i, "");

	return slug;
}
