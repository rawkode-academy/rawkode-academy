<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import PeopleRail from "./components/PeopleRail.vue";
import RealtimeKitRoom from "./components/RealtimeKitRoom.vue";
import SceneSwitcher from "./components/SceneSwitcher.vue";
import StudioCanvas from "./components/StudioCanvas.vue";
import StudioWidgets from "./components/StudioWidgets.vue";
import { selectProgrammeAudioStreams } from "./audio/programmeAudioSources";
import { useStudioMachine } from "./studio/useStudioMachine";
import { shouldPersistOwnedScreenCleanup } from "./studio/localSourceOwnership";
import type { ActiveOverlay, StudioAudioMixControl, StudioSource } from "./types";

type CaptureStatus = "blocked" | "ended" | "missing" | "ready" | "requesting" | "unavailable";
type RoomMediaPayload = {
  authoritative: boolean;
  sources: StudioSource[];
  streams: Map<string, MediaStream>;
};

const props = defineProps<{
  inviteToken?: string;
  providerStatus?: string;
  recordingStatus?: string;
  roomRole?: string;
  sessionId?: string;
  sessionTitle?: string;
  streamEnvironment?: "prod" | "test";
  streamStatus?: string;
}>();
const {
  state,
  send,
  acknowledgeConflict,
  programLayers,
  isSynchronized,
  remoteStateEpoch,
  syncConflictNotice,
  syncError,
  syncStatus,
} = useStudioMachine(undefined, {
  sessionId: props.sessionId,
  synchronize: props.roomRole?.toLowerCase() === "producer" || props.roomRole?.toLowerCase() === "program",
});

const overlayTimers = new Map<string, number>();
const overlayTimerKeys = new Map<string, string>();
const hostMediaStream = shallowRef<MediaStream | undefined>();
const roomMediaStreams = shallowRef(new Map<string, MediaStream>());
const roomMediaSources = shallowRef(new Map<string, StudioSource>());
const roomMediaSnapshotAuthoritative = ref(false);
const screenShareSources = ref<StudioSource[]>([]);
const screenShareStreams = shallowRef(new Map<string, MediaStream>());
const screenShareCaptureStates = ref<Record<string, { error: string; status: CaptureStatus }>>({});
const hostCaptureStatus = ref<CaptureStatus>("requesting");
const hostCaptureError = ref("");
const widgetHeight = ref(220);
const widgetMaxHeight = ref(220);
const isResizingWidgets = ref(false);
let stingerTimer: number | undefined;
let stingerMidpointTimer: number | undefined;
let stingerTimerKey = "";
let resizeStartY = 0;
let resizeStartHeight = 0;
let hostCaptureGeneration = 0;
let isComponentUnmounted = false;
const screenShareCaptureGenerations = new Map<string, number>();
const runtimeOwnerId = crypto.randomUUID();
let ownedScreenCleanupSent = false;
const activeStingerKey = computed(() => {
  const stinger = state.value.activeStinger;
  return stinger
    ? `${stinger.generation ?? 0}:${stinger.fromSceneId}:${stinger.toSceneId}:${getEffectKey(stinger.effect)}`
    : "";
});
const roomRole = computed(() => {
  const role = props.roomRole?.toLowerCase();
  return role === "host" || role === "producer" || role === "program" || role === "guest"
    ? role
    : "guest";
});
const hasProductionControls = computed(() =>
  roomRole.value === "producer" || roomRole.value === "program",
);
const roomSubtitle = computed(() =>
  [
    props.roomRole,
    hasProductionControls.value ? "Browser production console" : "RealtimeKit green room",
  ].filter(Boolean).join(" / "),
);
const canPublishLive = computed(() => hasProductionControls.value);
const currentRecordingStatus = ref(props.recordingStatus ?? "");
const currentStreamStatus = ref(props.streamStatus ?? "");
const localCameraSourceId = computed(() =>
  roomRole.value === "producer" || roomRole.value === "program"
    ? "source-producer-camera"
    : roomRole.value === "guest"
      ? "source-guest-camera"
      : "source-host-camera",
);
const studioLayoutStyle = computed(() => ({
  "--widgets-height": `${widgetHeight.value}px`,
}));
const mediaStreams = computed(() => {
  const streams = new Map<string, MediaStream>(roomMediaStreams.value);
  if (hostMediaStream.value) {
    streams.set(localCameraSourceId.value, hostMediaStream.value);
  }
  for (const [sourceId, stream] of screenShareStreams.value) {
    streams.set(sourceId, stream);
  }

  return streams;
});
const sourcesForUi = computed(() =>
  state.value.sources
    .map(withRuntimeMediaState)
    .filter(isVisibleRuntimeSource),
);
const programmeMediaStreams = computed(() =>
  selectProgrammeAudioStreams(
    mediaStreams.value,
    sourcesForUi.value,
    state.value.activeScreenShareSourceId,
  )
);
const programmeAudioControls = computed(() => {
  const controls: Record<string, StudioAudioMixControl> = {};
  for (const source of sourcesForUi.value) {
    const stream = mediaStreams.value.get(source.id);
    if ((source.type !== "camera" && source.type !== "screen") || !hasLiveAudioTrack(stream)) {
      continue;
    }

    const audioState = state.value.audioMix[source.id] ?? { gain: 1, muted: false };
    controls[source.id] = {
      gain: audioState.gain,
      muted: audioState.muted,
    };
  }
  return controls;
});

