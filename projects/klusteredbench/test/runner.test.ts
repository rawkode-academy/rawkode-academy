import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FakeAgent } from "../src/agents/fake.ts";
import { runTrial } from "../src/runner.ts";
import { loadScenario } from "../src/scenario.ts";
import { FIXTURES, fakeConfig, tmp } from "./helpers.ts";

const scenario = () => loadScenario(join(FIXTURES, "file-missing"), FIXTURES);

describe("runTrial", () => {
	it("records time-to-green from the harness poller, not the agent", async () => {
		const dir = await tmp();
		const agent = new FakeAgent({
			name: "fixer",
			type: "fake",
			steps: [
				{ script: "ls $KB_STATE" },
				{ delayMs: 300, script: 'touch "$KB_STATE/app"' },
				{ delayMs: 400, script: "true" },
			],
			usage: { inputTokens: 2000, outputTokens: 100 },
		});
		const r = await runTrial({
			runId: "t",
			scenario: await scenario(),
			agent,
			trial: 1,
			config: fakeConfig(),
			dir,
		});
		expect(r.error).toBeNull();
		expect(r.success).toBe(true);
		expect(r.greenAtEnd).toBe(true);
		expect(r.invariantsPassed).toBe(true);
		expect(r.exitReason).toBe("completed");
		expect(r.timeToGreenMs).not.toBeNull();
		// Green was detected while the agent was still running its third step.
		expect(r.timeToGreenMs as number).toBeLessThan(r.agentWallMs);
		expect(r.toolCalls).toBe(3);
		expect(r.totalTokens).toBe(2100);
		expect(r.estimatedCostUsd).toBeNull(); // fake-model has no price
		expect(r.verifySamples.some((s) => s.passed)).toBe(true);

		const written = JSON.parse(
			await readFile(join(dir, "result.json"), "utf8"),
		);
		expect(written.success).toBe(true);
		const transcript = await readFile(join(dir, "transcript.jsonl"), "utf8");
		expect(transcript).toContain('"type":"tool_call"');
		expect(transcript).toContain('"type":"verify"');
	});

	it("times out an agent that never finishes and marks the trial failed", async () => {
		const dir = await tmp();
		const agent = new FakeAgent({ name: "hanger", type: "fake", hang: true });
		const r = await runTrial({
			runId: "t",
			scenario: await scenario(),
			agent,
			trial: 1,
			config: fakeConfig({ timeoutMs: 500 }),
			dir,
		});
		expect(r.exitReason).toBe("timeout");
		expect(r.success).toBe(false);
		expect(r.timeToGreenMs).toBeNull();
		// scenario.yaml says 2s, which wins over the 500ms bench default.
		expect(r.agentWallMs).toBeGreaterThanOrEqual(1_900);
		expect(r.agentWallMs).toBeLessThan(3_500);
	});

	it("distinguishes fixed-then-broke-again from never-fixed", async () => {
		const dir = await tmp();
		const agent = new FakeAgent({
			name: "flaky",
			type: "fake",
			steps: [
				{ script: 'touch "$KB_STATE/app"' },
				{ delayMs: 350, script: 'rm "$KB_STATE/app"' },
			],
		});
		const r = await runTrial({
			runId: "t",
			scenario: await scenario(),
			agent,
			trial: 1,
			config: fakeConfig(),
			dir,
		});
		expect(r.timeToGreenMs).not.toBeNull();
		expect(r.greenAtEnd).toBe(false);
		expect(r.success).toBe(false);
	});

	it("fails the trial when invariants are violated even if verify passes", async () => {
		const dir = await tmp();
		const agent = new FakeAgent({
			name: "vandal",
			type: "fake",
			steps: [{ script: 'rm "$KB_STATE/db"; touch "$KB_STATE/app"' }],
		});
		const r = await runTrial({
			runId: "t",
			scenario: await scenario(),
			agent,
			trial: 1,
			config: fakeConfig(),
			dir,
		});
		expect(r.greenAtEnd).toBe(true);
		expect(r.invariantsPassed).toBe(false);
		expect(r.success).toBe(false);
	});

	it("stops the agent early when stopOnGreen is set", async () => {
		const dir = await tmp();
		const agent = new FakeAgent({
			name: "slow",
			type: "fake",
			steps: [{ script: 'touch "$KB_STATE/app"' }],
			hang: true,
		});
		const r = await runTrial({
			runId: "t",
			scenario: await scenario(),
			agent,
			trial: 1,
			config: fakeConfig({ stopOnGreen: true, timeoutMs: 5_000 }),
			dir,
		});
		expect(r.exitReason).toBe("stopped_on_green");
		expect(r.success).toBe(true);
		expect(r.agentWallMs).toBeLessThan(2_000);
	});

	it("refuses to run a scenario whose break does not bite", async () => {
		const dir = await tmp();
		const s = await loadScenario(
			join(FIXTURES, "break-does-nothing"),
			FIXTURES,
		);
		const r = await runTrial({
			runId: "t",
			scenario: s,
			agent: new FakeAgent({ name: "noop", type: "fake" }),
			trial: 1,
			config: fakeConfig(),
			dir,
		});
		expect(r.error).toMatch(/not broken/);
		expect(r.success).toBe(false);
	});
});
