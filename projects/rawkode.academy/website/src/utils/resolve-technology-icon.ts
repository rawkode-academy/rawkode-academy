// Astro's image() helper in content collections returns an ImageMetadata object
// which may be represented as a function with properties at runtime
interface ImageMetadata {
	src: string;
	width?: number;
	height?: number;
	format?: string;
}

interface LogosConfig {
	icon?: ImageMetadata | string | undefined;
	horizontal?: ImageMetadata | string | undefined;
	stacked?: ImageMetadata | string | undefined;
}

export function resolveTechnologyIconUrl(
	_entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	if (!logos?.icon) return undefined;

	// Handle string paths directly
	if (typeof logos.icon === "string") {
		return logos.icon;
	}

	// Handle ImageMetadata objects (may appear as function at runtime due to Vite/Astro)
	// Access .src property directly - it's available on both objects and Astro's special image references
	const icon = logos.icon as { src?: string };
	if (icon.src) {
		return icon.src;
	}

	return undefined;
}
