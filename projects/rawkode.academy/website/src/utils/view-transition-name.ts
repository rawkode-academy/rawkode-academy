/**
 * Cross-document view-transition names. The same name rendered on two pages
 * (e.g. a video thumbnail on /watch and the player frame on /watch/[slug])
 * makes the browser morph one into the other during navigation.
 *
 * Names must be valid CSS custom-idents and unique per page: the prefix
 * guards against slugs starting with a digit, and the replace strips
 * anything a slug shouldn't contain anyway.
 */
export const videoTransitionName = (slug: string): string =>
	`vt-video-${slug.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
