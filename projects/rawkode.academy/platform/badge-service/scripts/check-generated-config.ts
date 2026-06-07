import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wranglerConfig = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), "../http/wrangler.jsonc"),
		"utf8",
	),
) as {
	vars?: Record<string, string>;
};

if (
	wranglerConfig.vars?.BADGE_ISSUER_URL !== "https://badges.rawkode.academy"
) {
	throw new Error("Generated http/wrangler.jsonc is missing BADGE_ISSUER_URL");
}
