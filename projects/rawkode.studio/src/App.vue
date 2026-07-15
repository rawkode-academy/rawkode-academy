<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import PeopleRail from "./components/PeopleRail.vue";
import RealtimeKitRoom from "./components/RealtimeKitRoom.vue";
import SceneSwitcher from "./components/SceneSwitcher.vue";
import StudioCanvas from "./components/StudioCanvas.vue";
import StudioWidgets from "./components/StudioWidgets.vue";
import {
  deriveProgrammeLayers,
  getProgrammeMediaReadiness,
  OPERATOR_SOURCE_ID,
} from "./studio/programmeMedia";
import { useStudioMachine } from "./studio/useStudioMachine";
import type { ActiveOverlay, StudioSource } from "./types";

type CaptureStatus = "blocked" | "missing" | "ready" | "requesting" | "unavailable";
type RoomState = "connected" | "connecting" | "idle" | "setup" | "unavailable";
type RoomMediaPayload = {
  sources: StudioSource[];
  streams: Map<string, MediaStream>;
};

const props = defineProps<{
  providerStatus?: string;
  recordingStatus?: string;
  sessionId?: string;
  sessionTitle?: string;
  streamEnvironment?: "prod" | "test";
  streamStatus?: string;
}>();
const {
  state,
  send,
  programLayers,
} = useStudioMachine();

const overlayTimers = new Map<string, number>();
const overlayTimerPhases = new Map<string, ActiveOverlay["phase"]>();
const hostMediaStream = shallowRef<MediaStream | undefined>();
const roomMediaStreams = shallowRef(new Map<string, MediaStream>());
const roomMediaSources = shallowRef(new Map<string, StudioSource>());
const roomState = ref<RoomState>("idle");
const mediaTrackRevision = ref(0);
const screenShareSources = ref<StudioSource[]>([]);
const screenShareStreams = shallowRef(new Map<string, MediaStream>());
const screenShareCaptureStates = ref<Record<string, { error: string; status: CaptureStatus }>>({});
const hostCaptureStatus = ref<CaptureStatus>("requesting");
const hostCaptureError = ref("");
const prodConfirmation = ref("");
const prodConfirmed = ref(false);
const widgetHeight = ref(220);
const isResizingWidgets = ref(false);
let stingerTimer: number | undefined;
let stingerMidpointTimer: number | undefined;
let stingerTimerKey = "";
let resizeStartY = 0;
let resizeStartHeight = 0;
const activeStingerKey = computed(() => {
  const stinger = state.value.activeStinger;
  return stinger ? `${stinger.fromSceneId}:${stinger.toSceneId}:${getEffectKey(stinger.effect)}` : "";
});
const roomSubtitle = computed(() => props.streamEnvironment === "test"
  ? "Operator control room / unlisted Test output with no public page or alerts"
  : "Public production control room");
const localCameraSourceId = OPERATOR_SOURCE_ID;
const studioLayoutStyle = computed(() => ({
  "--widgets-height": `${widgetHeight.value}px`,
}));
const mediaStreams = computed(() => {
  void mediaTrackRevision.value;
  const streams = new Map<string, MediaStream>(roomMediaStreams.value);
  if (hostMediaStream.value) {
    streams.set(localCameraSourceId, hostMediaStream.value);
  }
  for (const [sourceId, stream] of screenShareStreams.value) {
    streams.set(sourceId, stream);
  }

  return streams;
});
const runtimeMediaSources = computed(() => {
  const sources = new Map(roomMediaSources.value);
  const localSource = state.value.sources.find((source) => source.id === localCameraSourceId);
  if (hostMediaStream.value && localSource) {
    sources.set(localCameraSourceId, withLocalCaptureState(localSource));
  } else if (!sources.has(localCameraSourceId) && localSource) {
    sources.set(localCameraSourceId, withLocalCaptureState(localSource));
  }
  for (const source of screenShareSources.value) {
    sources.set(source.id, withScreenShareCaptureState(source));
  }
  return [...sources.values()];
});
const runtimeProgramLayers = computed(() => deriveProgrammeLayers({
  activeScreenShareSourceId: state.value.activeScreenShareSourceId,
  layers: programLayers.value,
  mediaStreams: mediaStreams.value,
  resolution: state.value.resolution,
  runtimeSources: runtimeMediaSources.value,
}));
const programmeMediaReadiness = computed(() => getProgrammeMediaReadiness({
  layers: runtimeProgramLayers.value,
  mediaStreams: mediaStreams.value,
  roomConnected: roomState.value === "connected",
}));
const sourcesForUi = computed(() =>
  [
    ...state.value.sources
      .filter((source) => source.type !== "screen")
      .map(withRuntimeMediaState),
    ...screenShareSources.value.map(withScreenShareCaptureState),
  ],
);

