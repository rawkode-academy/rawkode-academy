import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { createInitialStudioState } from "./seed";
import {
  getScene,
  getSceneLayers,
  getSelectedLayer,
  reduceStudioState,
  type StudioEvent,
} from "./studioMachine";
import type { StudioState } from "../types";
import { selectOnStageLayers, sourceRequiresAdmission } from "./sourceAdmission";
import { isRealtimeKitScreenSourceId } from "./programmeMediaGate";
import {
  resolveStudioControlStateConflict,
  shouldFlushStudioControlStateAfterSave,
  type StudioControlSaveOutcome,
  type StudioControlStateResponse,
} from "./controlStateSync";

type StudioSyncStatus = "conflict" | "error" | "loading" | "local" | "ready" | "saving";

// A control-state response can be no newer than the request that produced it.
// Fence the programme when that last confirmed request becomes too old. This
// cannot fence a frozen tab or acknowledge another producer's change instantly.
const CONTROL_STATE_FRESHNESS_MS = 8_000;

interface RequestStart {
  wallTime: number;
  monotonicTime: number;
}

type StingerEvent = Extract<StudioEvent, { type: "stinger.midpoint" | "stinger.finished" }>;
type ReplayableChange =
  | { kind: "stinger"; event: StingerEvent; identity: string }
  | { kind: "reconciliation" }
  | { kind: "admission-barrier"; sourceId: string; expectedRevision: number }
  | { kind: "publication-removal"; sourceId: string }
  | { kind: "revocation"; sourceId: string };
interface PendingChange {
  serial: number;
  replayable?: ReplayableChange;
  revokedSourceIds?: readonly string[];
  removedPublicationIds?: readonly string[];
  admittedSourceId?: string;
}

function elapsedSince(start: RequestStart): number {
  return Math.max(0, Date.now() - start.wallTime, performance.now() - start.monotonicTime);
}

interface StudioMachineOptions {
  pollIntervalMs?: number;
  sessionId?: string;
  synchronize?: boolean;
}

