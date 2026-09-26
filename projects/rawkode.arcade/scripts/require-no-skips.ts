import { once } from "node:events";
import { reportsSkippedTests } from "./reported-skips";

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
async function forward(stream: ReadableStream<Uint8Array>, output: NodeJS.WriteStream): Promise<string> {
	const decoder = new TextDecoder();
	let transcript = "";
	for await (const chunk of stream) {
		transcript += decoder.decode(chunk, { stream: true });
		if (!output.write(chunk)) await once(output, "drain");
	}
	return transcript + decoder.decode();
}

const [stdout, stderr, exitCode] = await Promise.all([
	forward(child.stdout, process.stdout),
	forward(child.stderr, process.stderr),
	child.exited,
]);

const transcript = `${stdout}\n${stderr}`;
const skipped = reportsSkippedTests(transcript);

if (exitCode !== 0 || skipped) {
	process.stderr.write(
		`Acceptance command failed${skipped ? " because skipped/pending/todo cases were reported" : ""}.\n`,
	);
	process.exit(1);
}
