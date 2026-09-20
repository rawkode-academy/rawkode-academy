const projectRoot = new URL("../", import.meta.url).pathname;
const persist = ".wrangler/e2e-state";
const migrate = Bun.spawn(
	["bun", "x", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persist],
	{ cwd: projectRoot, stdout: "inherit", stderr: "inherit", env: process.env },
);
if ((await migrate.exited) !== 0) process.exit(1);

const server = Bun.spawn(
	[
		"bun",
		"x",
		"wrangler",
		"dev",
		"--local",
		"--persist-to",
		persist,
		"--port",
		"8787",
		"--var",
		"ENVIRONMENT:test",
		"--var",
		"ADMISSION_ENABLED:true",
		"--var",
		"E2E_SEED_SECRET:test-only-local-secret",
		"--var",
		"SESSION_SECRET:test-only-session-signing-secret",
		"--var",
		"TICKET_SECRET:test-only-ticket-signing-secret",
	],
	{ cwd: projectRoot, stdout: "inherit", stderr: "inherit", env: process.env },
);

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.kill(signal));
process.exit(await server.exited);
