#!/usr/bin/env bun

import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

interface PersonRecord {
	file: string;
	id: string;
	github?: string;
}

interface Finding {
	path: string;
	message: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentRoot = join(__dirname, "..");
const repoRoot = join(contentRoot, "..");
const peopleDir = join(contentRoot, "people");

const ARRAY_REFERENCE_FIELDS = ["guests", "hosts", "authors"] as const;
const SCALAR_REFERENCE_FIELDS = ["author"] as const;

function normalizeGithubHandle(handle: string): string {
	return handle
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function extractFrontmatter(raw: string): string | null {
	if (!raw.startsWith("---\n")) return null;
	const end = raw.indexOf("\n---", 4);
	if (end === -1) return null;
	return raw.slice(4, end);
}

function readScalar(frontmatter: string, key: string): string | undefined {
	const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
	if (!match) return undefined;
	return unquote(match[1].trim());
}

function unquote(value: string): string {
	return value.replace(/^['"]|['"]$/g, "").trim();
}

async function walk(dir: string): Promise<string[]> {
	const out: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...(await walk(full)));
		} else if (entry.isFile() && /\.(md|mdx|ya?ml)$/.test(entry.name)) {
			out.push(full);
		}
	}
	return out;
}

async function readPeople(): Promise<PersonRecord[]> {
	const records: PersonRecord[] = [];
	const entries = await readdir(peopleDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !/\.(md|mdx)$/.test(entry.name)) continue;
		const file = join(peopleDir, entry.name);
		const raw = await readFile(file, "utf8");
		const frontmatter = extractFrontmatter(raw);
		if (!frontmatter) {
			records.push({
				file,
				id: basename(entry.name, extname(entry.name)),
			});
			continue;
		}
		const stem = basename(entry.name, extname(entry.name));
		records.push({
			file,
			id: readScalar(frontmatter, "id") ?? stem,
			github: readScalar(frontmatter, "github"),
		});
	}
	return records;
}

function parseInlineArray(value: string): string[] {
	const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "");
	if (!inner.trim()) return [];
	return inner
		.split(",")
		.map((part) => unquote(part.trim()))
		.filter(Boolean);
}

function collectArrayField(frontmatter: string, field: string): string[] {
	const lines = frontmatter.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const match = lines[i].match(new RegExp(`^${field}:\\s*(.*)$`));
		if (!match) continue;
		const rest = match[1]?.trim() ?? "";
		if (rest.startsWith("[")) return parseInlineArray(rest);
		if (rest !== "") return [];

		const values: string[] = [];
		for (let j = i + 1; j < lines.length; j++) {
			const line = lines[j];
			if (line.trim() === "") continue;
			if (!/^\s/.test(line)) break;
			const item = line.match(/^\s*-\s*(.+?)\s*$/);
			if (item) values.push(unquote(item[1]));
		}
		return values;
	}
	return [];
}

function collectReferences(frontmatter: string): Map<string, string[]> {
	const refs = new Map<string, string[]>();
	for (const field of ARRAY_REFERENCE_FIELDS) {
		const values = collectArrayField(frontmatter, field);
		if (values.length > 0) refs.set(field, values);
	}
	for (const field of SCALAR_REFERENCE_FIELDS) {
		const value = readScalar(frontmatter, field);
		if (value) refs.set(field, [value]);
	}
	return refs;
}

async function main() {
	const people = await readPeople();
	const findings: Finding[] = [];
	const missingGithub: PersonRecord[] = [];
	const knownPeople = new Set<string>();
	const githubIds = new Map<string, PersonRecord>();

	for (const person of people) {
		const stem = basename(person.file, extname(person.file));
		knownPeople.add(stem);
		knownPeople.add(person.id);

		if (!person.github) {
			missingGithub.push(person);
			continue;
		}

		const expected = normalizeGithubHandle(person.github);
		if (stem !== expected) {
			findings.push({
				path: relative(repoRoot, person.file),
				message: `filename stem "${stem}" must match normalized GitHub handle "${expected}"`,
			});
		}
		if (person.id !== expected) {
			findings.push({
				path: relative(repoRoot, person.file),
				message: `frontmatter id "${person.id}" must match normalized GitHub handle "${expected}"`,
			});
		}

		const duplicate = githubIds.get(expected);
		if (duplicate) {
			findings.push({
				path: relative(repoRoot, person.file),
				message: `duplicate GitHub handle with ${relative(repoRoot, duplicate.file)}`,
			});
		} else {
			githubIds.set(expected, person);
		}
	}

	const contentFiles = (await walk(contentRoot)).filter(
		(file) => !file.startsWith(peopleDir),
	);
	for (const file of contentFiles) {
		const raw = await readFile(file, "utf8");
		const frontmatter = extractFrontmatter(raw);
		if (!frontmatter) continue;
		for (const [field, refs] of collectReferences(frontmatter)) {
			const seen = new Set<string>();
			for (const ref of refs) {
				if (seen.has(ref)) {
					findings.push({
						path: relative(repoRoot, file),
						message: `duplicate ${field} reference "${ref}"`,
					});
				}
				seen.add(ref);
				if (!knownPeople.has(ref)) {
					findings.push({
						path: relative(repoRoot, file),
						message: `unknown ${field} person reference "${ref}"`,
					});
				}
			}
		}
	}

	console.log(`People: ${people.length}`);
	console.log(`GitHub-linked people: ${people.length - missingGithub.length}`);
	console.log(`Missing GitHub handles: ${missingGithub.length}`);
	if (missingGithub.length > 0) {
		console.log(
			missingGithub
				.map((person) => `- ${relative(repoRoot, person.file)}`)
				.join("\n"),
		);
	}

	if (findings.length > 0) {
		console.error("\nPeople audit failed:");
		for (const finding of findings) {
			console.error(`- ${finding.path}: ${finding.message}`);
		}
		process.exit(1);
	}

	console.log("People audit passed.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