export function useStudioMachine(
  initialState: StudioState = createInitialStudioState(),
  options: StudioMachineOptions = {},
) {
  const state = ref(initialState);
  const revision = ref(0);
  const remoteStateEpoch = ref(0);
  const syncStatus = ref<StudioSyncStatus>(options.synchronize ? "loading" : "local");
  const syncError = ref("");
  const syncConflictNotice = ref("");
  const hasFreshState = ref(false);
  const synchronize = Boolean(options.synchronize && options.sessionId);
  const pollIntervalMs = Math.max(1_000, options.pollIntervalMs ?? 2_000);
  let changeSerial = 0;
  let savedSerial = 0;
  let pendingChanges: PendingChange[] = [];
  let lastDispatchedSave: { serial: number; expectedRevision: number } | undefined;
  let freshnessStartedAt: RequestStart | undefined;
  let syncGeneration = 0;
  let saveTimer: number | undefined;
  let pollTimer: number | undefined;
  let freshnessTimer: number | undefined;
  let saveInFlight = false;
  let pollInFlight = false;
  let active = true;
  const pendingRequests = new Set<AbortController>();

  function send(event: StudioEvent): void {
    if (synchronize && syncStatus.value === "loading") {
      return;
    }
    if (synchronize && event.type === "source.admission.set" && event.admitted) {
      // Timers can be delayed while the tab is suspended. Check freshness at
      // the action itself rather than relying only on the timeout callback.
      if (hasFreshState.value && (!freshnessStartedAt || elapsedSince(freshnessStartedAt) >= CONTROL_STATE_FRESHNESS_MS)) {
        setSyncError(new Error("Studio control state is stale. Reconnecting before resuming programme."));
      }
      if (!hasFreshState.value) return;
    }
    const current = state.value;
    const next = reduceStudioState(current, event);
    const departures = event.type === "sources.reconcile" ? event.departedSourceIds ?? [] : [];
    if (departures.length === 0 && (next === current || (event.type === "sources.reconcile" && statesEqual(current, next)))) {
      return;
    }
    state.value = next;
    if (synchronize) {
      changeSerial += 1;
      const identity = getStingerIdentity(current);
      let replayable: ReplayableChange | undefined;
      if ((event.type === "stinger.midpoint" || event.type === "stinger.finished") && identity) {
        replayable = { kind: "stinger", event, identity };
      } else if (event.type === "source.admission.set" && !event.admitted) {
        replayable = { kind: "revocation", sourceId: event.sourceId };
      } else if (event.type === "sources.reconcile") {
        replayable = { kind: "reconciliation" };
      }
      const revokedSourceIds = [...new Set([
        ...departures,
        ...(current.onStageSourceIds ?? []).filter((id) => !(next.onStageSourceIds ?? []).includes(id)),
        ...current.sources
          .filter((source) => sourceRequiresAdmission(source) && !next.sources.some((candidate) => candidate.id === source.id))
          .map((source) => source.id),
        ...(replayable?.kind === "revocation" ? [replayable.sourceId] : []),
      ])];
      pendingChanges.push({
        serial: changeSerial,
        replayable,
        revokedSourceIds,
        removedPublicationIds: departures.filter(isRealtimeKitScreenSourceId),
        admittedSourceId: event.type === "source.admission.set" && event.admitted ? event.sourceId : undefined,
      });
      scheduleSave();
    }
  }

  function acknowledgeConflict(): void {
    const notice = syncConflictNotice.value;
    syncConflictNotice.value = "";
    if (syncError.value === notice) {
      syncError.value = "";
    }
    if (syncStatus.value === "conflict") {
      syncStatus.value = "ready";
    }
  }

  const previewScene = computed(() => getScene(state.value, state.value.previewSceneId));
  const programScene = computed(() => getScene(state.value, state.value.programSceneId));
  const previewLayers = computed(() => {
    const scene = getScene(state.value, state.value.previewSceneId);
    return selectOnStageLayers(
      getSceneLayers(state.value, state.value.previewSceneId),
      state.value.onStageSourceIds,
      scene,
      state.value.resolution,
    );
  });
  const programLayers = computed(() => {
    const scene = getScene(state.value, state.value.programSceneId);
    return selectOnStageLayers(
      getSceneLayers(state.value, state.value.programSceneId),
      state.value.onStageSourceIds,
      scene,
      state.value.resolution,
    );
  });
  const selectedLayer = computed(() => getSelectedLayer(state.value));
  const hasStagedScene = computed(() => state.value.previewSceneId !== state.value.programSceneId);
  const nextScene = computed(() => {
    const currentIndex = state.value.scenes.findIndex(
      (scene) => scene.id === state.value.programSceneId,
    );
    return state.value.scenes[currentIndex + 1];
  });
  const isSynchronized = computed(() =>
    !synchronize || (hasFreshState.value && ["conflict", "ready", "saving"].includes(syncStatus.value)),
  );

  function invalidateRequests(): void {
    syncGeneration += 1;
    for (const request of pendingRequests) {
      request.abort();
    }
    pendingRequests.clear();
  }

  function refreshFreshness(requestStartedAt: RequestStart): void {
    if (freshnessTimer !== undefined) window.clearTimeout(freshnessTimer);
    freshnessStartedAt = requestStartedAt;
    const remaining = Math.max(0, CONTROL_STATE_FRESHNESS_MS - elapsedSince(requestStartedAt));
    freshnessTimer = window.setTimeout(() => {
      freshnessTimer = undefined;
      setSyncError(new Error("Studio control state is stale. Reconnecting before resuming programme."));
    }, remaining);
  }

  async function requestControlState<T>(
    request: (signal: AbortSignal) => Promise<T>,
  ): Promise<{ result: T; startedAt: RequestStart }> {
    const controller = new AbortController();
    const startedAt = { wallTime: Date.now(), monotonicTime: performance.now() };
    pendingRequests.add(controller);
    const timeout = window.setTimeout(() => {
      controller.abort(new Error("Studio control state request timed out."));
    }, CONTROL_STATE_FRESHNESS_MS);
    let onAbort: (() => void) | undefined;

    try {
      const result = await new Promise<T>((resolve, reject) => {
        onAbort = () => reject(controller.signal.reason ?? new Error("Studio control state request cancelled."));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        void Promise.resolve().then(() => {
          if (controller.signal.aborted) throw controller.signal.reason;
          return request(controller.signal);
        }).then(resolve, reject);
      });
      // Timers can be delayed while a tab is suspended. Never accept a
      // response to a request that has already exceeded the freshness bound.
      if (elapsedSince(startedAt) >= CONTROL_STATE_FRESHNESS_MS) {
        throw new Error("Studio control state request timed out.");
      }
      return { result, startedAt };
    } finally {
      window.clearTimeout(timeout);
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      pendingRequests.delete(controller);
    }
  }

  function scheduleSave(): void {
    if (!synchronize || saveTimer !== undefined) return;
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      void saveControlState();
    }, 100);
  }

  async function initializeSynchronization(): Promise<void> {
    if (!synchronize || !options.sessionId) return;
    syncStatus.value = "loading";
    syncError.value = "";
    const generation = syncGeneration;

    try {
      const { result: remote, startedAt } = await requestControlState((signal) =>
        fetchControlState(options.sessionId!, signal),
      );
      if (!active || generation !== syncGeneration) return;
      if (remote.state) {
        applyRemoteState(remote);
        refreshFreshness(startedAt);
      } else if (remote.revision === 0) {
        await saveControlState(true);
      } else {
        throw new Error("Studio control state response was missing its programme.");
      }
    } catch (error) {
      if (active && generation === syncGeneration) setSyncError(error);
    } finally {
      if (active && pollTimer === undefined) {
        pollTimer = window.setInterval(() => {
          void pollControlState();
        }, pollIntervalMs);
      }
    }
  }

  async function pollControlState(): Promise<void> {
    if (!active || !options.sessionId || saveInFlight || pollInFlight) return;
    pollInFlight = true;
    const generation = syncGeneration;
    try {
      const { result: remote, startedAt } = await requestControlState((signal) =>
        fetchControlState(options.sessionId!, signal),
      );
      if (!active || generation !== syncGeneration) return;
      if (!remote.state) {
        if (remote.revision === 0 && revision.value === 0) {
          await saveControlState(true);
        } else {
          throw new Error("Studio control state response was missing its programme.");
        }
        return;
      }
      const hasLocalChanges = changeSerial !== savedSerial;
      if (remote.revision < revision.value) {
        // A poll can have started before a newer save completed. It is not a
        // fresh confirmation of the currently applied programme.
        return;
      }
      if (remote.revision === revision.value) {
        if (hasLocalChanges) scheduleSave();
        else if (!hasFreshState.value) applyRemoteState(remote);
        refreshFreshness(startedAt);
        return;
      }
      if (hasLocalChanges) {
        if (statesEqual(state.value, remote.state) && !requiresAdmissionBarrier(remote.revision)) {
          invalidateRequests();
          applyRemoteState(remote);
        } else if (rebasePendingSafeChanges(remote)) {
          // Replayed changes preserve the newer authoritative admission state.
        } else {
          applyRemoteConflict({
            ...remote,
            error: "Another producer changed the programme.",
          });
        }
      } else {
        applyRemoteState(remote);
      }
      refreshFreshness(startedAt);
    } catch (error) {
      if (active && generation === syncGeneration) setSyncError(error);
    } finally {
      pollInFlight = false;
    }
  }

  async function saveControlState(initialize = false): Promise<void> {
    if (!active || !synchronize || !options.sessionId || saveInFlight) return;
    if (!initialize && changeSerial === savedSerial) return;

    saveInFlight = true;
    if (hasFreshState.value) {
      syncStatus.value = "saving";
      syncError.value = "";
    }
    const requestSerial = changeSerial;
    const expectedRevision = revision.value;
    const generation = syncGeneration;
    let outcome: StudioControlSaveOutcome = "error";

    try {
      const requestBody = JSON.stringify({
        expectedRevision,
        sessionId: options.sessionId,
        state: state.value,
      });
      const { result, startedAt } = await requestControlState(async (signal) => {
        // Once dispatched, the server may commit even if the response is lost.
        lastDispatchedSave = { serial: requestSerial, expectedRevision };
        const response = await fetch("/api/studio/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal,
        });
        return { response, remote: await readControlStateResponse(response) };
      });
      if (!active || generation !== syncGeneration) return;
      const { response, remote } = result;

      if (response.status === 409) {
        if (remote.state && statesEqual(state.value, remote.state) && !requiresAdmissionBarrier(remote.revision)) {
          invalidateRequests();
          applyRemoteState(remote);
          outcome = "saved";
        } else if (rebasePendingSafeChanges(remote)) {
          outcome = "saved";
        } else {
          applyRemoteConflict(remote);
          outcome = "conflict";
        }
      } else if (!response.ok) {
        throw new Error(remote.error ?? `Studio state save failed with ${response.status}`);
      } else {
        if (!remote.state || remote.revision !== expectedRevision + 1) {
          throw new Error("Studio control state save returned an invalid revision.");
        }
        revision.value = remote.revision;
        savedSerial = requestSerial;
        pendingChanges = pendingChanges.filter((change) => change.serial > requestSerial);
        // After a failure, keep the programme closed until every local edit
        // has been confirmed, including edits made during this request.
        if (hasFreshState.value || changeSerial === savedSerial) {
          hasFreshState.value = true;
          syncStatus.value = syncConflictNotice.value ? "conflict" : "ready";
          syncError.value = syncConflictNotice.value;
        }
        outcome = "saved";
      }
      refreshFreshness(startedAt);
    } catch (error) {
      if (active && generation === syncGeneration) setSyncError(error);
    } finally {
      saveInFlight = false;
      if (
        active &&
        shouldFlushStudioControlStateAfterSave(outcome, changeSerial, savedSerial)
      ) {
        scheduleSave();
      }
    }
  }

  function applyRemoteState(remote: StudioControlStateResponse): void {
    if (!remote.state) return;
    state.value = remote.state;
    revision.value = remote.revision;
    remoteStateEpoch.value += 1;
    changeSerial += 1;
    savedSerial = changeSerial;
    pendingChanges = [];
    hasFreshState.value = true;
    syncStatus.value = syncConflictNotice.value ? "conflict" : "ready";
    syncError.value = syncConflictNotice.value;
  }

  function applyRemoteConflict(remote: StudioControlStateResponse): void {
    const conflict = resolveStudioControlStateConflict(remote, changeSerial);
    invalidateRequests();
    state.value = conflict.state;
    revision.value = conflict.revision;
    remoteStateEpoch.value += 1;
    changeSerial = conflict.changeSerial;
    savedSerial = conflict.savedSerial;
    pendingChanges = [];
    hasFreshState.value = true;
    syncStatus.value = "conflict";
    syncError.value = conflict.error;
    syncConflictNotice.value = conflict.error;
  }

  function rebasePendingSafeChanges(remote: StudioControlStateResponse): boolean {
    if (!remote.state || pendingChanges.length === 0) return false;
    const hasOtherEdits = pendingChanges.some((change) => !change.replayable);
    const revocations = [...new Set(pendingChanges.flatMap((change) => change.revokedSourceIds ?? []))];
    const removedPublications = new Set(pendingChanges.flatMap((change) => change.removedPublicationIds ?? []));
    const admissionBarriers = pendingChanges.flatMap((change): ReplayableChange[] =>
      change.replayable?.kind === "admission-barrier" ? [change.replayable] : []
    );
    if (hasOtherEdits && revocations.length === 0) return false;

    // If unrelated edits also conflicted, discard them explicitly but never
    // discard a pending backstage removal or exact publication departure.
    // Never replay an admission. Runtime
    // discovery is recomputed by the consumer after remoteStateEpoch changes;
    // replaying an old snapshot could remove or overwrite newer sources.
    const candidates: ReplayableChange[] = hasOtherEdits
      ? [
        ...revocations.map((sourceId): ReplayableChange => ({
          kind: removedPublications.has(sourceId) ? "publication-removal" : "revocation",
          sourceId,
        })),
        ...admissionBarriers,
      ]
      : pendingChanges.flatMap((change): ReplayableChange[] =>
        change.replayable?.kind === "reconciliation"
          ? (change.revokedSourceIds ?? []).map((sourceId) => ({
            kind: change.removedPublicationIds?.includes(sourceId) ? "publication-removal" : "revocation",
            sourceId,
          }))
          : [change.replayable!]
      );
    let rebased = remote.state;
    const replayed: ReplayableChange[] = [];
    for (const change of candidates) {
      if (change.kind === "reconciliation") continue;
      if (change.kind === "stinger" && getStingerIdentity(rebased) !== change.identity) continue;
      if (change.kind === "publication-removal" &&
          !rebased.sources.some((source) => source.id === change.sourceId) &&
          !rebased.onStageSourceIds.includes(change.sourceId)) continue;
      const event: StudioEvent = change.kind === "stinger"
        ? change.event
        : change.kind === "publication-removal"
          ? { type: "source.remove", sourceId: change.sourceId }
          : { type: "source.admission.set", sourceId: change.sourceId, admitted: false };
      const next = reduceStudioState(rebased, event);
      // A no-op backstage decision still needs a CAS write if an older
      // admission request could arrive using this same revision.
      if (next !== rebased || (change.kind === "admission-barrier" && remote.revision <= change.expectedRevision)) {
        replayed.push(change);
      }
      rebased = next;
    }

    const wasFresh = hasFreshState.value;
    const conflict = hasOtherEdits ? resolveStudioControlStateConflict(remote, changeSerial) : undefined;
    invalidateRequests();
    state.value = rebased;
    revision.value = remote.revision;
    remoteStateEpoch.value += 1;
    changeSerial += 1;
    savedSerial = changeSerial;
    pendingChanges = replayed.map((replayable) => ({
      serial: ++changeSerial,
      replayable,
      revokedSourceIds: replayable.kind === "revocation" || replayable.kind === "publication-removal" ||
        replayable.kind === "admission-barrier"
        ? [replayable.sourceId] : [],
      removedPublicationIds: replayable.kind === "publication-removal" ? [replayable.sourceId] : [],
    }));
    if (conflict) {
      syncConflictNotice.value = conflict.error;
      syncError.value = conflict.error;
      syncStatus.value = "conflict";
    }
    if ((!conflict && wasFresh) || replayed.length === 0) {
      hasFreshState.value = true;
      syncStatus.value = syncConflictNotice.value ? "conflict" : "ready";
      syncError.value = syncConflictNotice.value;
    } else if (conflict) {
      hasFreshState.value = false;
    }
    if (replayed.length > 0) scheduleSave();
    return true;
  }

  function setSyncError(error: unknown): void {
    if (!active) return;
    invalidateRequests();
    if (freshnessTimer !== undefined) {
      window.clearTimeout(freshnessTimer);
      freshnessTimer = undefined;
    }
    freshnessStartedAt = undefined;
    discardUnconfirmedAdmissions();
    hasFreshState.value = false;
    syncStatus.value = "error";
    syncError.value = error instanceof Error ? error.message : "Studio state synchronization failed";
  }

  function requiresAdmissionBarrier(remoteRevision: number): boolean {
    return pendingChanges.some((change) => change.replayable?.kind === "admission-barrier" &&
      remoteRevision <= change.replayable.expectedRevision);
  }

  function discardUnconfirmedAdmissions(): void {
    const admissions = pendingChanges.filter((change) => change.admittedSourceId !== undefined);
    if (admissions.length === 0) return;
    const sourceIds = new Set(admissions.map((change) => change.admittedSourceId!));
    const uncertain = new Set(admissions.filter((change) =>
      lastDispatchedSave !== undefined && change.serial <= lastDispatchedSave.serial
    ).map((change) => change.admittedSourceId!));
    pendingChanges = pendingChanges.filter((change) => change.admittedSourceId === undefined);
    state.value = {
      ...state.value,
      onStageSourceIds: state.value.onStageSourceIds.filter((sourceId) => !sourceIds.has(sourceId)),
    };
    // A matching read is insufficient: advance the CAS revision so an older
    // admission write cannot arrive after recovery and put the source on air.
    for (const sourceId of uncertain) {
      pendingChanges.push({
        serial: ++changeSerial,
        replayable: { kind: "admission-barrier", sourceId, expectedRevision: lastDispatchedSave!.expectedRevision },
        revokedSourceIds: [sourceId],
      });
    }
    if (pendingChanges.length === 0) savedSerial = changeSerial;
    const notice = "Pending admissions were cleared after synchronization was lost. Review and admit sources again.";
    if (!syncConflictNotice.value.includes(notice)) {
      syncConflictNotice.value = [syncConflictNotice.value, notice].filter(Boolean).join(" ");
    }
  }

  onMounted(() => {
    if (synchronize) {
      void initializeSynchronization();
    }
  });

  onBeforeUnmount(() => {
    active = false;
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    if (pollTimer !== undefined) window.clearInterval(pollTimer);
    if (freshnessTimer !== undefined) window.clearTimeout(freshnessTimer);
    invalidateRequests();
  });

  return {
    state,
    send,
    acknowledgeConflict,
    previewScene,
    programScene,
    previewLayers,
    programLayers,
    selectedLayer,
    hasStagedScene,
    nextScene,
    isSynchronized,
    remoteStateEpoch,
    revision,
    syncError,
    syncConflictNotice,
    syncStatus,
  };
}

