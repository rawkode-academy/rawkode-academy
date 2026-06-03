import { describe, expect, test } from "bun:test";
import { buildNova3Input, correctTranscriptText } from "./nova3";

describe("buildNova3Input", () => {
	test("preserves keyterms as repeated runtime values", () => {
		const input = buildNova3Input({
			audioBody: {},
			contentType: "audio/mpeg",
			language: "en",
			keyterms: ["Rawkode", "Rawkode Academy", "Yoke", "ArgoCD"],
		});

		expect(input.keyterm).toEqual([
			"Rawkode",
			"Rawkode Academy",
			"Yoke",
			"ArgoCD",
		]);
		expect(input.keyterm).not.toBe("Rawkode,Rawkode Academy,Yoke,ArgoCD");
	});

	test("keeps replacement terms list-shaped", () => {
		const input = buildNova3Input({
			audioBody: {},
			language: "en",
			keyterms: [],
		});

		expect(input.keyterm).toBeUndefined();
		expect(input.replace).toContain("rawcode:Rawkode");
		expect(input.replace).toContain("rockwood academy:Rawkode Academy");
	});

	test("applies deterministic Rawkode Academy transcript corrections", () => {
		expect(
			correctTranscriptText(
				"welcome back to the rockwood academy for another rockwood live",
			),
		).toBe(
			"welcome back to the Rawkode Academy for another Rawkode Live",
		);
	});

	test("applies deterministic technical transcript corrections", () => {
		expect(
			correctTranscriptText(
				"kupanitas with a loaded smile, wassom kicks in, timoni and argo cd",
			),
		).toBe(
			"Kubernetes with a loaded smile, Wasm kicks in, Timoni and ArgoCD",
		);
	});
});
