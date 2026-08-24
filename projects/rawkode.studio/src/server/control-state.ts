import type { StudioEnv, StudioUser } from "../env";
import type {
	Bounds,
	LayerSettings,
	OverlayLifecycle,
	OverlayTransitionEffect,
	SceneAction,
	SceneSwitchEffect,
	StudioLayer,
	StudioScene,
	StudioSource,
	StudioState,
} from "../types";
import { STUDIO_SCENE_DEFINITIONS } from "../studio/seed";
import { reconcileStudioSources } from "../studio/sourceReconciliation";
import {
	getStudioSession,
	getStudioUserGithubHandle,
	getStudioUserId,
	userCanManageStudioSession,
} from "./studio";

const maximumControlStateBytes = 256 * 1024;
const maximumScenes = 100;
const maximumLayers = 500;
const maximumSources = 500;
const maximumAudioMixSources = 1_000;
const maximumIdLength = 256;
const maximumNameLength = 1_000;
const maximumEffectDurationSeconds = 60 * 60;
const maximumSceneActions = 100;

const layerTypes = new Set([
	"audio",
	"background",
	"camera",
	"html",
	"remotion",
	"screen",
	"video",
]);
const sourceTypes = new Set([
	"audio",
	"browser",
	"camera",
	"comment",
	"graphic",
	"html",
	"remotion",
	"screen",
	"video",
]);
const sourceStatuses = new Set(["loading", "missing", "muted", "ready"]);
const peopleRoles = new Set(["guests", "hosts", "producer"]);
const sceneLayouts = new Set(["dynamic-grid", "freeform", "remotion", "screenshare", "solo"]);
const sceneTransitions = new Set([
	"blur",
	"cube-spin",
	"cut",
	"fade",
	"flip",
	"glitch",
	"pop",
	"scale",
	"slide",
	"typewriter",
	"wipe",
]);
const transitionAxes = new Set(["x", "y"]);
const transitionDirections = new Set(["down", "left", "right", "up"]);
const overlayRoles = new Set(["banner", "comment", "lower-third", "ticker"]);
const remotionCompositionIds = new Set(["rawkode-intro", "rawkode-outro"]);

interface StudioControlStateRow {
	revision: number;
	state_json: string;
	updated_at: number;
	updated_by_github: string | null;
	updated_by_id: string;
}

export interface StudioControlStateSnapshot {
	revision: number;
	state: StudioState | null;
	updatedAt: number | null;
	updatedBy: string | null;
}

export class StudioControlStateError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export async function requireStudioControlAccess(
	env: StudioEnv,
	user: StudioUser,
	sessionId: string,
): Promise<void> {
	const session = await getStudioSession(env, sessionId);
	if (!session) {
		throw new StudioControlStateError(404, "Studio session not found.");
	}
	if (!(await userCanManageStudioSession(env, session, user))) {
		throw new StudioControlStateError(
			403,
			"Studio session management access is required.",
		);
	}
}

export async function getStudioControlState(
	env: StudioEnv,
	sessionId: string,
): Promise<StudioControlStateSnapshot> {
	const db = requireControlStateDatabase(env);
	const row = await db
		.prepare(
			`SELECT revision,
			        state_json,
			        updated_by_id,
			        updated_by_github,
			        updated_at
			   FROM studio_control_state
			  WHERE session_id = ?`,
		)
		.bind(sessionId)
		.first<StudioControlStateRow>();

	return row ? rowToSnapshot(row) : emptyStudioControlState();
}

