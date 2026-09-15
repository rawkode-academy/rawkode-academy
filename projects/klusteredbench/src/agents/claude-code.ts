import { addUsage, EMPTY_USAGE, type TokenUsage } from "../pricing.ts";
import type { ClusterProvider } from "../providers/types.ts";
import { SYSTEM_PROMPT, userPrompt } from "./prompt.ts";
import type {
	Agent,
	AgentConfigBase,
	AgentExitReason,
	AgentRunInput,
	AgentRunOutput,
	TranscriptEvent,
} from "./types.ts";

export interface ClaudeCodeAgentConfig extends AgentConfigBase {
	type: "claude-code";
	model: string;
	/** Pin the CLI version installed on the node, e.g. "2.1.0". Default: latest. */
	version?: string;
	/** Extra CLI flags, verbatim. */
	extraArgs?: string[];
}

const INSTALL_SCRIPT = (version: string | undefined) => `
set -e
if ! command -v curl >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null && apt-get install -y -qq curl ca-certificates >/dev/null
fi
if [ ! -x "$HOME/.local/bin/claude" ]; then
  curl -fsSL https://claude.ai/install.sh | bash -s -- ${version ?? "latest"} >/dev/null
fi
"$HOME/.local/bin/claude" --version
`;

/**
 * Runs the Claude Code CLI *inside* the control-plane node so it has the
 * same confinement as every other agent. Token and cost figures come from
 * the CLI's own `result` event, so this measures the product, not just the model.
 * Requires ANTHROPIC_API_KEY in the harness environment; it is forwarded to
 * the node for the duration of the run.
 */
export class ClaudeCodeAgent implements Agent {
	readonly type = "claude-code";
	readonly name: string;
	readonly model: string;

	constructor(private readonly config: ClaudeCodeAgentConfig) {
		this.name = config.name;
		this.model = config.model;
	}

	async prepare(cluster: ClusterProvider): Promise<void> {
		const r = await cluster.exec(INSTALL_SCRIPT(this.config.version), {
			timeoutMs: 10 * 60_000,
		});
		if (r.code !== 0) {
			throw new Error(
				`Failed to install Claude Code on the node:\n${r.stderr}\n${r.stdout}`,
			);
		}
	}

	async run(input: AgentRunInput): Promise<AgentRunOutput> {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			return {
				exitReason: "error",
				finalMessage: null,
				usage: EMPTY_USAGE,
				reportedCostUsd: null,
				turns: 0,
				toolCalls: 0,
				model: this.model,
				error:
					"ANTHROPIC_API_KEY is not set; the claude-code agent needs it forwarded to the node",
			};
		}
		const args = [
			"-p",
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			this.model,
			"--dangerously-skip-permissions",
			// Keep Claude Code's own system prompt: this adapter benchmarks the
			// product as shipped, with the shared Klustered brief appended.
			"--append-system-prompt",
			shellQuote(SYSTEM_PROMPT),
		];
		if (this.config.maxTurns)
			args.push("--max-turns", String(this.config.maxTurns));
		for (const a of this.config.extraArgs ?? []) args.push(shellQuote(a));
		const script = `
mkdir -p /root/klustered && cd /root/klustered
printf '%s' ${shellQuote(userPrompt(input.prompt))} | "$HOME/.local/bin/claude" ${args.join(" ")}
`;
		const parser = new StreamJsonParser(input.log);
		const r = await input.cluster.exec(script, {
			env: {
				ANTHROPIC_API_KEY: apiKey,
				// Claude Code refuses --dangerously-skip-permissions as root unless
				// it is told it is in a sandbox. The kind node is exactly that.
				IS_SANDBOX: "1",
				CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
				DISABLE_AUTOUPDATER: "1",
			},
			signal: input.signal,
			// The harness abort signal is the real deadline; this is a backstop.
			timeoutMs: input.budgetMs + 30_000,
			onStdout: (chunk) => parser.feed(chunk),
		});
		parser.flush();

		let exitReason: AgentExitReason = "completed";
		let error: string | undefined;
		if (input.signal.aborted) {
			exitReason =
				(input.signal.reason as AgentExitReason | undefined) ?? "timeout";
		} else if (parser.result?.subtype === "error_max_turns") {
			exitReason = "max_turns";
		} else if (r.code !== 0 || parser.result?.is_error) {
			exitReason = "error";
			error =
				parser.result?.result ?? r.stderr.slice(-2000) ?? `exit ${r.code}`;
		}
		return {
			exitReason,
			finalMessage: parser.result?.result ?? parser.lastAssistantText,
			usage: parser.usage,
			reportedCostUsd: parser.result?.total_cost_usd ?? null,
			turns: parser.result?.num_turns ?? parser.assistantTurns,
			toolCalls: parser.toolCalls,
			model: this.model,
			error,
		};
	}
}