onMounted(() => {
  updateWidgetMaxHeight();
  window.addEventListener("resize", updateWidgetMaxHeight);
  window.addEventListener("pagehide", persistOwnedScreenCleanup);
  if (hasProductionControls.value) {
    void startHostCapture();
  }
});

function selectScene(id: string): void {
  send({ type: "scene.select", sceneId: id });
}

function setRecording(recording: boolean): void {
  currentRecordingStatus.value = recording ? "recording" : "idle";
  if (state.value.isRecording !== recording) {
    send({ type: "recording.toggle" });
  }
}

function setRecordingStatus(status: string): void {
  currentRecordingStatus.value = status;
}

function setStreamStatus(status: string): void {
  currentStreamStatus.value = status;
}

function markProgramExported(): void {
  send({ type: "program.exported" });
}

function setProgrammeAudioSourceGain(sourceId: string, gain: number): void {
  send({ type: "audioMix.source.gain", sourceId, gain: normalizeProgrammeAudioGain(gain) });
}

function setProgrammeAudioSourceMuted(sourceId: string, muted: boolean): void {
  send({ type: "audioMix.source.mute", sourceId, muted });
}

function normalizeProgrammeAudioGain(gain: number): number {
  if (!Number.isFinite(gain)) return 1;
  return Math.min(Math.max(gain, 0), 2);
}

function hasLiveAudioTrack(stream: MediaStream | undefined): boolean {
  try {
    return stream?.getAudioTracks().some((track) => track.readyState === "live") === true;
  } catch {
    return false;
  }
}

async function addScreenShare(): Promise<void> {
  const sourceId = `source-screen-share-${crypto.randomUUID()}`;
  const sourceNumber = screenShareSources.value.length + 1;
  await startScreenShare({
    id: sourceId,
    name: `Screen Share ${sourceNumber}`,
    type: "screen",
    status: "loading",
    color: getScreenShareColor(sourceNumber),
  });
}