onMounted(() => {
  if (props.streamEnvironment !== "prod") {
    void startHostCapture();
  }
});

function selectScene(id: string): void {
  send({ type: "scene.select", sceneId: id });
}

function setRecording(recording: boolean): void {
  if (state.value.isRecording !== recording) {
    send({ type: "recording.toggle" });
  }
}

function markProgramExported(): void {
  send({ type: "program.exported" });
}

function confirmProdControl(): void {
  if (prodConfirmation.value !== "PROD") {
    return;
  }

  prodConfirmed.value = true;
  prodConfirmation.value = "";
  void startHostCapture();
}

function resetProdConfirmation(): void {
  if (props.streamEnvironment !== "prod") {
    return;
  }

  prodConfirmed.value = false;
  prodConfirmation.value = "";
  stopHostCapture();
  stopAllScreenShares();
}

async function addScreenShare(): Promise<void> {
  const sourceId = `source-screen-share-${Date.now().toString(36)}`;
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
  if (!navigator.mediaDevices?.getDisplayMedia) {
    setScreenShareCaptureState(source.id, "unavailable", "Browser screen capture unavailable");
    return;
  }

  stopScreenShare(source.id);
  upsertScreenShareSource(source);
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
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", () => handleScreenShareEnded(source.id));
      track.addEventListener("mute", handleMediaTrackStateChange);
      track.addEventListener("unmute", handleMediaTrackStateChange);
    }
    const namedSource = {
      ...source,
      name: getScreenShareName(source.name, stream, screenShareSources.value.length),
      status: "ready" as const,
    };
    upsertScreenShareSource(namedSource);
    screenShareStreams.value = new Map(screenShareStreams.value).set(source.id, stream);
    setScreenShareCaptureState(source.id, "ready", "");
    selectScreenShare(namedSource.id);
  } catch (error) {
    setScreenShareCaptureState(
      source.id,
      "blocked",
      error instanceof Error ? error.message : "Unable to capture screen",
    );
    removeScreenShareSource(source.id);
  }
}

function selectScreenShare(sourceId: string): void {
  const source = getScreenShareSource(sourceId);
  send({ type: "screenShare.source.select", sourceId, name: source?.name ?? "Screen Share" });
}

function selectNextScreenShare(): void {
  const [nextSource] = screenShareSources.value;
  send({
    type: "screenShare.source.select",
    sourceId: nextSource?.id ?? "source-host-screen-share",
    name: nextSource?.name ?? "Screen Share",
  });
}

function stopScreenShare(sourceId: string): void {
  const stream = screenShareStreams.value.get(sourceId);
  if (stream) {
    for (const track of stream.getTracks()) {
      track.removeEventListener("mute", handleMediaTrackStateChange);
      track.removeEventListener("unmute", handleMediaTrackStateChange);
      track.stop();
    }
  }
  const nextStreams = new Map(screenShareStreams.value);
  nextStreams.delete(sourceId);
  screenShareStreams.value = nextStreams;
  removeScreenShareSource(sourceId);
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
    hostMediaStream.value = stream;
    hostCaptureStatus.value = "ready";
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", handleHostTrackEnded);
      track.addEventListener("mute", handleMediaTrackStateChange);
      track.addEventListener("unmute", handleMediaTrackStateChange);
    }
  } catch (error) {
    hostMediaStream.value = undefined;
    hostCaptureStatus.value = "blocked";
    hostCaptureError.value = error instanceof Error ? error.message : "Unable to capture camera and microphone";
  }
}

