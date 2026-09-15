import { EMPTY_USAGE, type TokenUsage } from "../pricing.ts";
import { shellQuote } from "./claude-code.ts";
import { SYSTEM_PROMPT, userPrompt } from "./prompt.ts";
import type {
	Agent,
	AgentConfigBase,
	AgentExitReason,
	AgentRunInput,
	AgentRunOutput,
} from "./types.ts";

export interface CommandAgentConfig extends AgentConfigBase {
	type: "command";
	model: string;
	/** Bash executed on the node once per cluster, e.g. to install a CLI. */
	prepare?: string;
	/**
	 * Bash executed on the node to run the agent. Receives:
	 *   KB_PROMPT_FILE  - path to a file containing the task prompt
	 *   KB_SYSTEM_FILE  - path to a file containing the shared system prompt
	 *   KB_USAGE_FILE   - write JSON here: {"inputTokens","outputTokens","cacheWriteTokens","cacheReadTokens","costUsd","turns","toolCalls"}
	 *   KB_MODEL        - the configured model id
	 */
	command: string;
	/** Environment variable names to forward from the harness to the node. */
	forwardEnv?: string[];
}

/**
 * Escape hatch for any other CLI agent (Codex, Gemini CLI, OpenCode, a
 * homegrown loop). The command runs on the node; usage is whatever the
 * command writes to $KB_USAGE_FILE, so accuracy is the adapter author's problem.
 */
export class CommandAgent implements Agent {
	readonly type = "command";
	readonly name: string;
	readonly model: string;

	constructor(private readonly config: CommandAgentConfig) {
		this.name = config.name;
		this.model = config.model;
	}

	async prepare(
		cluster: Parameters<Agent["run"]>[0]["cluster"],
	): Promise<void> {
		if (!this.config.prepare) return;
		const r = await cluster.exec(this.config.prepare, {
			timeoutMs: 10 * 60_000,
		});
		if (r.code !== 0)
			throw new Error(`prepare failed for ${this.name}:\n${r.stderr}`);
	}

	async run(input: AgentRunInput): Promise<AgentRunOutput> {
		const env: Record<string, string> = { KB_MODEL: this.model };
		for (const name of this.config.forwardEnv ?? []) {
			const v = process.env[name];
			if (v !== undefined) env[name] = v;
		}
		const script = `
set -o pipefail
export KB_DIR=$(mktemp -d /tmp/kb.XXXXXX)
export KB_PROMPT_FILE="$KB_DIR/prompt.txt" KB_SYSTEM_FILE="$KB_DIR/system.txt" KB_USAGE_FILE="$KB_DIR/usage.json"
printf '%s' ${shellQuote(userPrompt(input.prompt))} > "$KB_PROMPT_FILE"
printf '%s' ${shellQuote(SYSTEM_PROMPT)} > "$KB_SYSTEM_FILE"
${this.config.command}
rc=$?
echo "__KB_USAGE_BEGIN__"
cat "$KB_USAGE_FILE" 2>/dev/null
echo
echo "__KB_USAGE_END__"
exit $rc
`;
		const r = await input.cluster.exec(script, {
			env,
			signal: input.signal,
			timeoutMs: input.budgetMs + 30_000,
			onStdout: (chunk) =>
				input.log({ t: Date.now(), type: "raw", data: chunk }),
		});
		const m = /__KB_USAGE_BEGIN__\n([\s\S]*?)\n__KB_USAGE_END__/.exec(r.stdout);
		let usage: TokenUsage = EMPTY_USAGE;
		let cost: number | null = null;
		let turns = 0;
		let toolCalls = 0;
		if (m?.[1]?.trim()) {
			try {
				const j = JSON.parse(m[1]) as Partial<TokenUsage> & {
					costUsd?: number;
					turns?: number;
					toolCalls?: number;
				};
				usage = {
					inputTokens: j.inputTokens ?? 0,
					outputTokens: j.outputTokens ?? 0,
					cacheWriteTokens: j.cacheWriteTokens ?? 0,
					cacheReadTokens: j.cacheReadTokens ?? 0,
				};
				cost = j.costUsd ?? null;
				turns = j.turns ?? 0;
				toolCalls = j.toolCalls ?? 0;
			} catch (err) {
				input.log({
					t: Date.now(),
					type: "error",
					text: `usage file is not JSON: ${String(err)}`,
				});
			}
		}
		let exitReason: AgentExitReason = "completed";
		if (input.signal.aborted) {
			exitReason =
				(input.signal.reason as AgentExitReason | undefined) ?? "timeout";
		} else if (r.code !== 0) {
			exitReason = "error";
		}
		return {
			exitReason,
			finalMessage: null,
			usage,
			reportedCostUsd: cost,
			turns,
			toolCalls,
			model: this.model,
			error:
				r.code !== 0 && !input.signal.aborted
					? r.stderr.slice(-2000)
					: undefined,
		};
	}
}
