import Anthropic from "@anthropic-ai/sdk";
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

export interface BuiltinAgentConfig extends AgentConfigBase {
	type: "builtin";
	model: string;
	effort?: "low" | "medium" | "high" | "xhigh" | "max";
	/** Max tokens per assistant turn. Default 16000. */
	maxTokens?: number;
	/** Truncate tool output fed back to the model at this many characters. Default 30000. */
	maxToolOutputChars?: number;
}

const SHELL_TOOL: Anthropic.Tool = {
	name: "shell",
	description:
		"Run a bash script as root on the cluster's control-plane node and return its combined stdout/stderr and exit code. Non-interactive: nothing can read from stdin, so do not use editors or `kubectl edit`; use `kubectl patch`, `kubectl apply`, `sed -i`, heredocs, etc.",
	input_schema: {
		type: "object",
		properties: {
			script: { type: "string", description: "The bash script to execute." },
			timeout_seconds: {
				type: "integer",
				description: "Optional. Kill the command after this many seconds.",
			},
		},
		required: ["script"],
		additionalProperties: false,
	},
	strict: true,
};

const MAX_TURNS_DEFAULT = 60;

/**
 * The reference harness: a minimal Anthropic Messages API loop with one
 * `shell` tool. Because every agent using this class shares the exact same
 * scaffold, system prompt and tool, differences between two `builtin`
 * agents are differences between the models (or effort settings), nothing else.
 *
 * Refusal fallbacks are intentionally NOT enabled: a benchmark must not
 * silently substitute another model. A refusal is recorded as such.
 */
export class BuiltinAgent implements Agent {
	readonly type = "builtin";
	readonly name: string;
	readonly model: string;
	private readonly client: Anthropic;

	constructor(
		private readonly config: BuiltinAgentConfig,
		client?: Anthropic,
	) {
		this.name = config.name;
		this.model = config.model;
		this.client = client ?? new Anthropic();
	}

	private thinkingParam():
		| Anthropic.MessageCreateParams["thinking"]
		| undefined {
		// Fable/Mythos: thinking is always on; sending anything but adaptive is a 400.
		// Everything else current takes adaptive. Haiku 4.5 needs a budget, which we
		// deliberately do not set - it runs without thinking and the report shows it.
		if (this.model.startsWith("claude-haiku")) return undefined;
		return { type: "adaptive", display: "summarized" };
	}

