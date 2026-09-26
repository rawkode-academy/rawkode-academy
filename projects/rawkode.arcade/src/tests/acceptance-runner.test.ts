import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reportsSkippedTests } from "../../scripts/reported-skips";

test("acceptance guard distinguishes reporter outcomes from test names", () => {
	for (const text of ["(skip) unfinished", "Tests 2 passed | 1 skipped (3)", "1 pending", "2 todo", "ok 2 - example # SKIP unavailable"]) expect(reportsSkippedTests(text)).toBe(true);
	for (const text of ["(pass) host can skip a no-buzz round", "✓ retains pending admissions", "0 skipped", "10 passed (10)"]) expect(reportsSkippedTests(text)).toBe(false);
});

const runner = new URL("../../scripts/require-no-skips.ts", import.meta.url).pathname;

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>, until?: string): Promise<string> {
	const decoder = new TextDecoder();
	let text = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) return text + decoder.decode();
		text += decoder.decode(value, { stream: true });
		if (until && text.includes(until)) return text;
	}
}

test("acceptance runner forwards both pipes before the child exits and detects split skip reports", async () => {
	const directory = await mkdtemp(join(tmpdir(), "arcade-acceptance-"));
	const release = join(directory, "release");
	const finished = join(directory, "finished");
	const child = Bun.spawn([process.execPath, runner, "--", process.execPath, "-e", `
		process.stdout.write("Tests 1 skip");
		process.stderr.write("scenario diagnostic\\n");
		const deadline = Date.now() + 3000;
		while (!(await Bun.file(process.argv[1]).exists()) && Date.now() < deadline) await Bun.sleep(10);
		await Bun.write(process.argv[2], "finished");
		process.stdout.write("ped (1)\\n");
	`, release, finished], { stdout: "pipe", stderr: "pipe" });
	const stdout = child.stdout.getReader();
	const stderr = child.stderr.getReader();
	let remainingStdout = "";
	let remainingStderr = "";
	let exitCode = -1;
	try {
		const [out, err] = await Promise.all([
			readText(stdout, "Tests 1 skip"),
			readText(stderr, "scenario diagnostic\n"),
		]);
		expect(out).toContain("Tests 1 skip");
		expect(err).toContain("scenario diagnostic");
		expect(await Bun.file(finished).exists()).toBe(false);
	} finally {
		await Bun.write(release, "continue");
		[remainingStdout, remainingStderr, exitCode] = await Promise.all([
			readText(stdout),
			readText(stderr),
			child.exited,
		]);
		await rm(directory, { recursive: true, force: true });
	}
	expect(remainingStdout).toContain("ped (1)");
	expect(remainingStderr).toContain("skipped/pending/todo cases were reported");
	expect(exitCode).toBe(1);
}, 10_000);

test("acceptance runner preserves child failures and accepts successful runs", async () => {
	for (const code of [0, 7]) {
		const child = Bun.spawn([process.execPath, runner, "--", process.execPath, "-e", `console.log("1 passed"); process.exit(${code})`], { stdout: "pipe", stderr: "pipe" });
		const [stdout, stderr, status] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		expect(stdout).toContain("1 passed");
		expect(status).toBe(code === 0 ? 0 : 1);
		expect(stderr.includes("Acceptance command failed")).toBe(code !== 0);
	}
});
