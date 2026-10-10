import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { run } from "./await-payload.ts";

process.exitCode = await run({
	git: (args) => execFileSync("git", args, { encoding: "utf8" }),
	// Runs from the website directory so `bun x` resolves the website's
	// wrangler. The Worker is selected by --name, so no wrangler config applies.
	wrangler: (args) =>
		execFileSync("bun", ["x", "wrangler", ...args], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: process.env,
		}),
	env: process.env,
	mode: process.env.PAYLOAD_GATE_MODE === "production" ? "production" : "review",
	sleep: async (ms) => {
		await setTimeout(ms);
	},
	now: () => Date.now(),
	log: (message) => console.log(message),
	readFile: (path) => readFileSync(path, "utf8"),
});
