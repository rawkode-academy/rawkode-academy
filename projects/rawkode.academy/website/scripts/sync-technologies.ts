#!/usr/bin/env bun

/*
  Fetch technologies from the existing GraphQL endpoint and
  populate the shared repository folder: ../content/technologies

  Usage:
    bun scripts/sync-technologies.ts [--endpoint <url>] [--limit <n>]
*/

import { GraphQLClient, gql } from "graphql-request";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

type Args = { endpoint: string; limit: number; outDir: string };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d?: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : d;
  };
  const endpoint = get("--endpoint") || process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/graphql";
  const limit = parseInt(get("--limit", "1000")!, 10);
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content-technologies/package.json");
  const outDir = join(dirname(pkgPath), "data");
  return { endpoint, limit, outDir };
}

const query = gql/* GraphQL */ `
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

type Tech = {
  id: string;
  name: string;
  description?: string | null;
  website?: string | null;
  documentation?: string | null;
  logo?: string | null;
};

async function main() {
  const { endpoint, limit, outDir } = parseArgs();
  console.log(`Syncing technologies from ${endpoint} -> ${outDir}`);

  const client = new GraphQLClient(endpoint);
  const res = await client.request<{ getTechnologies: Tech[] }>(query, { limit });
  const items = res.getTechnologies || [];
  console.log(`Fetched ${items.length} technologies`);

  await mkdir(outDir, { recursive: true });

  let written = 0;
  for (const t of items) {
    if (!t || !t.id) continue;
    const file = join(outDir, `${t.id}.mdx`);
    const name = t.name || t.id;
    const description = (t.description || "").trim() || name;
    const website = t.website || "https://rawkode.academy";
    // Sanitize icon input (remove wrapping quotes, accidental ./ on remote)
    let icon = (t.logo || "").trim();
    if ((icon.startsWith('"') && icon.endsWith('"')) || (icon.startsWith("'") && icon.endsWith("'"))) {
      icon = icon.slice(1, -1);
    }
    if (/^\.\/["']?https?:\/\//i.test(icon)) {
      icon = icon.replace(/^\.\/["']?/i, "");
    }
    const documentation = t.documentation || "";

    function q(v: string): string {
      // Quote strings that contain special YAML characters or leading/trailing spaces
      if (v === "" || /[:\-\[\]\{\}\#\&\*\!\|\>\'\"\%\@\`]|^\s|\s$/.test(v)) {
        return JSON.stringify(v);
      }
      return v;
    }

    const desc = description.includes("\n")
      ? `|\n${description.split("\n").map((l) => `  ${l}`).join("\n")}`
      : q(description);

    const lines = [
      "---",
      `name: ${q(name)}`,
      `description: ${desc}`,
      // Prefer local icon if later downloaded; otherwise keep remote.
      // If the icon is a simple basename (no scheme or leading slash), prefix with ./ to work with image().
      /^\.|\//.test(icon) || /^https?:/i.test(icon)
        ? `icon: ${q(icon)}`
        : `icon: ${q('./' + icon)}`,
      `website: ${q(website)}`,
      ...(documentation ? [`documentation: ${q(documentation)}`] : []),
      "categories: []",
      "status: active",
      "---",
      "",
    ];

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, lines.join("\n"), "utf8");
    written++;
  }

  console.log(`Wrote ${written} files.`);
}

main().catch((err) => {
  console.error("sync-technologies failed:", err);
  process.exit(1);
});