function statesEqual(left: StudioState, right: StudioState): boolean {
  // Control state is persisted as JSON, so changes that do not affect its JSON
  // representation should not create a new revision or a false conflict.
  return JSON.stringify(left) === JSON.stringify(right);
}

function getStingerIdentity(state: StudioState): string | undefined {
  const stinger = state.activeStinger;
  return stinger
    ? JSON.stringify([stinger.generation, stinger.fromSceneId, stinger.toSceneId, stinger.effect])
    : undefined;
}

async function fetchControlState(sessionId: string, signal: AbortSignal): Promise<StudioControlStateResponse> {
  const response = await fetch(`/api/studio/state?sessionId=${encodeURIComponent(sessionId)}`, { signal, cache: "no-store" });
  const state = await readControlStateResponse(response);
  if (!response.ok) {
    throw new Error(state.error ?? `Studio state load failed with ${response.status}`);
  }
  return state;
}

async function readControlStateResponse(response: Response): Promise<StudioControlStateResponse> {
  const body = (await response.json().catch(() => null)) as Partial<StudioControlStateResponse> | null;
  if (!body || !Number.isSafeInteger(body.revision) || body.revision! < 0) {
    throw new Error(body?.error ?? "Studio state response was invalid");
  }
  return {
    error: body.error,
    revision: body.revision!,
    state: body.state ?? null,
    updatedAt: body.updatedAt ?? null,
    updatedBy: body.updatedBy ?? null,
  };
}
