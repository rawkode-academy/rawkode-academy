interface LogosConfig {
	icon?: { src: string } | string | undefined;
	horizontal?: { src: string } | string | undefined;
	stacked?: { src: string } | string | undefined;
}

export function resolveTechnologyIconUrl(
	_entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	if (!logos?.icon) return undefined;

	if (typeof logos.icon === "string") {
		return logos.icon;
	}

	if (typeof logos.icon === "object" && "src" in logos.icon) {
		return logos.icon.src;
	}

	return undefined;
}