function stopHostCapture(): void {
  const stream = hostMediaStream.value;
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.removeEventListener("ended", handleHostTrackEnded);
    track.removeEventListener("mute", handleMediaTrackStateChange);
    track.removeEventListener("unmute", handleMediaTrackStateChange);
    track.stop();
  }
  hostMediaStream.value = undefined;
}

function stopAllScreenShares(): void {
  for (const sourceId of [...screenShareStreams.value.keys()]) {
    stopScreenShare(sourceId);
  }
}

function handleHostTrackEnded(): void {
  handleMediaTrackStateChange();
  hostMediaStream.value = undefined;
  hostCaptureStatus.value = "blocked";
  hostCaptureError.value = "Camera or microphone stream ended";
}

function handleMediaTrackStateChange(): void {
  mediaTrackRevision.value += 1;
}

function syncRoomMediaStreams(payload: RoomMediaPayload): void {
  roomMediaStreams.value = new Map(payload.streams);
  roomMediaSources.value = new Map(payload.sources.map((source) => [source.id, source]));
}

function syncRoomState(nextState: RoomState): void {
  roomState.value = nextState;
}

function withRuntimeMediaState(source: StudioSource): StudioSource {
  if (source.id === localCameraSourceId) {
    return withLocalCaptureState(source);
  }

  return withRoomMediaState(source);
}

function withLocalCaptureState(source: StudioSource): StudioSource {
  const hasLiveVideo = hostMediaStream.value?.getVideoTracks().some((track) =>
    track.readyState === "live" && track.enabled !== false
  ) === true;
  return {
    ...source,
    label: "Operator",
    name: "Operator Camera",
    status: hasLiveVideo ? "ready" : hostCaptureStatus.value === "requesting" ? "loading" : "missing",
    settings: {
      ...source.settings,
      captureError: hostCaptureError.value,
      captureStatus: hostCaptureStatus.value,
    },
  };
}

function withRoomMediaState(source: StudioSource): StudioSource {
  if (!isRoomMediaSource(source)) {
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
    },
    status: stream ? "ready" : "missing",
  };
}

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

function handleScreenShareEnded(sourceId: string): void {
  handleMediaTrackStateChange();
  const nextStreams = new Map(screenShareStreams.value);
  nextStreams.delete(sourceId);
  screenShareStreams.value = nextStreams;
  removeScreenShareSource(sourceId);
  setScreenShareCaptureState(sourceId, "missing", "");
  if (state.value.activeScreenShareSourceId === sourceId) {
    selectNextScreenShare();
  }
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
  clearOverlayTimers();
  clearStingerTimer();
  finishWidgetResize();
  stopHostCapture();
  stopAllScreenShares();
});

