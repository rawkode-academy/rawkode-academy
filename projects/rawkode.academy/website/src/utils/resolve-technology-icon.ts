import {
	resolveMediaAsset,
	type PayloadMediaAsset,
} from "@/lib/payload-content";

interface LogosConfig {
	icon?: boolean | undefined;
	horizontal?: boolean | undefined;
	stacked?: boolean | undefined;
}

function resolveLogo(
	entrySlug: string,
	kind: "icon" | "horizontal",
	assets: PayloadMediaAsset[] = [],
): string | undefined {
	const suffix = `${entrySlug.replace(/^\/+|\/+$/g, "")}/${kind}.svg`;
	const asset = assets.find((candidate) => {
		const path = candidate.relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
		return path === suffix || path.endsWith(`/technologies/${suffix}`);
	});
	return asset ? resolveMediaAsset(asset.relativePath, assets)?.url : undefined;
}

/** Resolve a Payload managed technology icon through the site media endpoint. */
export function resolveTechnologyIconUrl(
	entrySlug: string,
	logos?: LogosConfig | null,
	assets?: PayloadMediaAsset[],
): string | undefined {
	if (!logos?.icon) return undefined;
	return resolveLogo(entrySlug, "icon", assets);
}

/** Resolve a Payload managed horizontal logo through the site media endpoint. */
export function resolveTechnologyHorizontalLogoUrl(
	entrySlug: string,
	logos?: LogosConfig | null,
	assets?: PayloadMediaAsset[],
): string | undefined {
	if (!logos?.horizontal) return undefined;
	return resolveLogo(entrySlug, "horizontal", assets);
}