interface ClaudeResultEvent {
	type: "result";
	subtype: string;
	is_error: boolean;
	result?: string;
	num_turns?: number;
	total_cost_usd?: number;
	duration_ms?: number;
	usage?: {
		input_tokens?: number;
		output_tokens?: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
}

/**
 * Parses `claude -p --output-format stream-json` line by line, mirroring the
 * interesting bits into the benchmark transcript and accumulating usage.
 */
export class StreamJsonParser {
	private buffer = "";
	usage: TokenUsage = EMPTY_USAGE;
	result: ClaudeResultEvent | null = null;
	toolCalls = 0;
	assistantTurns = 0;
	lastAssistantText: string | null = null;

	constructor(private readonly log: (e: TranscriptEvent) => void) {}

	feed(chunk: string): void {
		this.buffer += chunk;
		let idx = this.buffer.indexOf("\n");
		while (idx >= 0) {
			this.line(this.buffer.slice(0, idx));
			this.buffer = this.buffer.slice(idx + 1);
			idx = this.buffer.indexOf("\n");
		}
	}

	flush(): void {
		if (this.buffer.trim()) this.line(this.buffer);
		this.buffer = "";
	}

	private line(raw: string): void {
		const line = raw.trim();
		if (!line) return;
		let ev: Record<string, unknown>;
		try {
			ev = JSON.parse(line);
		} catch {
			this.log({ t: Date.now(), type: "raw", data: line });
			return;
		}
		const t = Date.now();
		if (ev.type === "assistant") {
			this.assistantTurns += 1;
			const msg = ev.message as
				| {
						content?: Array<Record<string, unknown>>;
						usage?: ClaudeResultEvent["usage"];
				  }
				| undefined;
			for (const block of msg?.content ?? []) {
				if (block.type === "text" && typeof block.text === "string") {
					this.lastAssistantText = block.text;
					this.log({ t, type: "assistant", text: block.text });
				} else if (block.type === "tool_use") {
					this.toolCalls += 1;
					this.log({
						t,
						type: "tool_call",
						id: String(block.id ?? ""),
						name: String(block.name ?? ""),
						input: block.input,
					});
				}
			}
			// Per-message usage is authoritative when present; result.usage is the total.
			if (msg?.usage && !this.result) {
				const u: TokenUsage = {
					inputTokens: msg.usage.input_tokens ?? 0,
					outputTokens: msg.usage.output_tokens ?? 0,
					cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
					cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
				};
				this.usage = addUsage(this.usage, u);
				this.log({ t, type: "usage", turn: this.assistantTurns, usage: u });
			}
		} else if (ev.type === "user") {
			const msg = ev.message as
				| { content?: Array<Record<string, unknown>> }
				| undefined;
			for (const block of msg?.content ?? []) {
				if (block.type === "tool_result") {
					this.log({
						t,
						type: "tool_result",
						id: String(block.tool_use_id ?? ""),
						exitCode: block.is_error ? 1 : 0,
						output:
							typeof block.content === "string"
								? block.content
								: JSON.stringify(block.content ?? ""),
						durationMs: 0,
					});
				}
			}
		} else if (ev.type === "result") {
			this.result = ev as unknown as ClaudeResultEvent;
			if (this.result.usage) {
				// Prefer the CLI's own total over our per-message sum.
				this.usage = {
					inputTokens: this.result.usage.input_tokens ?? this.usage.inputTokens,
					outputTokens:
						this.result.usage.output_tokens ?? this.usage.outputTokens,
					cacheWriteTokens:
						this.result.usage.cache_creation_input_tokens ??
						this.usage.cacheWriteTokens,
					cacheReadTokens:
						this.result.usage.cache_read_input_tokens ??
						this.usage.cacheReadTokens,
				};
			}
			this.log({ t, type: "raw", data: ev });
		} else {
			this.log({ t, type: "raw", data: ev });
		}
	}
}

export function shellQuote(s: string): string {
	return `'${s.replace(/'/g, `'\\''`)}'`;
}
