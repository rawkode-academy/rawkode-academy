import { readFile, writeFile } from "node:fs/promises";

const target = process.argv[2] === "preview" ? "preview" : "production";
for (const name of [
	"TICKET_SECRET",
	"SESSION_SECRET",
	"CF_ACCESS_TEAM_DOMAIN",
	"CF_ACCESS_AUD",
] as const) {
	if (!process.env[name]?.trim()) throw new Error(`${name} is required for deployment`);
}

async function run(args: string[], stdin?: string): Promise<void> {
	const child = Bun.spawn(args, {
		stdin: stdin ? "pipe" : "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env: process.env,
	});
	if (stdin && child.stdin) {
		child.stdin.write(stdin);
		child.stdin.end();
	}
	if ((await child.exited) !== 0) throw new Error(`${args.join(" ")} failed`);
}

await run(["bun", "run", "scripts/cloudflare-config.ts", target, "--provision"]);
const configPath = `.wrangler/deploy-${target}.json`;
const config = JSON.parse(await readFile(configPath, "utf8")) as { vars: Record<string, string> };

// A new Worker is created closed. Secrets are installed before admission is enabled.
config.vars.ADMISSION_ENABLED = "false";
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
await run(["bun", "x", "wrangler", "deploy", "--config", configPath]);
// Apply forward-only schema changes while new room, join and ticket admission is
// closed. Any failure exits before the reopening deployment, leaving the live
// Worker safely closed for operator recovery.
await run([
	"bun",
	"x",
	"wrangler",
	"d1",
	"migrations",
	"apply",
	"DB",
	"--remote",
	"--config",
	configPath,
]);
await run(
	["bun", "x", "wrangler", "secret", "bulk", "--config", configPath],
	JSON.stringify({
		TICKET_SECRET: process.env.TICKET_SECRET,
		SESSION_SECRET: process.env.SESSION_SECRET,
		...(process.env.OPERATOR_EMAILS?.trim()
			? { OPERATOR_EMAILS: process.env.OPERATOR_EMAILS }
			: {}),
	}),
);
config.vars.ADMISSION_ENABLED = "true";
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
await run(["bun", "x", "wrangler", "deploy", "--config", configPath]);