	async run(input: AgentRunInput): Promise<AgentRunOutput> {
		const { cluster, signal, log } = input;
		const messages: Anthropic.MessageParam[] = [
			{ role: "user", content: userPrompt(input.prompt) },
		];
		let usage: TokenUsage = EMPTY_USAGE;
		let turns = 0;
		let toolCalls = 0;
		let finalMessage: string | null = null;
		let exitReason: AgentExitReason = "completed";
		let error: string | undefined;
		const maxTurns = this.config.maxTurns ?? MAX_TURNS_DEFAULT;
		log({ t: Date.now(), type: "system", text: SYSTEM_PROMPT });

		while (true) {
			if (signal.aborted) {
				exitReason =
					(signal.reason as AgentExitReason | undefined) ?? "timeout";
				break;
			}
			if (turns >= maxTurns) {
				exitReason = "max_turns";
				break;
			}
			let message: Anthropic.Message;
			try {
				const stream = this.client.messages.stream(
					{
						model: this.model,
						max_tokens: this.config.maxTokens ?? 16000,
						system: [
							{
								type: "text",
								text: SYSTEM_PROMPT,
								cache_control: { type: "ephemeral" },
							},
						],
						tools: [SHELL_TOOL],
						thinking: this.thinkingParam(),
						output_config: this.config.effort
							? { effort: this.config.effort }
							: undefined,
						messages,
						cache_control: { type: "ephemeral" },
					},
					{ signal },
				);
				message = await stream.finalMessage();
			} catch (err) {
				if (signal.aborted) {
					exitReason =
						(signal.reason as AgentExitReason | undefined) ?? "timeout";
					break;
				}
				exitReason = "error";
				error =
					err instanceof Error ? `${err.name}: ${err.message}` : String(err);
				log({ t: Date.now(), type: "error", text: error });
				break;
			}
			turns += 1;
			const turnUsage: TokenUsage = {
				inputTokens: message.usage.input_tokens,
				outputTokens: message.usage.output_tokens,
				cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
				cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
			};
			usage = addUsage(usage, turnUsage);
			log({ t: Date.now(), type: "usage", turn: turns, usage: turnUsage });

			for (const block of message.content) {
				if (block.type === "text") {
					finalMessage = block.text;
					log({ t: Date.now(), type: "assistant", text: block.text });
				} else if (block.type === "thinking" && block.thinking) {
					log({ t: Date.now(), type: "thinking", text: block.thinking });
				}
			}
			messages.push({ role: "assistant", content: message.content });

			if (message.stop_reason === "refusal") {
				exitReason = "refusal";
				break;
			}
			if (message.stop_reason === "pause_turn") continue;
			if (message.stop_reason === "max_tokens") {
				// Let the model continue; the partial assistant turn is already in history.
				messages.push({ role: "user", content: "Continue." });
				continue;
			}
			const toolUses = message.content.filter(
				(b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
			);
			if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
				exitReason = "completed";
				break;
			}

			const results: Anthropic.ToolResultBlockParam[] = [];
			for (const use of toolUses) {
				toolCalls += 1;
				log({
					t: Date.now(),
					type: "tool_call",
					id: use.id,
					name: use.name,
					input: use.input,
				});
				const result = await runShellTool(use, cluster, input, log);
				results.push(result);
				if (signal.aborted) break;
			}
			messages.push({ role: "user", content: results });
		}

		return {
			exitReason,
			finalMessage,
			usage,
			reportedCostUsd: null,
			turns,
			toolCalls,
			model: this.model,
			error,
		};
	}
}

async function runShellTool(
	use: Anthropic.ToolUseBlock,
	cluster: ClusterProvider,
	input: AgentRunInput,
	log: (e: TranscriptEvent) => void,
): Promise<Anthropic.ToolResultBlockParam> {
	const raw = use.input as { script?: unknown; timeout_seconds?: unknown };
	if (use.name !== "shell" || typeof raw.script !== "string") {
		log({
			t: Date.now(),
			type: "tool_result",
			id: use.id,
			exitCode: null,
			output: "invalid tool input",
			durationMs: 0,
		});
		return {
			type: "tool_result",
			tool_use_id: use.id,
			is_error: true,
			content: `Unknown tool or invalid input: ${use.name}`,
		};
	}
	const requested =
		typeof raw.timeout_seconds === "number" && raw.timeout_seconds > 0
			? raw.timeout_seconds * 1000
			: input.commandTimeoutMs;
	const timeoutMs = Math.min(requested, input.commandTimeoutMs);
	const r = await cluster.exec(raw.script, { timeoutMs, signal: input.signal });
	const combined = [r.stdout, r.stderr]
		.filter((s) => s.length > 0)
		.join("\n--- stderr ---\n");
	log({
		t: Date.now(),
		type: "tool_result",
		id: use.id,
		exitCode: r.code,
		output: combined,
		durationMs: r.durationMs,
	});
	const limit = 30_000;
	const shown =
		combined.length > limit
			? `${combined.slice(0, limit)}\n[... truncated ${combined.length - limit} characters]`
			: combined;
	const status = r.timedOut
		? `(command timed out after ${Math.round(timeoutMs / 1000)}s)`
		: `(exit code ${r.code})`;
	return {
		type: "tool_result",
		tool_use_id: use.id,
		is_error: r.code !== 0,
		content: `${shown}\n${status}`.trim(),
	};
}
