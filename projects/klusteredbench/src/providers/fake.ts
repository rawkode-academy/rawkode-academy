import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "../util/exec.ts";
import type {
	ClusterInfo,
	ClusterProvider,
	NodeExecOptions,
	NodeExecResult,
} from "./types.ts";

/**
 * Not a Kubernetes cluster. Scripts run in a host `bash` with an empty
 * scratch directory as `$KB_STATE`. Exists so the runner, verifier polling,
 * timeouts and reporting can be tested without docker or kind.
 */
export class FakeProvider implements ClusterProvider {
	readonly kind = "fake";
	private dir: string | null = null;
	readonly commands: string[] = [];

	async create(name: string): Promise<ClusterInfo> {
		this.dir = await mkdtemp(join(tmpdir(), `kb-fake-${name}-`));
		return {
			provider: this.kind,
			name,
			serverVersion: "fake",
			nodeImage: null,
		};
	}

	async exec(
		script: string,
		opts: NodeExecOptions = {},
	): Promise<NodeExecResult> {
		if (!this.dir) throw new Error("fake cluster has not been created");
		this.commands.push(script);
		return exec("bash", ["-s"], {
			stdin: script,
			cwd: this.dir,
			env: { KB_STATE: this.dir, ...opts.env },
			timeoutMs: opts.timeoutMs,
			onStdout: opts.onStdout,
			signal: opts.signal,
		});
	}

	async destroy(): Promise<void> {
		if (this.dir) await rm(this.dir, { recursive: true, force: true });
		this.dir = null;
	}
}
