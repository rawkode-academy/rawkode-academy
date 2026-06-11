import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const wranglerConfig = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), "../http/wrangler.jsonc"),
		"utf8",
	),
) as {
	d1_databases?: Array<{
		binding?: string;
		database_id?: string;
	}>;
	vars?: Record<string, string>;
};

if (
	wranglerConfig.vars?.BADGE_ISSUER_URL !== "https://badges.rawkode.academy"
) {
	throw new Error("Generated http/wrangler.jsonc is missing BADGE_ISSUER_URL");
}

const db = wranglerConfig.d1_databases?.find(
	(database) => database.binding === "DB",
);

if (!db?.database_id || db.database_id === "TODO_CREATE_PLATFORM_BADGE_D1") {
	throw new Error(
		"Generated http/wrangler.jsonc is missing a real DB database_id",
	);
}
