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

function stripWrappingQuotes(icon: string): string {
	const quote = icon.at(0);
	return (quote === '"' || quote === "'") && icon.endsWith(quote)
		? icon.slice(1, -1)
		: icon;
}

function stripAccidentalRemotePrefix(icon: string): string {
	return icon.replace(/^\.\/(["']?https?:\/\/)/i, "$1");
}

function sanitizeIcon(logo?: string | null): string {
	return stripAccidentalRemotePrefix(stripWrappingQuotes((logo || "").trim()));
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
	if (/^\.|\//.test(icon) || /^https?:/i.test(icon)) return icon;
	return `./${icon}`;
}

function optionalDocumentationLine(documentation: string): string[] {
	return documentation ? [`documentation: ${q(documentation)}`] : [];
}

function technologyName(tech: Tech): string {
	return tech.name || tech.id;
}

function technologyDescription(tech: Tech, name: string): string {
	return (tech.description || "").trim() || name;
}

function technologyWebsite(tech: Tech): string {
	return tech.website || "https://rawkode.academy";
}

function frontmatterLines(tech: Tech): string[] {
	const name = technologyName(tech);
	const description = technologyDescription(tech, name);
	const icon = sanitizeIcon(tech.logo);

	return [
		`name: ${q(name)}`,
		`description: ${formatYamlDescription(description)}`,
		`icon: ${q(iconReference(icon))}`,
		`website: ${q(technologyWebsite(tech))}`,
		...optionalDocumentationLine(tech.documentation || ""),
	];
}

function technologyDocument(tech: Tech): string {
	const lines = [
		"---",
		...frontmatterLines(tech),
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