export async function saveStudioControlState(
	env: StudioEnv,
	user: StudioUser,
	input: {
		expectedRevision: number;
		sessionId: string;
		state: unknown;
	},
): Promise<{ saved: boolean; snapshot: StudioControlStateSnapshot }> {
	if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
		throw new StudioControlStateError(
			400,
			"expectedRevision must be a non-negative integer.",
		);
	}

	const serializedState = serializeStudioControlState(input.state);
	const db = requireControlStateDatabase(env);
	const userId = getStudioUserId(user);
	const githubHandle = getStudioUserGithubHandle(user);
	const updatedAt = Math.floor(Date.now() / 1000);
	let result: D1Result;

	if (input.expectedRevision === 0) {
		result = await db
			.prepare(
				`INSERT OR IGNORE INTO studio_control_state (
					session_id,
					revision,
					state_json,
					updated_by_id,
					updated_by_github,
					updated_at
				) VALUES (?, 1, ?, ?, ?, ?)`,
			)
			.bind(
				input.sessionId,
				serializedState,
				userId,
				githubHandle,
				updatedAt,
			)
			.run();
	} else {
		result = await db
			.prepare(
				`UPDATE studio_control_state
				    SET revision = revision + 1,
				        state_json = ?,
				        updated_by_id = ?,
				        updated_by_github = ?,
				        updated_at = ?
				  WHERE session_id = ?
				    AND revision = ?`,
			)
			.bind(
				serializedState,
				userId,
				githubHandle,
				updatedAt,
				input.sessionId,
				input.expectedRevision,
			)
			.run();
	}

	const saved = result.success && result.meta.changes === 1;
	if (saved) {
		return {
			saved: true,
			snapshot: {
				revision: input.expectedRevision + 1,
				state: JSON.parse(serializedState) as StudioState,
				updatedAt,
				updatedBy: githubHandle ?? userId,
			},
		};
	}

	return {
		saved: false,
		snapshot: await getStudioControlState(env, input.sessionId),
	};
}

export async function removeOwnedStudioControlSources(
	env: StudioEnv,
	user: StudioUser,
	input: {
		ownerId: string;
		sessionId: string;
		sourceIds: string[];
	},
): Promise<StudioControlStateSnapshot> {
	if (!isNonEmptyBoundedString(input.ownerId, maximumIdLength)) {
		throw new StudioControlStateError(400, "ownerId is invalid.");
	}
	if (
		!Array.isArray(input.sourceIds) ||
		input.sourceIds.length > maximumSources ||
		!input.sourceIds.every(isId) ||
		new Set(input.sourceIds).size !== input.sourceIds.length
	) {
		throw new StudioControlStateError(400, "sourceIds are invalid.");
	}

	let snapshot = await getStudioControlState(env, input.sessionId);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		if (!snapshot.state) {
			return snapshot;
		}
		const nextState = removeOwnedLocalStudioSources(
			snapshot.state,
			input.ownerId,
			input.sourceIds,
		);
		if (nextState === snapshot.state) {
			return snapshot;
		}

		const result = await saveStudioControlState(env, user, {
			expectedRevision: snapshot.revision,
			sessionId: input.sessionId,
			state: nextState,
		});
		if (result.saved) {
			return result.snapshot;
		}
		snapshot = result.snapshot;
	}

	throw new StudioControlStateError(
		409,
		"Studio control state kept changing while local sources were removed.",
	);
}

export function removeOwnedLocalStudioSources(
	state: StudioState,
	ownerId: string,
	sourceIds: readonly string[],
): StudioState {
	const requestedSourceIds = new Set(sourceIds);
	const removableSourceIds = state.sources
		.filter((source) =>
			requestedSourceIds.has(source.id) &&
			source.type === "screen" &&
			source.settings?.runtimeSource === "local" &&
			source.settings.runtimeOwnerId === ownerId
		)
		.map((source) => source.id);
	if (removableSourceIds.length === 0) {
		return state;
	}

	return reconcileStudioSources(state, [], STUDIO_SCENE_DEFINITIONS, {
		removeSourceIds: removableSourceIds,
	});
}

export function serializeStudioControlState(value: unknown): string {
	if (!isJsonCompatible(value) || !isStudioControlState(value)) {
		throw new StudioControlStateError(400, "Studio control state is invalid.");
	}

	const serialized = JSON.stringify(value);
	if (new TextEncoder().encode(serialized).byteLength > maximumControlStateBytes) {
		throw new StudioControlStateError(
			413,
			"Studio control state exceeds the 256 KiB limit.",
		);
	}
	return serialized;
}

