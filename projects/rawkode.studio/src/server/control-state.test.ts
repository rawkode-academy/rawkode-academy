import { describe, expect, it } from "vitest";
import type { StudioEnv, StudioUser } from "../env";
import { createInitialStudioState } from "../studio/seed";
import { reduceStudioState } from "../studio/studioMachine";
import type { StudioState } from "../types";
import {
	getStudioControlState,
	isStudioControlState,
	removeOwnedLocalStudioSources,
	saveStudioControlState,
	serializeStudioControlState,
	StudioControlStateError,
} from "./control-state";

const user: StudioUser = {
	id: "producer-1",
	email: "producer@example.com",
	name: "Producer",
	image: null,
	username: "producer",
};

describe("Studio control state", () => {
	it("accepts and serializes the seeded programme state", () => {
		const state = createInitialStudioState();

		expect(isStudioControlState(state)).toBe(true);
		expect(JSON.parse(serializeStudioControlState(state))).toEqual(state);
	});

	it("validates bounded authoritative audio mix controls", () => {
		const state = createInitialStudioState();
		state.audioMix["source-realtimekit-camera-studio-guest-alice"] = {
			gain: 1.25,
			muted: true,
		};

		expect(isStudioControlState(state)).toBe(true);
		expect(() => serializeStudioControlState(state)).not.toThrow();

		state.audioMix["source-realtimekit-camera-studio-guest-alice"].gain = 2.01;
		expect(isStudioControlState(state)).toBe(false);
		expect(() => serializeStudioControlState(state)).toThrow(StudioControlStateError);
	});

	it("migrates stored snapshots without audioMix but rejects new payloads without it", async () => {
		const legacyState: Partial<StudioState> = createInitialStudioState();
		delete legacyState.audioMix;
		const database = createControlStateDatabase({
			changes: 0,
			latestRevision: 1,
			latestState: legacyState as StudioState,
		});

		expect(isStudioControlState(legacyState)).toBe(false);
		expect(() => serializeStudioControlState(legacyState)).toThrow(StudioControlStateError);
		await expect(getStudioControlState(
			{ STUDIO_DB: database.db } as StudioEnv,
			"session-1",
		)).resolves.toMatchObject({
			revision: 1,
			state: { audioMix: {} },
		});
	});

	it("rejects non-finite layer geometry", () => {
		const state = createInitialStudioState();
		state.layers[0] = {
			...state.layers[0],
			bounds: { ...state.layers[0].bounds, width: Number.POSITIVE_INFINITY },
		};

		expect(isStudioControlState(state)).toBe(false);
		expect(() => serializeStudioControlState(state)).toThrow(StudioControlStateError);
	});

	it("rejects duplicate identities and dangling scene references", () => {
		const duplicateLayerState = createInitialStudioState();
		duplicateLayerState.layers[1] = {
			...duplicateLayerState.layers[1],
			id: duplicateLayerState.layers[0].id,
		};
		const danglingSceneState = createInitialStudioState();
		danglingSceneState.scenes[0] = {
			...danglingSceneState.scenes[0],
			layerIds: [...danglingSceneState.scenes[0].layerIds, "missing-layer"],
		};

		expect(isStudioControlState(duplicateLayerState)).toBe(false);
		expect(isStudioControlState(danglingSceneState)).toBe(false);
	});

	it("rejects a programme selection outside the scene document", () => {
		const state = createInitialStudioState();
		state.programSceneId = "missing-scene";

		expect(isStudioControlState(state)).toBe(false);
	});

	it("accepts a reconciled arbitrary participant snapshot", () => {
		const state = reduceStudioState(createInitialStudioState(), {
			type: "sources.reconcile",
			sources: [
				{
					id: "source-host-camera",
					name: "Host",
					type: "camera",
					status: "ready",
					roles: ["hosts"],
				},
				...Array.from({ length: 4 }, (_, index) => ({
					id: `source-guest-${index + 1}`,
					name: `Guest ${index + 1}`,
					type: "camera" as const,
					status: "ready" as const,
					roles: ["guests" as const],
				})),
			],
		});

		expect(isStudioControlState(state)).toBe(true);
		expect(() => serializeStudioControlState(state)).not.toThrow();
	});

	it.each([
		{
			name: "an overlay without a lifecycle",
			poison(state: StudioState) {
				const layerId = state.layers[0].id;
				state.activeOverlays[layerId] = {
					layerId,
					phase: "visible",
				} as StudioState["activeOverlays"][string];
			},
		},
		{
			name: "a stinger without an effect",
			poison(state: StudioState) {
				state.activeStinger = {
					fromSceneId: state.programSceneId,
					toSceneId: state.previewSceneId,
				} as StudioState["activeStinger"];
			},
		},
		{
			name: "an unknown scene layout",
			poison(state: StudioState) {
				state.scenes[0].layout = "teleprompter" as StudioState["scenes"][number]["layout"];
			},
		},
		{
			name: "an invalid scene transition",
			poison(state: StudioState) {
				state.scenes[0].stinger = {
					kind: "motion-transition",
					transition: "teleport",
				} as unknown as StudioState["scenes"][number]["stinger"];
			},
		},
		{
			name: "an unknown layer type",
			poison(state: StudioState) {
				state.layers[0].type = "shader" as StudioState["layers"][number]["type"];
			},
		},
		{
			name: "an invalid source role",
			poison(state: StudioState) {
				state.sources[0].roles = ["owner"] as never;
			},
		},
		{
			name: "non-finite nested settings",
			poison(state: StudioState) {
				state.sources[0].settings = { gain: Number.NaN };
			},
		},
	])("rejects poison state containing $name", ({ poison }) => {
		const state = createInitialStudioState();
		poison(state);

		expect(isStudioControlState(state)).toBe(false);
		expect(() => serializeStudioControlState(state)).toThrow(StudioControlStateError);
	});

	it("returns the exact snapshot committed by a successful compare-and-set", async () => {
		const committedState = createInitialStudioState();
		committedState.status = "Committed by this request";
		const interveningState = createInitialStudioState();
		interveningState.status = "Committed later by another producer";
		const database = createControlStateDatabase({
			changes: 1,
			latestRevision: 3,
			latestState: interveningState,
		});

		const result = await saveStudioControlState(
			{ STUDIO_DB: database.db } as StudioEnv,
			user,
			{
				expectedRevision: 1,
				sessionId: "session-1",
				state: committedState,
			},
		);

		expect(result).toMatchObject({
			saved: true,
			snapshot: {
				revision: 2,
				state: committedState,
				updatedBy: "producer",
			},
		});
		expect(database.getReadCount()).toBe(0);
	});

	it("returns the latest authoritative snapshot after a compare-and-set conflict", async () => {
		const attemptedState = createInitialStudioState();
		attemptedState.status = "Rejected local state";
		const authoritativeState = createInitialStudioState();
		authoritativeState.status = "Authoritative remote state";
		const database = createControlStateDatabase({
			changes: 0,
			latestRevision: 4,
			latestState: authoritativeState,
		});

		const result = await saveStudioControlState(
			{ STUDIO_DB: database.db } as StudioEnv,
			user,
			{
				expectedRevision: 2,
				sessionId: "session-1",
				state: attemptedState,
			},
		);

		expect(result).toMatchObject({
			saved: false,
			snapshot: {
				revision: 4,
				state: authoritativeState,
			},
		});
		expect(database.getReadCount()).toBe(1);
	});

	it("removes only screen sources owned by the unloading producer tab", () => {
		const state = reduceStudioState(createInitialStudioState(), {
			type: "sources.reconcile",
			sources: [
				{
					id: "screen-this-tab",
					name: "This tab",
					status: "ready",
					type: "screen",
					settings: { runtimeOwnerId: "owner-this-tab", runtimeSource: "local" },
				},
				{
					id: "screen-other-tab",
					name: "Other tab",
					status: "ready",
					type: "screen",
					settings: { runtimeOwnerId: "owner-other-tab", runtimeSource: "local" },
				},
			],
		});

		const cleaned = removeOwnedLocalStudioSources(
			state,
			"owner-this-tab",
			["screen-this-tab", "screen-other-tab"],
		);

		expect(cleaned.sources.some((source) => source.id === "screen-this-tab")).toBe(false);
		expect(cleaned.sources.some((source) => source.id === "screen-other-tab")).toBe(true);
		expect(cleaned.layers.some((layer) => layer.sourceId === "screen-this-tab")).toBe(false);
		expect(
			removeOwnedLocalStudioSources(cleaned, "owner-this-tab", ["screen-other-tab"]),
		).toBe(cleaned);
	});
});

function createControlStateDatabase(input: {
	changes: number;
	latestRevision: number;
	latestState: StudioState;
}): { db: D1Database; getReadCount(): number } {
	let readCount = 0;
	const db = {
		prepare() {
			const statement = {
				bind() {
					return statement;
				},
				async first() {
					readCount += 1;
					return {
						revision: input.latestRevision,
						state_json: JSON.stringify(input.latestState),
						updated_at: 123,
						updated_by_github: "other-producer",
						updated_by_id: "producer-2",
					};
				},
				async run() {
					return {
						success: true,
						meta: { changes: input.changes },
					};
				},
			};
			return statement;
		},
	} as unknown as D1Database;

	return {
		db,
		getReadCount: () => readCount,
	};
}
