#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env=GRAPHQL_ENDPOINT --allow-net

/*
  Fetch technologies from the existing GraphQL endpoint and
  populate the workspace package: @rawkodeacademy/content-technologies

  Usage:
    deno run --allow-read --allow-write --allow-env=GRAPHQL_ENDPOINT --allow-net scripts/sync-technologies.ts [--endpoint <url>] [--limit <n>]
*/

import { gql, GraphQLClient } from "graphql-request";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { flagValue, integerFlag } from "./lib/args.ts";

type Args = { endpoint: string; limit: number; outDir: string };

type Tech = {
	id: string;
	name: string;
	description?: string | null;
	website?: string | null;
	documentation?: string | null;
	logo?: string | null;
};

const query = gql /* GraphQL */`
  query GetTechnologies($limit: Int) {
    getTechnologies(limit: $limit) {
      id
      name
      description
      website
      documentation
      logo
    }
  }
`;

function q(value: string): string {
	if (value === "" || /[:[\]{}#&*!|>'"%@`-]|^\s|\s$/.test(value)) {
		return JSON.stringify(value);
	}
	return value;
}

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	const require = createRequire(import.meta.url);
	const pkgPath = require.resolve("@rawkodeacademy/content/package.json");

	return {
		endpoint: flagValue(argv, "--endpoint") ||
			process.env.GRAPHQL_ENDPOINT ||
			"https://api.rawkode.academy/graphql",
		limit: integerFlag(argv, "--limit", 1000),
		outDir: join(dirname(pkgPath), "technologies"),
	};
}

function sanitizeIcon(logo?: string | null): string {
	let icon = (logo || "").trim();

	if (
		(icon.startsWith('"') && icon.endsWith('"')) ||
		(icon.startsWith("'") && icon.endsWith("'"))
	) {
		icon = icon.slice(1, -1);
	}

	return /^\.\/["']?https?:\/\//i.test(icon)
		? icon.replace(/^\.\/["']?/i, "")
		: icon;
}

function formatYamlDescription(description: string): string {
	if (!description.includes("\n")) {
		return q(description);
	}

	const indented = description
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
	return `|\n${indented}`;
}

function iconReference(icon: string): string {
	return /^\.|\//.test(icon) || /^https?:/i.test(icon) ? icon : `./${icon}`;
}

function technologyDocument(tech: Tech): string {
	const name = tech.name || tech.id;
	const description = (tech.description || "").trim() || name;
	const website = tech.website || "https://rawkode.academy";
	const documentation = tech.documentation || "";
	const icon = sanitizeIcon(tech.logo);

	const lines = [
		"---",
		`name: ${q(name)}`,
		`description: ${formatYamlDescription(description)}`,
		`icon: ${q(iconReference(icon))}`,
		`website: ${q(website)}`,
		...(documentation ? [`documentation: ${q(documentation)}`] : []),
		"categories: []",
		"status: active",
		"---",
		"",
	];

	return lines.join("\n");
}

async function fetchTechnologies(
	endpoint: string,
	limit: number,
): Promise<Tech[]> {
	const client = new GraphQLClient(endpoint);
	const response = await client.request<{ getTechnologies: Tech[] }>(query, {
		limit,
	});
	return response.getTechnologies || [];
}

async function writeTechnology(outDir: string, tech: Tech) {
	const file = join(outDir, `${tech.id}.mdx`);
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, technologyDocument(tech), "utf8");
}

async function main() {
	const { endpoint, limit, outDir } = parseArgs();
	console.log(`Syncing technologies from ${endpoint} -> ${outDir}`);

	const items = await fetchTechnologies(endpoint, limit);
	console.log(`Fetched ${items.length} technologies`);

	await mkdir(outDir, { recursive: true });

	let written = 0;
	for (const tech of items) {
		if (!tech?.id) continue;
		await writeTechnology(outDir, tech);
		written++;
	}

	console.log(`Wrote ${written} files.`);
}

main().catch((error) => {
	console.error("sync-technologies failed:", error);
	process.exit(1);
});