async function startScreenShare(source: StudioSource): Promise<void> {
  stopScreenShare(source.id);
  const captureGeneration = screenShareCaptureGenerations.get(source.id) ?? 0;
  const localSource: StudioSource = {
    ...source,
    settings: {
      ...source.settings,
      runtimeOwnerId,
      runtimeSource: "local",
    },
  };
  upsertScreenShareSource(localSource);
  if (!navigator.mediaDevices?.getDisplayMedia) {
    upsertScreenShareSource({ ...localSource, status: "missing" });
    setScreenShareCaptureState(source.id, "unavailable", "Browser screen capture unavailable");
    return;
  }
  setScreenShareCaptureState(source.id, "requesting", "");

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: {
        frameRate: { ideal: state.value.resolution.fps },
        height: { ideal: state.value.resolution.height },
        width: { ideal: state.value.resolution.width },
      },
    });
    if (
      isComponentUnmounted ||
      screenShareCaptureGenerations.get(source.id) !== captureGeneration
    ) {
      stopMediaStream(stream);
      return;
    }
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () =>
        handleScreenShareEnded(source.id, stream, captureGeneration)
      );
    }
    const namedSource = {
      ...localSource,
      name: getScreenShareName(source.name, stream, screenShareSources.value.length),
      status: "ready" as const,
    };
    upsertScreenShareSource(namedSource);
    screenShareStreams.value = new Map(screenShareStreams.value).set(source.id, stream);
    setScreenShareCaptureState(source.id, "ready", "");
    selectScreenShare(namedSource.id);
  } catch (error) {
    if (
      isComponentUnmounted ||
      screenShareCaptureGenerations.get(source.id) !== captureGeneration
    ) {
      return;
    }
    setScreenShareCaptureState(
      source.id,
      "blocked",
      error instanceof Error ? error.message : "Unable to capture screen",
    );
    upsertScreenShareSource({ ...localSource, status: "missing" });
  }
}

function retryScreenShare(sourceId: string): void {
  const source = getScreenShareSource(sourceId);
  if (source) {
    void startScreenShare(source);
  }
}

function selectScreenShare(sourceId: string): void {
  const source = getScreenShareSource(sourceId);
  send({ type: "screenShare.source.select", sourceId, name: source?.name ?? "Screen Share" });
}

function selectNextScreenShare(): void {
  const nextSource = screenShareSources.value.find((source) =>
    getScreenShareCaptureState(source.id).status === "ready"
  );
  send({
    type: "screenShare.source.select",
    sourceId: nextSource?.id ?? "source-host-screen-share",
    name: nextSource?.name ?? "Screen Share",
  });
}

function stopScreenShare(sourceId: string): void {
  screenShareCaptureGenerations.set(
    sourceId,
    (screenShareCaptureGenerations.get(sourceId) ?? 0) + 1,
  );
  const stream = screenShareStreams.value.get(sourceId);
  if (stream) {
    stopMediaStream(stream);
  }
  const nextStreams = new Map(screenShareStreams.value);
  nextStreams.delete(sourceId);
  screenShareStreams.value = nextStreams;
  removeScreenShareSource(sourceId);
  if (state.value.sources.some((source) => source.id === sourceId)) {
    send({ type: "source.remove", sourceId });
  }
  setScreenShareCaptureState(sourceId, "missing", "");
  if (state.value.activeScreenShareSourceId === sourceId) {
    selectNextScreenShare();
  }
}

async function startHostCapture(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    hostCaptureStatus.value = "unavailable";
    hostCaptureError.value = "Browser media capture unavailable";
    return;
  }

  stopHostCapture();
  const captureGeneration = hostCaptureGeneration;
  hostCaptureStatus.value = "requesting";
  hostCaptureError.value = "";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
    });
    if (isComponentUnmounted || captureGeneration !== hostCaptureGeneration) {
      stopMediaStream(stream);
      return;
    }
    hostMediaStream.value = stream;
    hostCaptureStatus.value = "ready";
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () =>
        handleHostTrackEnded(stream, captureGeneration)
      );
    }
  } catch (error) {
    if (isComponentUnmounted || captureGeneration !== hostCaptureGeneration) {
      return;
    }
    hostMediaStream.value = undefined;
    hostCaptureStatus.value = "blocked";
    hostCaptureError.value = error instanceof Error ? error.message : "Unable to capture camera and microphone";
  }
}

function stopHostCapture(): void {
  hostCaptureGeneration += 1;
  const stream = hostMediaStream.value;
  if (!stream) {
    return;
  }

  hostMediaStream.value = undefined;
  stopMediaStream(stream);
}