export function isStudioControlState(value: unknown): value is StudioState {
	if (!isRecord(value)) return false;
	if (!isResolution(value.resolution)) return false;
	if (!isId(value.activeScreenShareSourceId)) return false;
	if (!isAudioMix(value.audioMix)) return false;
	if (!isStudioPhase(value.phase)) return false;
	if (!isId(value.previewSceneId)) return false;
	if (!isId(value.programSceneId)) return false;
	if (!isId(value.selectedLayerId)) return false;
	if (!isBoundedString(value.htmlDraft, maximumControlStateBytes)) return false;
	if (!isBoundedString(value.status, 2_000)) return false;
	if (!isOptionalBoundedString(value.lastHookId, maximumIdLength, true)) return false;
	if (typeof value.isPlaying !== "boolean" || typeof value.isRecording !== "boolean") return false;
	if (!isRecord(value.lowerThird)) return false;
	if (!isBoundedString(value.lowerThird.speaker, 500)) return false;
	if (!isBoundedString(value.lowerThird.comment, 5_000)) return false;
	if (!Array.isArray(value.scenes) || value.scenes.length > maximumScenes) return false;
	if (!Array.isArray(value.layers) || value.layers.length > maximumLayers) return false;
	if (!Array.isArray(value.sources) || value.sources.length > maximumSources) return false;
	if (!value.layers.every(isStudioLayer)) return false;
	if (!value.scenes.every(isStudioScene) || !value.sources.every(isStudioSource)) return false;
	if (!hasUniqueIds(value.scenes) || !hasUniqueIds(value.layers) || !hasUniqueIds(value.sources)) {
		return false;
	}

	const sceneIds = new Set(
		value.scenes
			.filter(isRecord)
			.map((scene) => scene.id)
			.filter(isNonEmptyString),
	);
	if (sceneIds.size !== value.scenes.length) return false;
	if (!sceneIds.has(value.previewSceneId) || !sceneIds.has(value.programSceneId)) return false;

	const layerIds = new Set(value.layers.map((layer) => layer.id));
	if (!layerIds.has(value.selectedLayerId)) return false;
	for (const scene of value.scenes) {
		if (!isRecord(scene) || !Array.isArray(scene.layerIds)) return false;
		if (!scene.layerIds.every((id) => isNonEmptyString(id) && layerIds.has(id))) return false;
	}
	if (!isRecord(value.activeOverlays)) return false;
	for (const [layerId, overlay] of Object.entries(value.activeOverlays)) {
		if (
			!layerIds.has(layerId) ||
				!isRecord(overlay) ||
				overlay.layerId !== layerId ||
				!isOverlayPhase(overlay.phase) ||
				!isOverlayLifecycle(overlay.lifecycle) ||
				!isOptionalGeneration(overlay.generation)
		) {
			return false;
		}
	}
	if (value.activeStinger !== undefined) {
		if (
			!isRecord(value.activeStinger) ||
				!isNonEmptyString(value.activeStinger.fromSceneId) ||
				!isNonEmptyString(value.activeStinger.toSceneId) ||
				!sceneIds.has(value.activeStinger.fromSceneId) ||
				!sceneIds.has(value.activeStinger.toSceneId) ||
				!isSceneSwitchEffect(value.activeStinger.effect) ||
				!isOptionalGeneration(value.activeStinger.generation)
		) {
			return false;
		}
	}
	if (!isOptionalGeneration(value.lifecycleGeneration)) return false;

	return true;
}

function emptyStudioControlState(): StudioControlStateSnapshot {
	return {
		revision: 0,
		state: null,
		updatedAt: null,
		updatedBy: null,
	};
}

function rowToSnapshot(row: StudioControlStateRow): StudioControlStateSnapshot {
	let state: unknown;
	try {
		state = JSON.parse(row.state_json);
	} catch {
		throw new StudioControlStateError(500, "Stored Studio control state is unreadable.");
	}
	state = normalizeStoredStudioControlState(state);
	if (!isStudioControlState(state)) {
		throw new StudioControlStateError(500, "Stored Studio control state is invalid.");
	}

	return {
		revision: row.revision,
		state,
		updatedAt: row.updated_at,
		updatedBy: row.updated_by_github ?? row.updated_by_id,
	};
}

export function normalizeStoredStudioControlState(value: unknown): unknown {
	if (!isRecord(value) || value.audioMix !== undefined) {
		return value;
	}

	return {
		...value,
		audioMix: {},
	};
}

