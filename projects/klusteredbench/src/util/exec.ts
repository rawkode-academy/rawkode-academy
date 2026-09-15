import { spawn } from "node:child_process";

export interface ExecResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	durationMs: number;
}

export interface ExecOptions {
	stdin?: string;
	timeoutMs?: number;
	env?: Record<string, string>;
	cwd?: string;
	/** Called with each stdout chunk as it arrives. */
	onStdout?: (chunk: string) => void;
	signal?: AbortSignal;
}

/**
 * Run a host command. Never throws on a non-zero exit; callers decide.
 * Throws only if the binary cannot be spawned at all.
 */
export function exec(
	cmd: string,
	args: string[],
	opts: ExecOptions = {},
): Promise<ExecResult> {
	const started = Date.now();
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, {
			cwd: opts.cwd,
			env: { ...process.env, ...opts.env },
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let timer: NodeJS.Timeout | undefined;

		const kill = () => {
			if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
		};
		if (opts.timeoutMs && opts.timeoutMs > 0) {
			timer = setTimeout(() => {
				timedOut = true;
				kill();
			}, opts.timeoutMs);
		}
		opts.signal?.addEventListener("abort", kill, { once: true });

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk;
			opts.onStdout?.(chunk);
		});
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", (err) => {
			if (timer) clearTimeout(timer);
			reject(err);
		});
		child.on("close", (code) => {
			if (timer) clearTimeout(timer);
			opts.signal?.removeEventListener("abort", kill);
			resolve({
				code,
				stdout,
				stderr,
				timedOut,
				durationMs: Date.now() - started,
			});
		});
		if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
		else child.stdin.end();
	});
}

export async function commandExists(cmd: string): Promise<boolean> {
	try {
		const r = await exec("sh", ["-c", `command -v ${cmd}`]);
		return r.code === 0;
	} catch {
		return false;
	}
}