function stopAllScreenShares(): void {
  const sourceIds = new Set([
    ...screenShareStreams.value.keys(),
    ...screenShareSources.value.map((source) => source.id),
    ...screenShareCaptureGenerations.keys(),
  ]);
  for (const sourceId of sourceIds) {
    stopScreenShare(sourceId);
  }
}

function handleHostTrackEnded(stream: MediaStream, captureGeneration: number): void {
  if (
    captureGeneration !== hostCaptureGeneration ||
    hostMediaStream.value !== stream
  ) {
    return;
  }
  hostCaptureGeneration += 1;
  hostMediaStream.value = undefined;
  stopMediaStream(stream);
  hostCaptureStatus.value = "blocked";
  hostCaptureError.value = "Camera or microphone stream ended";
}

function retryLocalCapture(sourceId: string): void {
  if (sourceId === localCameraSourceId.value) {
    void startHostCapture();
  }
}

function stopMediaStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function syncRoomMediaStreams(payload: RoomMediaPayload): void {
  roomMediaStreams.value = new Map(payload.streams);
  roomMediaSources.value = new Map(payload.sources.map((source) => [source.id, source]));
  roomMediaSnapshotAuthoritative.value = payload.authoritative;
}

function withRuntimeMediaState(source: StudioSource): StudioSource {
  if (source.type === "screen") {
    return screenShareSources.value.some((candidate) => candidate.id === source.id)
      ? withScreenShareCaptureState(source)
      : withRoomMediaState(source);
  }
  if (source.id === localCameraSourceId.value) {
    return withLocalCaptureState(source);
  }

  return withRoomMediaState(source);
}

function isVisibleRuntimeSource(source: StudioSource): boolean {
  if (source.type !== "camera") {
    return true;
  }

  if (source.id === localCameraSourceId.value) {
    return hasProductionControls.value;
  }

  return roomMediaSources.value.has(source.id);
}

function withLocalCaptureState(source: StudioSource): StudioSource {
  return {
    ...source,
    status: hostCaptureStatus.value === "ready"
      ? "ready"
      : hostCaptureStatus.value === "requesting"
        ? "loading"
        : "missing",
    settings: {
      ...source.settings,
      captureError: hostCaptureError.value,
      captureStatus: hostCaptureStatus.value,
    },
  };
}

function withRoomMediaState(source: StudioSource): StudioSource {
  if (!isRoomMediaSource(source) && source.type !== "screen") {
    return source;
  }

  const stream = roomMediaStreams.value.get(source.id);
  const roomSource = roomMediaSources.value.get(source.id);
  if (!stream && !roomSource) {
    return {
      ...source,
      status: "missing",
      settings: {
        ...source.settings,
        captureStatus: "missing",
      },
    };
  }

  return {
    ...source,
    ...roomSource,
    settings: {
      ...source.settings,
      ...roomSource?.settings,
      captureStatus: stream ? "ready" : "missing",
      runtimeSource: "realtimekit",
    },
    status: stream ? "ready" : "missing",
  };
}

function reconcileRuntimeSources(): void {
  if (!hasProductionControls.value || !isSynchronized.value) {
    return;
  }

  const runtimeSources = new Map(roomMediaSources.value);
  const existing = state.value.sources.find((source) => source.id === localCameraSourceId.value);
  runtimeSources.set(localCameraSourceId.value, {
    ...existing,
    id: localCameraSourceId.value,
    name: existing?.name ?? "Producer Camera",
    type: "camera",
    status: hostCaptureStatus.value === "ready"
      ? "ready"
      : hostCaptureStatus.value === "requesting"
        ? "loading"
        : "missing",
    color: existing?.color ?? "#ffb26f",
    label: existing?.label ?? "Producer",
    roles: ["producer"],
    settings: {
      ...existing?.settings,
      captureError: hostCaptureError.value,
      captureStatus: hostCaptureStatus.value,
      runtimeSource: "local",
    },
  });
  for (const source of screenShareSources.value) {
    runtimeSources.set(source.id, source);
  }

  send({
    type: "sources.reconcile",
    authoritativeRuntimeSource: roomMediaSnapshotAuthoritative.value ? "realtimekit" : undefined,
    sources: [...runtimeSources.values()],
  });
}

