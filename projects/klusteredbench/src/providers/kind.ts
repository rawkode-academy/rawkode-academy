import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commandExists, exec } from "../util/exec.ts";
import type {
	ClusterInfo,
	ClusterProvider,
	NodeExecOptions,
	NodeExecResult,
} from "./types.ts";

export interface KindProviderConfig {
	/** e.g. "kindest/node:v1.34.0". Omit to use the kind binary's default. */
	nodeImage?: string;
	/** Seconds to wait for the control plane. Default 180. */
	waitSeconds?: number;
	/** Keep the cluster after the trial (debugging). Default false. */
	keep?: boolean;
	/** Extra `docker exec` args, e.g. ["--privileged"]. */
	dockerExecArgs?: string[];
}

/**
 * Runs each trial in a throwaway `kind` cluster. The agent's shell is
 * `docker exec -i <name>-control-plane bash -s`, so it is root on the control
 * plane exactly as a Klustered contestant would be (kubeconfig at
 * /etc/kubernetes/admin.conf, static pod manifests under /etc/kubernetes/manifests).
 */
export class KindProvider implements ClusterProvider {
	readonly kind = "kind";
	private name: string | null = null;
	private kubeconfig: string | null = null;

	constructor(private readonly config: KindProviderConfig = {}) {}

	private get node(): string {
		if (!this.name) throw new Error("kind cluster has not been created");
		return `${this.name}-control-plane`;
	}

	async create(name: string): Promise<ClusterInfo> {
		if (!(await commandExists("kind"))) {
			throw new Error(
				"`kind` is not installed or not on PATH (https://kind.sigs.k8s.io)",
			);
		}
		if (!(await commandExists("docker"))) {
			throw new Error("`docker` is not installed or not on PATH");
		}
		this.name = name;
		const dir = await mkdtemp(join(tmpdir(), "klusteredbench-"));
		this.kubeconfig = join(dir, "kubeconfig");
		const args = [
			"create",
			"cluster",
			"--name",
			name,
			"--wait",
			`${this.config.waitSeconds ?? 180}s`,
			"--kubeconfig",
			this.kubeconfig,
		];
		if (this.config.nodeImage) args.push("--image", this.config.nodeImage);
		const r = await exec("kind", args, { timeoutMs: 15 * 60_000 });
		if (r.code !== 0) {
			throw new Error(
				`kind create cluster failed (exit ${r.code}):\n${r.stderr}`,
			);
		}
		const version = await this.exec(
			"kubectl version -o json 2>/dev/null | tr -d '\\n' || true",
			{ timeoutMs: 30_000 },
		);
		return {
			provider: this.kind,
			name,
			serverVersion: version.stdout.trim() || null,
			nodeImage: this.config.nodeImage ?? null,
		};
	}

	async exec(
		script: string,
		opts: NodeExecOptions = {},
	): Promise<NodeExecResult> {
		const args = ["exec", "-i", ...(this.config.dockerExecArgs ?? [])];
		const env = { KUBECONFIG: "/etc/kubernetes/admin.conf", ...opts.env };
		for (const [k, v] of Object.entries(env)) args.push("-e", `${k}=${v}`);
		args.push(this.node, "bash", "-s");
		return exec("docker", args, {
			stdin: script,
			timeoutMs: opts.timeoutMs,
			onStdout: opts.onStdout,
			signal: opts.signal,
		});
	}

	async destroy(): Promise<void> {
		if (!this.name || this.config.keep) return;
		await exec("kind", ["delete", "cluster", "--name", this.name], {
			timeoutMs: 5 * 60_000,
		});
		this.name = null;
	}
}
