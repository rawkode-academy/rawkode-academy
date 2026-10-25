// Technology logo URLs. Logos are served from the content CDN by
// platform-technologies (the same URLs it returns as Technology.icon and
// Technology.horizontalLogo); the `logos` flags say which files exist.
const CONTENT_CDN = "https://content.rawkode.academy";

interface LogosConfig {
	icon?: boolean | undefined;
	horizontal?: boolean | undefined;
	stacked?: boolean | undefined;
}

// Legacy ids look like "kubernetes/index".
const logoUrl = (entryId: string, file: string) =>
	`${CONTENT_CDN}/technologies/${encodeURIComponent(entryId.replace(/\/index$/, ""))}/${file}`;

export function resolveTechnologyIconUrl(
	entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	return logos?.icon ? logoUrl(entryId, "icon.svg") : undefined;
}

export function resolveTechnologyHorizontalLogoUrl(
	entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	return logos?.horizontal ? logoUrl(entryId, "horizontal.svg") : undefined;
}