watch(
  () => [
    isSynchronized.value,
    hostCaptureStatus.value,
    hostMediaStream.value,
    roomMediaSnapshotAuthoritative.value,
    roomMediaSources.value,
    remoteStateEpoch.value,
    screenShareSources.value,
  ] as const,
  () => reconcileRuntimeSources(),
  { immediate: true },
);

function isRoomMediaSource(source: StudioSource): boolean {
  return source.type === "camera" &&
    source.roles?.some((role) => role === "hosts" || role === "guests" || role === "producer") === true;
}

function withScreenShareCaptureState(source: StudioSource): StudioSource {
  const captureState = getScreenShareCaptureState(source.id);
  return {
    ...source,
    status: captureState.status === "ready" ? "ready" : captureState.status === "requesting" ? "loading" : "missing",
    settings: {
      ...source.settings,
      captureError: captureState.error,
      captureStatus: captureState.status,
      runtimeSource: "local",
      selected: source.id === state.value.activeScreenShareSourceId,
    },
  };
}

function getScreenShareSource(sourceId: string): StudioSource | undefined {
  return screenShareSources.value.find((source) => source.id === sourceId);
}

function upsertScreenShareSource(source: StudioSource): void {
  const existingIndex = screenShareSources.value.findIndex((candidate) => candidate.id === source.id);
  if (existingIndex < 0) {
    screenShareSources.value = [...screenShareSources.value, source];
    return;
  }

  screenShareSources.value = screenShareSources.value.map((candidate) =>
    candidate.id === source.id ? source : candidate,
  );
}

function removeScreenShareSource(sourceId: string): void {
  screenShareSources.value = screenShareSources.value.filter((source) => source.id !== sourceId);
}

function getScreenShareName(fallbackName: string, stream: MediaStream, index: number): string {
  const [videoTrack] = stream.getVideoTracks();
  return videoTrack?.label || fallbackName || `Screen Share ${index + 1}`;
}

function getScreenShareColor(index: number): string {
  return ["#39d5c5", "#ff9167", "#7688ff", "#ffb26f"][index % 4] ?? "#39d5c5";
}

function getScreenShareCaptureState(sourceId: string): { error: string; status: CaptureStatus } {
  return screenShareCaptureStates.value[sourceId] ?? { error: "", status: "missing" };
}

function setScreenShareCaptureState(sourceId: string, status: CaptureStatus, error: string): void {
  screenShareCaptureStates.value = {
    ...screenShareCaptureStates.value,
    [sourceId]: {
      error,
      status,
    },
  };
}

function handleScreenShareEnded(
  sourceId: string,
  stream: MediaStream,
  captureGeneration: number,
): void {
  if (
    screenShareCaptureGenerations.get(sourceId) !== captureGeneration ||
    screenShareStreams.value.get(sourceId) !== stream
  ) {
    return;
  }
  screenShareCaptureGenerations.set(sourceId, captureGeneration + 1);
  stopMediaStream(stream);
  const nextStreams = new Map(screenShareStreams.value);
  nextStreams.delete(sourceId);
  screenShareStreams.value = nextStreams;
  const source = getScreenShareSource(sourceId);
  if (source) {
    upsertScreenShareSource({ ...source, status: "missing" });
  }
  setScreenShareCaptureState(sourceId, "ended", "Screen capture ended");
  if (state.value.activeScreenShareSourceId === sourceId) {
    selectNextScreenShare();
  }
}

