// Eagerly import all technology logos
// Path is relative to this file, goes up to monorepo root then into content
const iconModules = import.meta.glob<{ default: ImageMetadata }>(
	"../../../../../content/technologies/*/icon.svg",
	{ eager: true },
);
const horizontalModules = import.meta.glob<{ default: ImageMetadata }>(
	"../../../../../content/technologies/*/horizontal.svg",
	{ eager: true },
);

interface ImageMetadata {
	src: string;
	width: number;
	height: number;
	format: string;
}

interface LogosConfig {
	icon?: boolean | undefined;
	horizontal?: boolean | undefined;
	stacked?: boolean | undefined;
}

// Build maps of technology ID -> logo URL
const iconUrlMap: Record<string, string> = {};
for (const [path, module] of Object.entries(iconModules)) {
	// Path is like "../../../content/technologies/kubernetes/icon.svg"
	const match = path.match(/\/technologies\/([^/]+)\/icon\.svg$/);
	if (match?.[1] && module.default?.src) {
		iconUrlMap[match[1]] = module.default.src;
	}
}

const horizontalUrlMap: Record<string, string> = {};
for (const [path, module] of Object.entries(horizontalModules)) {
	const match = path.match(/\/technologies\/([^/]+)\/horizontal\.svg$/);
	if (match?.[1] && module.default?.src) {
		horizontalUrlMap[match[1]] = module.default.src;
	}
}

export function resolveTechnologyIconUrl(
	entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	if (!logos?.icon) return undefined;

	// Entry ID is like "kubernetes/index", extract just the technology name
	const techId = entryId.replace(/\/index$/, "");
	return iconUrlMap[techId];
}

export function resolveTechnologyHorizontalLogoUrl(
	entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	if (!logos?.horizontal) return undefined;

	const techId = entryId.replace(/\/index$/, "");
	return horizontalUrlMap[techId];
}