function isAudioMix(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const entries = Object.entries(value);
	if (entries.length > maximumAudioMixSources) return false;

	return entries.every(([sourceId, control]) =>
		isId(sourceId) &&
		isRecord(control) &&
		Object.keys(control).length === 2 &&
		Object.hasOwn(control, "gain") &&
		Object.hasOwn(control, "muted") &&
		typeof control.muted === "boolean" &&
		isFiniteNumber(control.gain) &&
		control.gain >= 0 &&
		control.gain <= 2
	);
}

function requireControlStateDatabase(env: StudioEnv): D1Database {
	if (!env.STUDIO_DB) {
		throw new StudioControlStateError(
			503,
			"STUDIO_DB binding is required to persist Studio control state.",
		);
	}
	return env.STUDIO_DB;
}

function isStudioLayer(value: unknown): value is StudioLayer {
	if (!isRecord(value)) return false;
	if (!isId(value.id) || !isNonEmptyBoundedString(value.name, maximumNameLength)) return false;
	if (typeof value.type !== "string" || !layerTypes.has(value.type)) return false;
	if (!isOptionalBoundedString(value.sourceId, maximumIdLength, true)) return false;
	if (typeof value.enabled !== "boolean") return false;
	if (value.locked !== undefined && typeof value.locked !== "boolean") return false;
	if (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1) return false;
	if (!isBounds(value.bounds)) return false;
	if (!isOptionalBoundedString(value.color, 200)) return false;
	if (!isOptionalBoundedString(value.label, 2_000)) return false;
	if (!isOptionalBoundedString(value.html, maximumControlStateBytes)) return false;
	return value.settings === undefined || isLayerSettings(value.settings);
}

function isStudioScene(value: unknown): value is StudioScene {
	if (!isRecord(value)) return false;
	if (!isId(value.id) || !isNonEmptyBoundedString(value.name, maximumNameLength)) return false;
	if (!Array.isArray(value.layerIds) || value.layerIds.length > maximumLayers) return false;
	if (!value.layerIds.every(isId) || new Set(value.layerIds).size !== value.layerIds.length) return false;
	if (value.layout !== undefined && (typeof value.layout !== "string" || !sceneLayouts.has(value.layout))) {
		return false;
	}
	if (
		value.transition !== undefined &&
		(typeof value.transition !== "string" || !sceneTransitions.has(value.transition))
	) {
		return false;
	}
	return value.stinger === undefined || isSceneSwitchEffect(value.stinger);
}

function isStudioSource(value: unknown): value is StudioSource {
	if (!isRecord(value)) return false;
	if (!isId(value.id) || !isNonEmptyBoundedString(value.name, maximumNameLength)) return false;
	if (typeof value.type !== "string" || !sourceTypes.has(value.type)) return false;
	if (typeof value.status !== "string" || !sourceStatuses.has(value.status)) return false;
	if (!isOptionalBoundedString(value.color, 200)) return false;
	if (!isOptionalBoundedString(value.label, 2_000)) return false;
	if (value.roles !== undefined) {
		if (!Array.isArray(value.roles) || value.roles.length > peopleRoles.size) return false;
		if (
			!value.roles.every((role) => typeof role === "string" && peopleRoles.has(role)) ||
			new Set(value.roles).size !== value.roles.length
		) {
			return false;
		}
	}
	return value.settings === undefined || (isRecord(value.settings) && isJsonCompatible(value.settings));
}

function isLayerSettings(value: unknown): value is LayerSettings {
	if (!isRecord(value) || !isJsonCompatible(value)) return false;
	if (value.media !== undefined) {
		if (!isRecord(value.media)) return false;
		if (value.media.onEnd !== undefined) {
			if (!Array.isArray(value.media.onEnd) || value.media.onEnd.length > maximumSceneActions) {
				return false;
			}
			if (!value.media.onEnd.every(isSceneAction)) return false;
		}
	}
	if (value.overlay !== undefined) {
		if (!isRecord(value.overlay)) return false;
		if (typeof value.overlay.role !== "string" || !overlayRoles.has(value.overlay.role)) return false;
		if (!isOverlayLifecycle(value.overlay.lifecycle)) return false;
	}
	if (value.remotion !== undefined) {
		if (!isRecord(value.remotion)) return false;
		if (
			typeof value.remotion.compositionId !== "string" ||
			!remotionCompositionIds.has(value.remotion.compositionId)
		) {
			return false;
		}
		if (!isBoundedString(value.remotion.title, 2_000)) return false;
		if (!isOptionalBoundedString(value.remotion.subtitle, 2_000)) return false;
	}
	return true;
}