function persistOwnedScreenCleanup(event?: PageTransitionEvent): void {
  if (
    !shouldPersistOwnedScreenCleanup(event) ||
    !props.sessionId ||
    ownedScreenCleanupSent
  ) {
    return;
  }

  const sourceIds = screenShareSources.value
    .filter((source) => source.settings?.runtimeOwnerId === runtimeOwnerId)
    .map((source) => source.id);
  if (sourceIds.length === 0) {
    return;
  }

  ownedScreenCleanupSent = true;
  void fetch("/api/studio/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "remove-owned-sources",
      ownerId: runtimeOwnerId,
      sessionId: props.sessionId,
      sourceIds,
    }),
    keepalive: true,
  }).catch(() => undefined);
}

function startWidgetResize(event: PointerEvent): void {
  event.preventDefault();
  isResizingWidgets.value = true;
  resizeStartY = event.clientY;
  resizeStartHeight = widgetHeight.value;
  window.addEventListener("pointermove", moveWidgetResize);
  window.addEventListener("pointerup", finishWidgetResize);
  window.addEventListener("pointercancel", finishWidgetResize);
}

function moveWidgetResize(event: PointerEvent): void {
  if (!isResizingWidgets.value) {
    return;
  }

  event.preventDefault();
  widgetHeight.value = clampWidgetHeight(resizeStartHeight + resizeStartY - event.clientY);
}

function finishWidgetResize(): void {
  if (!isResizingWidgets.value) {
    return;
  }

  isResizingWidgets.value = false;
  window.removeEventListener("pointermove", moveWidgetResize);
  window.removeEventListener("pointerup", finishWidgetResize);
  window.removeEventListener("pointercancel", finishWidgetResize);
}

function adjustWidgetHeight(delta: number): void {
  widgetHeight.value = clampWidgetHeight(widgetHeight.value + delta);
}

watch(
  () => state.value.activeOverlays,
  (activeOverlays) => {
    scheduleOverlayTimers(activeOverlays);
  },
  { deep: true },
);

watch(
  activeStingerKey,
  () => {
    scheduleStingerTimer();
  },
);

onBeforeUnmount(() => {
  persistOwnedScreenCleanup();
  isComponentUnmounted = true;
  window.removeEventListener("resize", updateWidgetMaxHeight);
  window.removeEventListener("pagehide", persistOwnedScreenCleanup);
  clearOverlayTimers();
  clearStingerTimer();
  finishWidgetResize();
  stopHostCapture();
  stopAllScreenShares();
});

function scheduleOverlayTimers(activeOverlays: Record<string, ActiveOverlay>): void {
  for (const [layerId, overlay] of Object.entries(activeOverlays)) {
    const timerKey = `${overlay.generation ?? 0}:${overlay.phase}`;
    if (overlayTimerKeys.get(layerId) === timerKey) {
      continue;
    }

    clearOverlayTimer(layerId);
    overlayTimerKeys.set(layerId, timerKey);

    const delaySeconds = getOverlayPhaseDelaySeconds(overlay);
    const eventType = getOverlayPhaseEvent(overlay.phase);
    overlayTimers.set(
      layerId,
      window.setTimeout(() => {
        overlayTimers.delete(layerId);
        overlayTimerKeys.delete(layerId);
        send({ type: eventType, layerId, generation: overlay.generation });
      }, secondsToMilliseconds(delaySeconds)),
    );
  }

  for (const layerId of [...overlayTimerKeys.keys()]) {
    if (!activeOverlays[layerId]) {
      clearOverlayTimer(layerId);
    }
  }
}

function getOverlayPhaseDelaySeconds(overlay: ActiveOverlay): number {
  if (overlay.phase === "entering") {
    return overlay.lifecycle.enter?.durationSeconds ?? 0;
  }

  if (overlay.phase === "visible") {
    return overlay.lifecycle.visibleSeconds ?? 0;
  }

  return overlay.lifecycle.exit?.durationSeconds ?? 0;
}

function getOverlayPhaseEvent(phase: ActiveOverlay["phase"]): "overlay.entered" | "overlay.expire" | "overlay.exited" {
  if (phase === "entering") {
    return "overlay.entered";
  }

  return phase === "visible" ? "overlay.expire" : "overlay.exited";
}

