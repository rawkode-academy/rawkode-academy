#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import matter from "gray-matter";
import { MATRIX_STATUS_VALUES } from "../src/dimensions.js";

const TECHNOLOGIES_DIR = join(import.meta.dir, "../technologies");

function waitForKey(): Promise<string> {
	return new Promise((resolve) => {
		emitKeypressEvents(process.stdin);
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();

		const handler = (_: string, key: { name: string; ctrl?: boolean }) => {
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdin.removeListener("keypress", handler);

			if (key.ctrl && key.name === "c") {
				process.exit(0);
			}

			resolve(key.name);
		};

		process.stdin.on("keypress", handler);
	});
}

async function main() {
	const entries = await readdir(TECHNOLOGIES_DIR, { withFileTypes: true });
	const dirs = entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();

	for (const dir of dirs) {
		const mdxPath = join(TECHNOLOGIES_DIR, dir, "index.mdx");

		let content: string;
		try {
			content = await readFile(mdxPath, "utf-8");
		} catch {
			continue;
		}

		const { data, content: body } = matter(content);

		// Skip if already has matrix.status
		if (data.matrix?.status) {
			continue;
		}

		const name = data.name || dir;
		const description = body.trim().split("\n\n")[0]?.trim() || "No description";

		console.clear();
		console.log(`\n${"=".repeat(60)}`);
		console.log(`\n📦 ${name}\n`);
		console.log(`${description}\n`);
		console.log(`${"=".repeat(60)}\n`);

		console.log("Choose category:\n");
		for (let i = 0; i < MATRIX_STATUS_VALUES.length; i++) {
			console.log(`  ${i + 1}) ${MATRIX_STATUS_VALUES[i]}`);
		}
		console.log("\n  s) skip (no change)");
		console.log("\n");

		let status: string | null = null;
		while (status === null) {
			const key = await waitForKey();

			if (key === "s") {
				break;
			}

			const num = Number.parseInt(key, 10);
			if (num >= 1 && num <= MATRIX_STATUS_VALUES.length) {
				status = MATRIX_STATUS_VALUES[num - 1];
			}
		}

		if (status === null) {
			console.log(`⏭ Skipped ${name}`);
			continue;
		}

		// Update the frontmatter
		if (!data.matrix) {
			data.matrix = {};
		}
		data.matrix.status = status;

		const updated = matter.stringify(body, data);
		await writeFile(mdxPath, updated);

		console.log(`✓ Saved ${name} as "${status}"`);
	}

	console.log("\nDone!");
}

main().catch(console.error);
