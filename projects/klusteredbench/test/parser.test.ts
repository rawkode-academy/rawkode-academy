import { describe, expect, it } from "vitest";
import { StreamJsonParser, shellQuote } from "../src/agents/claude-code.ts";
import type { TranscriptEvent } from "../src/agents/types.ts";

describe("StreamJsonParser", () => {
	it("mirrors assistant text, tool calls and the final result into the transcript", () => {
		const events: TranscriptEvent[] = [];
		const p = new StreamJsonParser((e) => events.push(e));
		const lines = [
			JSON.stringify({
				type: "system",
				subtype: "init",
				model: "claude-opus-5",
			}),
			JSON.stringify({
				type: "assistant",
				message: {
					content: [
						{ type: "text", text: "Looking at pods." },
						{
							type: "tool_use",
							id: "tu1",
							name: "Bash",
							input: { command: "kubectl get pods" },
						},
					],
					usage: {
						input_tokens: 100,
						output_tokens: 20,
						cache_read_input_tokens: 5,
					},
				},
			}),
			JSON.stringify({
				type: "user",
				message: {
					content: [
						{ type: "tool_result", tool_use_id: "tu1", content: "NAME READY" },
					],
				},
			}),
			JSON.stringify({
				type: "result",
				subtype: "success",
				is_error: false,
				result: "Fixed.",
				num_turns: 4,
				total_cost_usd: 0.42,
				usage: {
					input_tokens: 900,
					output_tokens: 80,
					cache_creation_input_tokens: 10,
					cache_read_input_tokens: 300,
				},
			}),
		];
		// Feed in awkward chunks to exercise line buffering.
		const blob = `${lines.join("\n")}\n`;
		p.feed(blob.slice(0, 40));
		p.feed(blob.slice(40, 200));
		p.feed(blob.slice(200));
		p.flush();

		expect(p.toolCalls).toBe(1);
		expect(p.assistantTurns).toBe(1);
		expect(p.result?.total_cost_usd).toBe(0.42);
		expect(p.result?.num_turns).toBe(4);
		expect(p.usage).toEqual({
			inputTokens: 900,
			outputTokens: 80,
			cacheWriteTokens: 10,
			cacheReadTokens: 300,
		});
		expect(events.map((e) => e.type)).toEqual([
			"raw",
			"assistant",
			"tool_call",
			"usage",
			"tool_result",
			"raw",
		]);
	});

	it("keeps non-JSON output as raw lines instead of throwing", () => {
		const events: TranscriptEvent[] = [];
		const p = new StreamJsonParser((e) => events.push(e));
		p.feed("warning: something\n{not json\n");
		p.flush();
		expect(events).toHaveLength(2);
		expect(events.every((e) => e.type === "raw")).toBe(true);
	});
});

describe("shellQuote", () => {
	it("survives single quotes and newlines", () => {
		const s = "it's\na test $HOME `x`";
		expect(shellQuote(s)).toBe("'it'\\''s\na test $HOME `x`'");
	});
});
