/**
 * A ClusterProvider owns one disposable Kubernetes cluster and gives the
 * harness (and the agent under test) a shell on its control-plane node.
 *
 * Everything the benchmark does to a cluster - setup, break, verify, solve,
 * and every command the agent runs - goes through `exec`. That is deliberate:
 * it mirrors Klustered (you are root on the control plane) and it means the
 * agent is confined to the node, never the host running the benchmark.
 */
export interface NodeExecOptions {
	timeoutMs?: number;
	env?: Record<string, string>;
	onStdout?: (chunk: string) => void;
	signal?: AbortSignal;
}

export interface NodeExecResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	durationMs: number;
}

export interface ClusterInfo {
	provider: string;
	name: string;
	/** Output of `kubectl version` on the node, for reproducibility. */
	serverVersion: string | null;
	nodeImage: string | null;
}

export interface ClusterProvider {
	readonly kind: string;
	/** Bring up a fresh cluster. Idempotency is not required; each trial gets a new one. */
	create(name: string): Promise<ClusterInfo>;
	/** Run a bash script as root on the control-plane node. */
	exec(script: string, opts?: NodeExecOptions): Promise<NodeExecResult>;
	/** Tear the cluster down. Must not throw if it is already gone. */
	destroy(): Promise<void>;
}

export type ProviderFactory = (
	config: Record<string, unknown>,
) => ClusterProvider;
