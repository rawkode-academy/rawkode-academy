const separator = process.argv.indexOf("--");
const command = separator >= 0 ? process.argv.slice(separator + 1) : process.argv.slice(2);
if (command.length === 0) {
	throw new Error("Usage: bun run scripts/require-no-skips.ts -- <test command>");
}

const child = Bun.spawn(command, {
	cwd: new URL("../", import.meta.url).pathname,
	env: process.env,
	stdout: "pipe",
	stderr: "pipe",
});
const [stdout, stderr, exitCode] = await Promise.all([
	new Response(child.stdout).text(),
	new Response(child.stderr).text(),
	child.exited,
]);
process.stdout.write(stdout);
process.stderr.write(stderr);

const transcript = `${stdout}\n${stderr}`;
const skipped = [
	/\bskip(?:ped)?\b/i,
	/\bpending\b/i,
	/\btodo\b/i,
].some((pattern) => pattern.test(transcript));

if (exitCode !== 0 || skipped) {
	process.stderr.write(
		`Acceptance command failed${skipped ? " because skipped/pending/todo cases were reported" : ""}.\n`,
	);
	process.exit(1);
}
