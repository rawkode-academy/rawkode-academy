import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BenchConfig } from "./config.ts";
import { createProvider } from "./providers/index.ts";
import type { Scenario } from "./scenario.ts";
import { renderScript } from "./scenario.ts";

export interface ValidationResult {
	scenario: string;
	ok: boolean;
	steps: Array<{
		step: string;
		ok: boolean;
		durationMs: number;
		output: string;
	}>;
}

/**
 * A scenario is admissible only if, on a fresh cluster:
 *   setup passes, verify passes (baseline is green),
 *   break passes, verify FAILS (the break bites),
 *   solve passes, verify PASSES (the reference fix works),
 *   invariants pass after solve (if defined).
 * Anything else means the scenario would produce meaningless numbers.
 */
export async function validateScenario(
	scenario: Scenario,
	config: Pick<BenchConfig, "provider">,
	outDir: string,
	say: (line: string) => void = () => {},
): Promise<ValidationResult> {
	const cluster = createProvider(config.provider);
	const steps: ValidationResult["steps"] = [];
	const dir = join(outDir, scenario.id);
	await mkdir(dir, { recursive: true });
	const step = async (
		name: string,
		kind: Parameters<typeof renderScript>[1],
		expectOk: boolean,
	) => {
		const script = renderScript(scenario, kind);
		if (script === null) {
			steps.push({
				step: name,
				ok: false,
				durationMs: 0,
				output: `no ${kind} script`,
			});
			return false;
		}
		const r = await cluster.exec(script, { timeoutMs: 15 * 60_000 });
		const passed = r.code === 0 && !r.timedOut;
		const ok = passed === expectOk;
		steps.push({
			step: name,
			ok,
			durationMs: r.durationMs,
			output: `${r.stdout}\n${r.stderr}`.trim().slice(-4000),
		});
		say(
			`  ${ok ? "ok  " : "FAIL"} ${name} (${Math.round(r.durationMs / 1000)}s)`,
		);
		return ok;
	};
	let ok = false;
	try {
		say(`[validate ${scenario.id}] creating cluster`);
		await cluster.create(`kb-validate-${scenario.id}`.slice(0, 60));
		ok =
			(await step("setup", "setup", true)) &&
			(await step("verify after setup is green", "verify", true)) &&
			(await step("break", "break", true)) &&
			(await step("verify after break is red", "verify", false)) &&
			(await step("solve", "solve", true)) &&
			(await step("verify after solve is green", "verify", true)) &&
			(scenario.scripts.invariants === null ||
				(await step("invariants after solve", "invariants", true)));
	} catch (err) {
		steps.push({
			step: "cluster",
			ok: false,
			durationMs: 0,
			output: String(err),
		});
		ok = false;
	} finally {
		await cluster.destroy();
	}
	return { scenario: scenario.id, ok, steps };
}
