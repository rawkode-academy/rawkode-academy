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
import {
  resolveStudioControlStateConflict,
  shouldFlushStudioControlStateAfterSave,
  type StudioControlSaveOutcome,
  type StudioControlStateResponse,
} from "./controlStateSync";

type StudioSyncStatus = "conflict" | "error" | "loading" | "local" | "ready" | "saving";

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
  const synchronize = Boolean(options.synchronize && options.sessionId);
  const pollIntervalMs = Math.max(1_000, options.pollIntervalMs ?? 2_000);
  let changeSerial = 0;
  let savedSerial = 0;
  let saveTimer: number | undefined;
  let pollTimer: number | undefined;
  let saveInFlight = false;
  let pollInFlight = false;
  let active = true;

  function send(event: StudioEvent): void {
    if (synchronize && syncStatus.value === "loading") {
      return;
    }
    state.value = reduceStudioState(state.value, event);
    if (synchronize) {
      changeSerial += 1;
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
  const previewLayers = computed(() => getSceneLayers(state.value, state.value.previewSceneId));
  const programLayers = computed(() => getSceneLayers(state.value, state.value.programSceneId));
  const selectedLayer = computed(() => getSelectedLayer(state.value));
  const hasStagedScene = computed(() => state.value.previewSceneId !== state.value.programSceneId);
  const isSynchronized = computed(() =>
    !synchronize || ["conflict", "ready", "saving"].includes(syncStatus.value),
  );

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

    try {
      const remote = await fetchControlState(options.sessionId);
      if (!active) return;
      if (remote.state) {
        applyRemoteState(remote);
      } else {
        await saveControlState(true);
      }
    } catch (error) {
      setSyncError(error);
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
    try {
      const remote = await fetchControlState(options.sessionId);
      if (!active) return;
      if (!remote.state) {
        if (remote.revision === 0) await saveControlState(true);
        return;
      }
      const hasLocalChanges = changeSerial !== savedSerial;
      if (remote.revision <= revision.value) {
        if (hasLocalChanges) scheduleSave();
        return;
      }
      if (hasLocalChanges) {
        applyRemoteConflict({
          ...remote,
          error: "Another producer changed the programme.",
        });
      } else {
        applyRemoteState(remote);
      }
    } catch (error) {
      setSyncError(error);
    } finally {
      pollInFlight = false;
    }
  }

  async function saveControlState(initialize = false): Promise<void> {
    if (!active || !synchronize || !options.sessionId || saveInFlight) return;
    if (!initialize && changeSerial === savedSerial) return;

    saveInFlight = true;
    syncStatus.value = "saving";
    syncError.value = "";
    const requestSerial = changeSerial;
    const expectedRevision = revision.value;
    let outcome: StudioControlSaveOutcome = "error";

    try {
      const response = await fetch("/api/studio/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision,
          sessionId: options.sessionId,
          state: state.value,
        }),
      });
      const remote = await readControlStateResponse(response);
      if (!active) return;

      if (response.status === 409) {
        applyRemoteConflict(remote);
        outcome = "conflict";
      } else if (!response.ok) {
        throw new Error(remote.error ?? `Studio state save failed with ${response.status}`);
      } else {
        revision.value = remote.revision;
        savedSerial = requestSerial;
        syncStatus.value = "ready";
        outcome = "saved";
      }
    } catch (error) {
      setSyncError(error);
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
    syncStatus.value = "ready";
    syncError.value = "";
  }

  function applyRemoteConflict(remote: StudioControlStateResponse): void {
    const conflict = resolveStudioControlStateConflict(remote, changeSerial);
    state.value = conflict.state;
    revision.value = conflict.revision;
    remoteStateEpoch.value += 1;
    changeSerial = conflict.changeSerial;
    savedSerial = conflict.savedSerial;
    syncStatus.value = "conflict";
    syncError.value = conflict.error;
    syncConflictNotice.value = conflict.error;
  }

  function setSyncError(error: unknown): void {
    syncStatus.value = "error";
    syncError.value = error instanceof Error ? error.message : "Studio state synchronization failed";
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
    isSynchronized,
    remoteStateEpoch,
    revision,
    syncError,
    syncConflictNotice,
    syncStatus,
  };
}

async function fetchControlState(sessionId: string): Promise<StudioControlStateResponse> {
  const response = await fetch(`/api/studio/state?sessionId=${encodeURIComponent(sessionId)}`);
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
