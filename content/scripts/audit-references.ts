#!/usr/bin/env bun

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

interface MissingEntry {
	id: string;
	path: string;
	missing: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRoot = join(__dirname, "..");
const repoRoot = join(contentRoot, "..");

const PEOPLE_DIR = join(contentRoot, "people");
const TECHNOLOGIES_DIR = join(contentRoot, "technologies");
const VIDEOS_DIR = join(contentRoot, "videos");
const SHOWS_DIR = join(contentRoot, "shows");
const OUTPUT_DIR = join(contentRoot, "scripts", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "missing-websites.md");

// A person is "linkable" if any of these fields are set. Blocking entries have none —
// they cannot be templated into any UI or description without a follow-up.
const PERSON_LINK_FIELDS = [
	"website",
	"bluesky",
	"github",
	"linkedin",
	"twitter",
	"mastodon",
	"youtube",
] as const;
// Advisory: present in the corpus but missing the canonical `website` field. Not blocking.
const PERSON_ADVISORY_FIELD = "website";
const TECH_BLOCKING = ["website"] as const;
const TECH_NICE_TO_HAVE = ["documentation"] as const;

function hasValue(value: unknown): boolean {
	if (value == null) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "object") return Object.keys(value).length > 0;
	return true;
}

async function readFrontmatter(path: string): Promise<Record<string, unknown>> {
	const raw = await readFile(path, "utf8");
	return matter(raw).data as Record<string, unknown>;
}

async function walkMarkdown(dir: string): Promise<string[]> {
	const out: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await walkMarkdown(full)));
		} else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

function normalizeReference(ref: unknown): string | null {
	if (typeof ref === "string") return ref.trim() || null;
	if (ref && typeof ref === "object") {
		const id = (ref as { id?: unknown; collection?: unknown }).id;
		if (typeof id === "string") return id.trim() || null;
	}
	return null;
}

async function collectReferencedPeopleIds(): Promise<Set<string>> {
	const ids = new Set<string>();
	const videoFiles = await walkMarkdown(VIDEOS_DIR);
	for (const file of videoFiles) {
		const data = await readFrontmatter(file);
		const guests = Array.isArray(data.guests) ? (data.guests as unknown[]) : [];
		for (const g of guests) {
			const id = normalizeReference(g);
			if (id) ids.add(id);
		}
	}
	const showFiles = await walkMarkdown(SHOWS_DIR);
	for (const file of showFiles) {
		const data = await readFrontmatter(file);
		const hosts = Array.isArray(data.hosts) ? (data.hosts as unknown[]) : [];
		for (const h of hosts) {
			const id = normalizeReference(h);
			if (id) ids.add(id);
		}
	}
	return ids;
}

async function auditPeople(referencedIds: Set<string>): Promise<{
	blocking: MissingEntry[];
	advisory: MissingEntry[];
}> {
	const blocking: MissingEntry[] = [];
	const advisory: MissingEntry[] = [];

	const entries = await readdir(PEOPLE_DIR, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!/\.(md|mdx)$/.test(entry.name)) continue;

		const path = join(PEOPLE_DIR, entry.name);
		const data = await readFrontmatter(path);
		const id =
			(data.id as string | undefined) ?? entry.name.replace(/\.(md|mdx)$/, "");

		if (!referencedIds.has(id)) continue;

		const hasAnyLink = PERSON_LINK_FIELDS.some((f) => hasValue(data[f]));
		if (!hasAnyLink) {
			blocking.push({
				id,
				path: relative(repoRoot, path),
				missing: PERSON_LINK_FIELDS as unknown as string[],
			});
		} else if (!hasValue(data[PERSON_ADVISORY_FIELD])) {
			advisory.push({
				id,
				path: relative(repoRoot, path),
				missing: [PERSON_ADVISORY_FIELD],
			});
		}
	}

	blocking.sort((a, b) => a.id.localeCompare(b.id));
	advisory.sort((a, b) => a.id.localeCompare(b.id));
	return { blocking, advisory };
}

