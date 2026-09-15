import { EMPTY_USAGE, type TokenUsage } from "../pricing.ts";
import type {
	Agent,
	AgentConfigBase,
	AgentRunInput,
	AgentRunOutput,
} from "./types.ts";

export interface FakeAgentConfig extends AgentConfigBase {
	type: "fake";
	/** Scripts to run on the node in order, with an optional delay before each. */
	steps?: Array<{ script: string; delayMs?: number }>;
	usage?: Partial<TokenUsage>;
	/** If set, the agent never finishes on its own (tests the harness timeout). */
	hang?: boolean;
}

/** Deterministic scripted agent for tests. */
export class FakeAgent implements Agent {
	readonly type = "fake";
	readonly name: string;
	readonly model: string;

	constructor(private readonly config: FakeAgentConfig) {
		this.name = config.name;
		this.model = config.model ?? "fake-model";
	}

	async run(input: AgentRunInput): Promise<AgentRunOutput> {
		let toolCalls = 0;
		for (const step of this.config.steps ?? []) {
			if (input.signal.aborted) break;
			if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
			if (input.signal.aborted) break;
			toolCalls += 1;
			input.log({
				t: Date.now(),
				type: "tool_call",
				id: String(toolCalls),
				name: "shell",
				input: step,
			});
			const r = await input.cluster.exec(step.script, {
				timeoutMs: input.commandTimeoutMs,
				signal: input.signal,
			});
			input.log({
				t: Date.now(),
				type: "tool_result",
				id: String(toolCalls),
				exitCode: r.code,
				output: r.stdout + r.stderr,
				durationMs: r.durationMs,
			});
		}
		if (this.config.hang && !input.signal.aborted) {
			await new Promise<void>((resolve) =>
				input.signal.addEventListener("abort", () => resolve(), { once: true }),
			);
		}
		return {
			exitReason: input.signal.aborted
				? ((input.signal.reason as AgentRunOutput["exitReason"]) ?? "timeout")
				: "completed",
			finalMessage: "done",
			usage: { ...EMPTY_USAGE, ...this.config.usage },
			reportedCostUsd: null,
			turns: toolCalls,
			toolCalls,
			model: this.model,
		};
	}
}
