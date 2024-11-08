import { type Feed, parseFeed } from "@mikaelporttila/rss";

export const fetchReleaseFeed = async (repository: string): Promise<Feed> => {
	const response = await fetch(
		`https://github.com/${repository}/releases.atom`,
	);
	const xml = await response.text();

	return await parseFeed(xml);
};