async function auditTechnologies(): Promise<{
	blocking: MissingEntry[];
	advisory: MissingEntry[];
}> {
	const blocking: MissingEntry[] = [];
	const advisory: MissingEntry[] = [];

	const dirs = await readdir(TECHNOLOGIES_DIR, { withFileTypes: true });
	for (const dir of dirs) {
		if (!dir.isDirectory()) continue;

		const path = join(TECHNOLOGIES_DIR, dir.name, "index.mdx");
		let data: Record<string, unknown>;
		try {
			data = await readFrontmatter(path);
		} catch {
			continue;
		}

		const id = dir.name;
		const blockingMissing = TECH_BLOCKING.filter((f) => !hasValue(data[f]));
		const advisoryMissing = TECH_NICE_TO_HAVE.filter((f) => !hasValue(data[f]));

		if (blockingMissing.length > 0) {
			blocking.push({ id, path: relative(repoRoot, path), missing: blockingMissing as unknown as string[] });
		} else if (advisoryMissing.length > 0) {
			advisory.push({ id, path: relative(repoRoot, path), missing: advisoryMissing as unknown as string[] });
		}
	}

	blocking.sort((a, b) => a.id.localeCompare(b.id));
	advisory.sort((a, b) => a.id.localeCompare(b.id));
	return { blocking, advisory };
}

function renderSection(
	heading: string,
	subheading: string,
	entries: MissingEntry[],
): string {
	if (entries.length === 0) return `### ${heading}\n\n${subheading}\n\n_None._\n`;
	const lines = entries.map(
		(e) => `- [ ] \`${e.id}\` — missing ${e.missing.map((m) => `\`${m}\``).join(", ")} — \`${e.path}\``,
	);
	return `### ${heading}\n\n${subheading}\n\n${lines.join("\n")}\n`;
}

function renderReport(
	people: { blocking: MissingEntry[]; advisory: MissingEntry[] },
	techs: { blocking: MissingEntry[]; advisory: MissingEntry[] },
): string {
	const generatedAt = new Date().toISOString();
	const totalBlocking = people.blocking.length + techs.blocking.length;
	const totalAdvisory = people.advisory.length + techs.advisory.length;

	return `# Missing websites & reference fields

_Generated by \`content/scripts/audit-references.ts\` on ${generatedAt}._

Scope: only people referenced as guests of a video or hosts of a show, and every technology
entry. The transcript-driven resource extraction in phase 3 uses these reference URLs to
dedupe (so a transcript mention of a guest's GitHub does not become a duplicate resource).

Blocking entries are unlinkable — fix before running phase 3. Advisory entries are
healthy enough to ship; listed for visibility so you can fill them in opportunistically.

**Summary:** ${totalBlocking} blocking, ${totalAdvisory} advisory.

## People

${renderSection("Blocking (no contact links)", "These people have no website, github, bluesky, linkedin, twitter, mastodon, or youtube set — there is no way to link to them. Fix before running phase 3.", people.blocking)}
${renderSection("Advisory (no \`website\`)", "Has at least one contact link but no canonical website. Optional to fill in.", people.advisory)}

## Technologies

${renderSection("Blocking (missing \`website\`)", "Fix before running phase 3.", techs.blocking)}
${renderSection("Advisory", "Optional fields worth filling in.", techs.advisory)}
`;
}

async function main() {
	console.log("Auditing reference data…");
	const referencedPeople = await collectReferencedPeopleIds();
	console.log(`People referenced as guests or hosts: ${referencedPeople.size}`);
	const [people, techs] = await Promise.all([
		auditPeople(referencedPeople),
		auditTechnologies(),
	]);

	await mkdir(OUTPUT_DIR, { recursive: true });
	const report = renderReport(people, techs);
	await writeFile(OUTPUT_FILE, report, "utf8");

	const blockingTotal = people.blocking.length + techs.blocking.length;
	const advisoryTotal = people.advisory.length + techs.advisory.length;
	console.log(
		`People: ${people.blocking.length} blocking, ${people.advisory.length} advisory`,
	);
	console.log(
		`Technologies: ${techs.blocking.length} blocking, ${techs.advisory.length} advisory`,
	);
	console.log(`\nReport: ${relative(repoRoot, OUTPUT_FILE)}`);
	console.log(`Totals: ${blockingTotal} blocking, ${advisoryTotal} advisory`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