function scheduleStingerTimer(): void {
  const stinger = state.value.activeStinger;
  if (!stinger) {
    clearStingerTimer();
    return;
  }

  if (stingerTimerKey === activeStingerKey.value) {
    return;
  }

  clearStingerTimer();
  stingerTimerKey = activeStingerKey.value;
  const durationSeconds = stinger.effect.durationSeconds ?? 2;
  stingerMidpointTimer = window.setTimeout(() => {
    send({ type: "stinger.midpoint", generation: stinger.generation });
  }, secondsToMilliseconds(durationSeconds / 2));
  stingerTimer = window.setTimeout(() => {
    stingerTimer = undefined;
    stingerMidpointTimer = undefined;
    stingerTimerKey = "";
    send({ type: "stinger.finished", generation: stinger.generation });
  }, secondsToMilliseconds(durationSeconds));
}

function clearOverlayTimers(): void {
  for (const layerId of [...overlayTimers.keys()]) {
    clearOverlayTimer(layerId);
  }
}

function clearOverlayTimer(layerId: string): void {
  const timer = overlayTimers.get(layerId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
  }
  overlayTimers.delete(layerId);
  overlayTimerKeys.delete(layerId);
}

function clearStingerTimer(): void {
  if (stingerTimer !== undefined) {
    window.clearTimeout(stingerTimer);
  }
  if (stingerMidpointTimer !== undefined) {
    window.clearTimeout(stingerMidpointTimer);
  }
  stingerTimer = undefined;
  stingerMidpointTimer = undefined;
  stingerTimerKey = "";
}

function secondsToMilliseconds(seconds: number): number {
  return Math.max(0, Math.round(seconds * 1000));
}

function getEffectKey(effect: { kind: string; transition?: string; sourceId?: string }): string {
  return `${effect.kind}:${effect.transition ?? effect.sourceId ?? "none"}`;
}

function clampWidgetHeight(height: number): number {
  return Math.min(Math.max(Math.round(height), 150), widgetMaxHeight.value);
}

function updateWidgetMaxHeight(): void {
  widgetMaxHeight.value = Math.max(220, Math.round(window.innerHeight * 0.56));
  widgetHeight.value = clampWidgetHeight(widgetHeight.value);
}
</script>