function isSceneAction(value: unknown): value is SceneAction {
	if (!isRecord(value)) return false;
	if (value.type === "changeScene") return isId(value.sceneId);
	if (value.type === "runHook") return isId(value.hookId);
	return false;
}

function isOverlayLifecycle(value: unknown): value is OverlayLifecycle {
	if (!isRecord(value)) return false;
	if (value.enter !== undefined && !isOverlayTransitionEffect(value.enter)) return false;
	if (value.exit !== undefined && !isOverlayTransitionEffect(value.exit)) return false;
	return isOptionalEffectDuration(value.visibleSeconds);
}

function isOverlayTransitionEffect(value: unknown): value is OverlayTransitionEffect {
	return isSceneSwitchEffect(value);
}

function isSceneSwitchEffect(value: unknown): value is SceneSwitchEffect {
	if (!isRecord(value) || value.kind !== "motion-transition") return false;
	if (typeof value.transition !== "string" || !sceneTransitions.has(value.transition)) return false;
	if (value.axis !== undefined && (typeof value.axis !== "string" || !transitionAxes.has(value.axis))) {
		return false;
	}
	if (
		value.direction !== undefined &&
		(typeof value.direction !== "string" || !transitionDirections.has(value.direction))
	) {
		return false;
	}
	return isOptionalEffectDuration(value.durationSeconds);
}

function isOptionalEffectDuration(value: unknown): boolean {
	return value === undefined ||
		(isFiniteNumber(value) && value >= 0 && value <= maximumEffectDurationSeconds);
}

function isBounds(value: unknown): value is Bounds {
	return (
		isRecord(value) &&
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.width) &&
		isFiniteNumber(value.height) &&
		value.width > 0 &&
		value.height > 0
	);
}

function isResolution(value: unknown): boolean {
	return (
		isRecord(value) &&
		isFiniteNumber(value.width) &&
		isFiniteNumber(value.height) &&
		isFiniteNumber(value.fps) &&
		value.width > 0 &&
		value.width <= 7_680 &&
		value.height > 0 &&
		value.height <= 4_320 &&
		value.fps > 0 &&
		value.fps <= 120
	);
}

function hasUniqueIds(values: unknown[]): boolean {
	const ids = values
		.filter(isRecord)
		.map((value) => value.id)
		.filter(isNonEmptyString);
	return ids.length === values.length && new Set(ids).size === ids.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isId(value: unknown): value is string {
	return isNonEmptyBoundedString(value, maximumIdLength);
}

function isNonEmptyBoundedString(value: unknown, maximumLength: number): value is string {
	return isNonEmptyString(value) && value.length <= maximumLength;
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
	return typeof value === "string" && value.length <= maximumLength;
}

function isOptionalBoundedString(
	value: unknown,
	maximumLength: number,
	requireNonEmpty = false,
): boolean {
	return value === undefined ||
		(requireNonEmpty
			? isNonEmptyBoundedString(value, maximumLength)
			: isBoundedString(value, maximumLength));
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isStudioPhase(value: unknown): boolean {
	return value === "designing" || value === "live" || value === "previewing" || value === "recording";
}

function isOverlayPhase(value: unknown): boolean {
	return value === "entering" || value === "exiting" || value === "visible";
}

function isOptionalGeneration(value: unknown): boolean {
	return value === undefined ||
		(typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function isJsonCompatible(value: unknown, depth = 0, allowUndefined = false): boolean {
	if (value === undefined) return allowUndefined;
	if (value === null || typeof value === "string" || typeof value === "boolean") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (depth >= 100) return false;
	if (Array.isArray(value)) {
		return value.every((item) => isJsonCompatible(item, depth + 1));
	}
	if (!isRecord(value)) return false;
	return Object.values(value).every((item) => isJsonCompatible(item, depth + 1, true));
}