function scheduleOverlayTimers(activeOverlays: Record<string, ActiveOverlay>): void {
  for (const [layerId, overlay] of Object.entries(activeOverlays)) {
    if (overlayTimerPhases.get(layerId) === overlay.phase) {
      continue;
    }

    clearOverlayTimer(layerId);
    overlayTimerPhases.set(layerId, overlay.phase);

    const delaySeconds = getOverlayPhaseDelaySeconds(overlay);
    const eventType = getOverlayPhaseEvent(overlay.phase);
    overlayTimers.set(
      layerId,
      window.setTimeout(() => {
        overlayTimers.delete(layerId);
        overlayTimerPhases.delete(layerId);
        send({ type: eventType, layerId });
      }, secondsToMilliseconds(delaySeconds)),
    );
  }

  for (const layerId of [...overlayTimerPhases.keys()]) {
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
    send({ type: "stinger.midpoint" });
  }, secondsToMilliseconds(durationSeconds / 2));
  stingerTimer = window.setTimeout(() => {
    stingerTimer = undefined;
    stingerMidpointTimer = undefined;
    stingerTimerKey = "";
    send({ type: "stinger.finished" });
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
  overlayTimerPhases.delete(layerId);
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
  const maxHeight = Math.max(220, Math.round(window.innerHeight * 0.56));
  return Math.min(Math.max(Math.round(height), 150), maxHeight);
}
</script>

<template>
  <section v-if="props.streamEnvironment === 'prod' && !prodConfirmed" class="prod-arming-shell">
    <div class="prod-arming-card">
      <p class="eyebrow">Public production safety gate</p>
      <h1>Arm the production control room</h1>
      <p>
        Production can publish to the public watch page and send live alerts. Confirm only after
        the unlisted Test rehearsal has passed.
      </p>
      <label for="prod-control-confirmation">
        Type <strong>PROD</strong> to continue
        <input
          id="prod-control-confirmation"
          v-model="prodConfirmation"
          autocomplete="off"
          inputmode="text"
          spellcheck="false"
          @keydown.enter.prevent="confirmProdControl"
        />
      </label>
      <div class="prod-arming-actions">
        <a class="button" href="/">Return to private dashboard</a>
        <button
          class="prod-arm-button"
          type="button"
          :disabled="prodConfirmation !== 'PROD'"
          @click="confirmProdControl"
        >
          Arm public production
        </button>
      </div>
    </div>
  </section>

  <div v-else class="studio-app" :style="studioLayoutStyle">
    <header class="top-bar">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true">RS</span>
        <div>
          <h1>{{ props.sessionTitle ?? "Rawkode Studio" }}</h1>
          <span>{{ roomSubtitle }}</span>
        </div>
      </div>
      <div class="top-bar-status">
        <span :class="{ 'prod-status': props.streamEnvironment === 'prod' }">
          {{ props.streamEnvironment === "prod" ? "Public production armed" : "Unlisted Test" }}
        </span>
        <span v-if="props.providerStatus">{{ props.providerStatus }}</span>
        <span v-if="props.recordingStatus">{{ props.recordingStatus }}</span>
        <span v-if="props.streamStatus">{{ props.streamStatus }}</span>
      </div>
      <RealtimeKitRoom
        v-if="props.sessionId"
        role="program"
        :session-id="props.sessionId"
        @connection-state-change="syncRoomState"
        @media-streams-change="syncRoomMediaStreams"
      />
    </header>

    <PeopleRail :sources="sourcesForUi" @connect-source="startHostCapture" />

    <main class="stage-column">
      <SceneSwitcher
        :scenes="state.scenes"
        :layers="state.layers"
        :active-scene-id="state.programSceneId"
        @select-scene="selectScene"
      />
      <StudioCanvas
        title="Programme"
        subtitle="Current output"
        :layers="runtimeProgramLayers"
        :active-overlays="state.activeOverlays"
        :active-stinger="state.activeStinger"
        :media-streams="mediaStreams"
        :programme-source-ids="programmeMediaReadiness.sourceIds"
        :publish-blocked-reason="programmeMediaReadiness.reason"
        :resolution="state.resolution"
        :is-playing="state.isPlaying"
        :is-recording="state.isRecording"
        :session-id="props.sessionId"
        :can-publish-live="true"
        :prod-confirmed="prodConfirmed"
        :stream-environment="props.streamEnvironment"
        :stream-status="props.streamStatus"
        @recording-change="setRecording"
        @exported="markProgramExported"
        @prod-confirmation-reset="resetProdConfirmation"
      />
    </main>

    <div
      class="widget-resizer"
      :class="{ active: isResizingWidgets }"
      role="separator"
      aria-label="Resize production tabs"
      aria-orientation="horizontal"
      :aria-valuenow="widgetHeight"
      aria-valuemin="150"
      tabindex="0"
      @pointerdown="startWidgetResize"
      @keydown.up.prevent="adjustWidgetHeight(24)"
      @keydown.down.prevent="adjustWidgetHeight(-24)"
    />

    <StudioWidgets
      :sources="sourcesForUi"
      :media-streams="mediaStreams"
      :active-screen-share-source-id="state.activeScreenShareSourceId"
      @select-screen-share="selectScreenShare"
      @add-screen-share="addScreenShare"
      @stop-screen-share="stopScreenShare"
    />
  </div>
</template>