<template>
  <div
    class="studio-app"
    :class="{ 'green-room-app': !hasProductionControls }"
    :style="studioLayoutStyle"
  >
    <header class="top-bar">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true">RS</span>
        <div>
          <h1>{{ props.sessionTitle ?? "Rawkode Studio" }}</h1>
          <span>{{ roomSubtitle }}</span>
        </div>
      </div>
      <div class="top-bar-status" role="status" aria-live="polite">
        <span v-if="props.providerStatus">{{ props.providerStatus }}</span>
        <span v-if="currentRecordingStatus">{{ currentRecordingStatus }}</span>
        <span v-if="props.streamEnvironment">{{ props.streamEnvironment }} stream</span>
        <span v-if="currentStreamStatus">{{ currentStreamStatus }}</span>
        <span v-if="hasProductionControls">programme {{ syncStatus }}</span>
        <span v-if="syncConflictNotice" class="room-error">{{ syncConflictNotice }}</span>
        <span
          v-if="syncError && syncError !== syncConflictNotice"
          class="room-error"
        >
          {{ syncError }}
        </span>
        <button
          v-if="syncConflictNotice"
          class="status-dismiss"
          type="button"
          @click="acknowledgeConflict"
        >
          Dismiss conflict
        </button>
      </div>
      <RealtimeKitRoom
        v-if="props.sessionId && hasProductionControls"
        :invite-token="props.inviteToken"
        :provider-ready="props.providerStatus !== 'Meeting pending'"
        :role="roomRole"
        :session-id="props.sessionId"
        @media-streams-change="syncRoomMediaStreams"
      />
    </header>

    <PeopleRail
      v-if="hasProductionControls && isSynchronized"
      :audio-controls="programmeAudioControls"
      :sources="sourcesForUi"
      @audio-gain-change="setProgrammeAudioSourceGain"
      @audio-mute-change="setProgrammeAudioSourceMuted"
      @connect-source="retryLocalCapture"
    />

    <section
      v-if="hasProductionControls && isSynchronized"
      class="stage-column"
      aria-label="Programme production controls"
    >
      <SceneSwitcher
        :scenes="state.scenes"
        :layers="state.layers"
        :active-scene-id="state.programSceneId"
        @select-scene="selectScene"
      />
      <StudioCanvas
        title="Programme"
        subtitle="Current output"
        :layers="programLayers"
        :active-overlays="state.activeOverlays"
        :active-stinger="state.activeStinger"
        :media-streams="mediaStreams"
        :programme-audio-streams="programmeMediaStreams"
        :audio-mix="state.audioMix"
        :resolution="state.resolution"
        :is-playing="state.isPlaying"
        :is-recording="state.isRecording"
        :session-id="props.sessionId"
        :can-publish-live="canPublishLive"
        :stream-environment="props.streamEnvironment"
        :stream-status="props.streamStatus"
        @recording-change="setRecording"
        @recording-status-change="setRecordingStatus"
        @stream-status-change="setStreamStatus"
        @exported="markProgramExported"
      />
    </section>

    <section
      v-else-if="hasProductionControls"
      class="green-room-stage"
      aria-label="Programme state synchronization"
      aria-live="polite"
    >
      <div class="green-room-panel">
        <p class="eyebrow">Programme state</p>
        <h2>{{ syncStatus === "error" ? "Programme unavailable" : "Loading programme" }}</h2>
        <p v-if="syncError">{{ syncError }}</p>
        <p v-else-if="syncConflictNotice">{{ syncConflictNotice }}</p>
        <p v-else>Restoring the latest scene and overlay state for this session.</p>
      </div>
    </section>

    <section
      v-else
      class="green-room-stage"
      aria-labelledby="green-room-heading"
    >
      <div class="green-room-panel">
        <p class="eyebrow">RealtimeKit green room</p>
        <h2 id="green-room-heading">Join the contributor room</h2>
        <p>
          Use RealtimeKit to check your camera and microphone, then join the other contributors.
          Programme switching, streaming, and recording are managed by the producer.
        </p>
        <RealtimeKitRoom
          v-if="props.sessionId"
          :invite-token="props.inviteToken"
          :provider-ready="props.providerStatus !== 'Meeting pending'"
          :role="roomRole"
          :session-id="props.sessionId"
          @media-streams-change="syncRoomMediaStreams"
        />
      </div>
    </section>

    <div
      v-if="hasProductionControls"
      class="widget-resizer"
      :class="{ active: isResizingWidgets }"
      role="separator"
      aria-label="Resize screen sources panel"
      aria-orientation="horizontal"
      :aria-valuenow="widgetHeight"
      aria-valuemin="150"
      :aria-valuemax="widgetMaxHeight"
      :aria-valuetext="`${widgetHeight} pixels`"
      tabindex="0"
      @pointerdown="startWidgetResize"
      @keydown.up.prevent="adjustWidgetHeight(24)"
      @keydown.down.prevent="adjustWidgetHeight(-24)"
    />

    <StudioWidgets
      v-if="hasProductionControls"
      :sources="sourcesForUi"
      :media-streams="mediaStreams"
      :active-screen-share-source-id="state.activeScreenShareSourceId"
      :audio-controls="programmeAudioControls"
      @audio-gain-change="setProgrammeAudioSourceGain"
      @audio-mute-change="setProgrammeAudioSourceMuted"
      @select-screen-share="selectScreenShare"
      @add-screen-share="addScreenShare"
      @stop-screen-share="stopScreenShare"
      @retry-screen-share="retryScreenShare"
    />
  </div>
</template>
