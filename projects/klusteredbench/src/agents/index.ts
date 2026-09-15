import { BuiltinAgent, type BuiltinAgentConfig } from "./builtin.ts";
import { ClaudeCodeAgent, type ClaudeCodeAgentConfig } from "./claude-code.ts";
import { CommandAgent, type CommandAgentConfig } from "./command.ts";
import { FakeAgent, type FakeAgentConfig } from "./fake.ts";
import type { Agent } from "./types.ts";

export type AgentConfig =
	| BuiltinAgentConfig
	| ClaudeCodeAgentConfig
	| CommandAgentConfig
	| FakeAgentConfig;

export function createAgent(config: AgentConfig): Agent {
	switch (config.type) {
		case "builtin":
			return new BuiltinAgent(config);
		case "claude-code":
			return new ClaudeCodeAgent(config);
		case "command":
			return new CommandAgent(config);
		case "fake":
			return new FakeAgent(config);
		default:
			throw new Error(
				`Unknown agent type: ${(config as { type: string }).type}`,
			);
	}
}

export type {
	Agent,
	AgentExitReason,
	AgentRunInput,
	AgentRunOutput,
	TranscriptEvent,
} from "./types.ts";
