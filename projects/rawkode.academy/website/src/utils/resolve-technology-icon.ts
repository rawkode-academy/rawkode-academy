import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveDataDirSync } from "@rawkodeacademy/content-technologies";

interface LogosConfig {
	icon?: boolean | undefined;
	horizontal?: boolean | undefined;
	stacked?: boolean | undefined;
}

export function resolveTechnologyIconUrl(
	entryId: string,
	logos?: LogosConfig | null,
): string | undefined {
	if (!logos?.icon) return undefined;

	// entryId is like "kubernetes/index" -> extract "kubernetes"
	const slug = entryId.replace(/\/index$/, "");

	if (import.meta.env.DEV) {
		try {
			const base = resolveDataDirSync();
			const iconPath = join(base, slug, "icon.svg");

			if (!existsSync(iconPath)) {
				return undefined;
			}

			return "/@fs/" + iconPath;
		} catch {
			return undefined;
		}
	}

	return `https://content.rawkode.academy/logos/technologies/${slug}/icon.svg`;
}
