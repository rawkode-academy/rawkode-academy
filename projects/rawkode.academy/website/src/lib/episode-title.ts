/** Search engines truncate titles beyond roughly this many characters. */
export const SEO_TITLE_LIMIT = 60;

/**
 * The episode title without a stored "| <show>" suffix. Titles in the
 * database should not carry their show; this keeps a stray one from doubling.
 */
export function withoutShowSuffix(title: string, showName: string): string {
	const separator = title.lastIndexOf("|");
	if (separator === -1) return title;
	const suffix = title.slice(separator + 1).trim();
	if (suffix.toLowerCase() !== showName.toLowerCase()) return title;
	return title.slice(0, separator).trim();
}

/**
 * Episode titles are stored without their show, so pages add it here:
 * "22. Borko Vs. Bojan" reads "22. Borko Vs. Bojan | Klustered". The show is
 * left off when the title already names it or when adding it would push the
 * title past the search-result limit.
 */
export function episodePageTitle(title: string, showName?: string): string {
	if (!showName) return title;
	const episode = withoutShowSuffix(title, showName);
	if (episode.toLowerCase().includes(showName.toLowerCase())) return episode;
	const withShow = `${episode} | ${showName}`;
	return withShow.length <= SEO_TITLE_LIMIT ? withShow : episode;
}
