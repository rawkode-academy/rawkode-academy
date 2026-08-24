<script setup lang="ts">
import { animate } from "motion";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  createProgrammeAudioMixer,
  requireLiveProgrammeAudioTrack,
  type ProgrammeAudioSourceState,
} from "../audio/programmeAudioMixer";
import { renderProgramCanvas } from "../canvas/programRenderer";
import {
  createRecordingFallbackBlob,
  type RecordingFallbackChunk,
} from "../recording/fallbackBlob";
import {
  appendRecordingUploadChunk,
  createRecordingUploadBuffer,
  flushRecordingUploadRemainder,
  type RecordingUploadBuffer,
} from "../recording/multipartBuffer";
import {
  appendRecordingBackupChunk,
  closeRecordingBackup,
  createRecordingBackup,
  deleteRecordingBackup,
  deleteRecordingBackupArtifact,
  finalizeRecordingBackup,
  listRecordingBackupArtifacts,
  readRecordingBackupArtifact,
  readRecordingBackupChunks,
  type RecordingBackup,
  type RecordingBackupSummary,
} from "../recording/recordingBackup";
import {
  getRecordingHandoffStatusLabel,
  getRecordingHandoffStatusUrl,
  parseRecordingHandoff,
  type RecordingHandoff,
} from "../recording/handoff";
import {
  getRecordingPersistencePolicy,
  shouldUseLocalRecordingFallback,
} from "../recording/uploadFallbackPolicy";
import {
  createWhipTerminalConnectionMonitor,
  startWhipPublishing,
  type WhipPublishSession,
  type WhipTerminalConnectionMonitor,
} from "../live/whipClient";
import {
  createPublisherLeaseHeartbeat,
  type PublisherLeaseHeartbeat,
} from "../live/publisherLease";
import { useCanvasRenderLoop } from "../canvas/useCanvasRenderLoop";
import { getHitTestLayerStack } from "../studio/layerStack";
import type {
  ActiveOverlay,
  ActiveSceneStinger,
  CanvasResolution,
  StudioAudioMixControl,
  StudioLayer,
} from "../types";

type MotionAnimationControls = ReturnType<typeof animate>;
type LivePublishStatus = "confirming" | "ended" | "failed" | "idle" | "live" | "starting" | "stopping";
type RecordingUploadStatus = "failed" | "idle" | "local" | "ready" | "uploading";

interface RecordingUploadPart {
  etag: string;
  partNumber: number;
}

interface RecordingUpload {
  failedMessage: string;
  heartbeatIntervalMs: number;
  partSizeBytes: number;
  parts: RecordingUploadPart[];
  buffer: RecordingUploadBuffer;
  nextPartNumber: number;
  recordingId: string;
  sessionId: string;
  sourceFormat: "webm";
  uploadChain: Promise<void>;
  uploadId: string;
}

type RecordingAbortResult =
  | {
      aborted: true;
      handoff: null;
      outcome: "aborted";
      recovered: false;
    }
  | {
      aborted: false;
      handoff: unknown;
      outcome: "recovered";
      recovered: true;
    };

class StudioRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const props = defineProps<{
  activeOverlays?: Record<string, ActiveOverlay>;
  activeStinger?: ActiveSceneStinger;
  audioMix?: Record<string, StudioAudioMixControl>;
  layers: StudioLayer[];
  mediaStreams?: Map<string, MediaStream>;
  programmeAudioStreams?: Map<string, MediaStream>;
  resolution: CanvasResolution;
  isPlaying: boolean;
  isRecording: boolean;
  sessionId?: string;
  canPublishLive?: boolean;
  streamEnvironment?: "prod" | "test";
  streamStatus?: string;
  title: string;
  subtitle?: string;
  interactive?: boolean;
}>();

const emit = defineEmits<{
  exported: [];
  "recording-change": [recording: boolean];
  "recording-status-change": [status: string];
  "select-layer": [id: string];
  "stream-status-change": [status: string];
  "update-layer-bounds": [id: string, bounds: StudioLayer["bounds"]];
}>();

const canvasElement = ref<HTMLCanvasElement | null>(null);
const frameElement = ref<HTMLElement | null>(null);
const programmeAudioMixer = createProgrammeAudioMixer();
const programmeAudioLevel = ref(0);
const canvasDisplaySize = ref({ width: 0, height: 0 });
const canRecordLocally = typeof MediaRecorder !== "undefined";
const hasExternalLivePublish =
  props.streamStatus === "live" || props.streamStatus === "starting";
const isDragging = ref(false);
const isFinishingRecording = ref(false);
const isHandlingTerminalLivePublish = ref(false);
const livePublishError = ref("");
const livePublishStatus = ref<LivePublishStatus>(
  hasExternalLivePublish
    ? "idle"
    : props.streamStatus === "ended"
      ? "ended"
      : "idle",
);
const isLocalRecording = ref(false);
const isStartingLivePublish = ref(false);
const canTakeOverLivePublish = ref(hasExternalLivePublish);
const isStartingRecording = ref(false);
const recordingUploadError = ref("");
const recordingUploadStatus = ref<RecordingUploadStatus>("idle");
const completedRecording = ref<RecordingHandoff | null>(null);
const recordingRecoveryArtifacts = ref<RecordingBackupSummary[]>([]);
const recordingRecoveryActionId = ref("");
const recordingRecoveryError = ref("");
const recordingRecoveryStatus = ref("");
const isLoadingRecordingRecovery = ref(false);
const overlayPhaseStarts = new Map<string, { phase: ActiveOverlay["phase"]; startedAt: number }>();
const overlayTransitionProgresses = new Map<string, number>();
const overlayAnimations = new Map<string, MotionAnimationControls>();
let bufferCanvas: HTMLCanvasElement | undefined;
let frameResizeObserver: ResizeObserver | undefined;
let programmeAudioMeterTimer: number | undefined;
let isResumingProgrammeAudio = false;
let mediaRecorder: MediaRecorder | undefined;
let recordedChunks: RecordingFallbackChunk[] = [];
let recordingBackup: RecordingBackup | undefined;
let recordingChunkIndex = 0;
let recordingTerminalError = "";
let recordingFinishPromise: Promise<void> | undefined;
let recordingHeartbeatTimer: number | undefined;
let recordingUpload: RecordingUpload | undefined;
let recordingOwnedVideoTracks: MediaStreamTrack[] = [];
let livePublishSession: WhipPublishSession | undefined;
let livePublishAbortController: AbortController | undefined;
let liveOwnedVideoTracks: MediaStreamTrack[] = [];
let liveServerStreamStarted = false;
let ownsLivePublish = false;
let livePublishGeneration = 0;
let livePublishConnectionMonitor: WhipTerminalConnectionMonitor | undefined;
let liveStreamToken: string | undefined;
let livePublisherLease: PublisherLeaseHeartbeat | undefined;
let isComponentUnmounted = false;
const mediaVideoElements = new Map<string, HTMLVideoElement>();
let stingerAnimation: MotionAnimationControls | undefined;
let stingerProgress: number | undefined;
let stingerStartedAt: number | undefined;
let dragState:
  | {
      layerId: string;
      pointerId: number;
      offsetX: number;
      offsetY: number;
    }
  | undefined;
const renderLoop = useCanvasRenderLoop(paint, () => props.isPlaying);
const canvasStyle = computed(() => ({
  width: canvasDisplaySize.value.width > 0 ? `${canvasDisplaySize.value.width}px` : "100%",
  height: canvasDisplaySize.value.height > 0 ? `${canvasDisplaySize.value.height}px` : "auto",
  aspectRatio: `${props.resolution.width} / ${props.resolution.height}`,
}));
const programmeAudioLevelPercent = computed(() => Math.round(programmeAudioLevel.value * 100));
const programmeAudioLevelText = computed(() =>
  programmeAudioLevelPercent.value === 0
    ? "No mixed programme audio detected"
    : `Mixed programme audio level ${programmeAudioLevelPercent.value} percent`,
);
const programmeAudioMeterFillStyle = computed(() => ({
  transform: `scaleX(${programmeAudioLevel.value})`,
}));
const showRecordingRecovery = computed(() =>
  isLoadingRecordingRecovery.value ||
  recordingRecoveryArtifacts.value.length > 0 ||
  Boolean(recordingRecoveryError.value) ||
  Boolean(recordingRecoveryStatus.value),
);
const recordingPersistencePolicy = computed(() =>
  getRecordingPersistencePolicy(props.streamEnvironment)
);
const recordingStatusText = computed(() => {
  if (recordingUploadStatus.value === "uploading") {
    return "Uploading recording";
  }
  if (recordingUploadStatus.value === "ready") {
    if (completedRecording.value) {
      return getRecordingHandoffStatusLabel(completedRecording.value);
    }
    return "Recording uploaded";
  }
  if (recordingUploadStatus.value === "local") {
    if (recordingPersistencePolicy.value === "local-only") {
      const label = props.streamEnvironment === "test" ? "Test recording" : "Local-only recording";
      return isLocalRecording.value
        ? `${label} · local only`
        : `${label} saved locally · recovery retained`;
    }
    return isLocalRecording.value ? "Local recording" : "Saved locally · recovery retained";
  }
  if (recordingUploadStatus.value === "failed") {
    return recordingUploadError.value;
  }
  return "";
});
const recordingStatusHref = computed(() =>
  completedRecording.value
    ? getRecordingHandoffStatusUrl(completedRecording.value)
    : "",
);
const liveStatusText = computed(() => {
  if (canTakeOverLivePublish.value && livePublishStatus.value === "idle") {
    const externalState = props.streamStatus === "starting" ? "is starting" : "is live";
    return `${props.streamEnvironment === "prod" ? "Prod" : "Test"} stream ${externalState} from another publisher`;
  }
  if (livePublishStatus.value === "starting") return "Starting live stream";
  if (livePublishStatus.value === "confirming") return "Confirming stream";
  if (livePublishStatus.value === "live") {
    return `${props.streamEnvironment === "prod" ? "Prod" : "Test"} stream live`;
  }
  if (livePublishStatus.value === "stopping") return "Stopping stream";
  if (livePublishStatus.value === "ended") return "Stream ended";
  if (livePublishStatus.value === "failed") return livePublishError.value;
  return "";
});
watch(recordingStatusText, (status) => {
  if (status) emit("recording-status-change", status);
}, {
  immediate: true,
});
watch(liveStatusText, (status) => {
  if (status) emit("stream-status-change", status);
}, {
  immediate: true,
});
const liveButtonLabel = computed(() => {
  if (livePublishStatus.value === "starting" || livePublishStatus.value === "confirming") {
    return "Cancel live start";
  }
  if (livePublishStatus.value === "stopping") return "Stopping";
  if (canTakeOverLivePublish.value) return "Take over live";
  if (livePublishStatus.value === "live") return "Stop live";
  return "Go live";
});
const liveButtonDisabled = computed(() =>
  !props.sessionId ||
  isHandlingTerminalLivePublish.value ||
  livePublishStatus.value === "stopping",
);

async function paint(timestamp = performance.now()): Promise<void> {
  const canvas = canvasElement.value;
  if (!canvas) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = props.resolution.width * ratio;
  const backingHeight = props.resolution.height * ratio;

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const buffer = getBufferCanvas(backingWidth, backingHeight);
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) {
    return;
  }

  bufferContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  await renderProgramCanvas(bufferContext, {
    activeOverlays: props.activeOverlays,
    activeStinger: props.activeStinger,
    layers: props.layers,
    mediaVideoElements: getMediaVideoElements(),
    overlayTransitionProgresses: getOverlayTransitionProgresses(),
    overlayTransitionStarts: getOverlayTransitionStarts(),
    resolution: props.resolution,
    isRecording: props.isRecording,
    stingerProgress,
    stingerStartedAt,
    timestamp,
  });
  bufferContext.setTransform(1, 0, 0, 1, 0, 0);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, backingWidth, backingHeight);
  context.drawImage(buffer, 0, 0);
}

function getBufferCanvas(width: number, height: number): HTMLCanvasElement {
  if (!bufferCanvas) {
    bufferCanvas = document.createElement("canvas");
  }

  if (bufferCanvas.width !== width || bufferCanvas.height !== height) {
    bufferCanvas.width = width;
    bufferCanvas.height = height;
  }

  return bufferCanvas;
}

function exportPng(): void {
  const canvas = canvasElement.value;
  if (!canvas) {
    return;
  }

  const link = document.createElement("a");
  link.download = "rawkode-studio-program.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  emit("exported");
}

function captureCanvasStream(): MediaStream | undefined {
  return canvasElement.value?.captureStream(props.resolution.fps);
}

async function toggleLocalRecording(): Promise<void> {
  if (isFinishingRecording.value || isStartingRecording.value) {
    return;
  }
  if (isLocalRecording.value) {
    stopLocalRecording();
    return;
  }

  await startLocalRecording();
}

async function startLocalRecording(): Promise<void> {
  if (isStartingRecording.value || isLocalRecording.value) {
    return;
  }
  isStartingRecording.value = true;
  try {
    if (typeof MediaRecorder === "undefined") {
      return;
    }

    const recordingStream = await createRecordingStream();
    if (!recordingStream) {
      return;
    }
    if (isComponentUnmounted) {
      finishLocalRecording();
      return;
    }

    const mimeType = getSupportedRecordingMimeType();
    recordedChunks = [];
    recordingChunkIndex = 0;
    recordingTerminalError = "";
    recordingBackup = await createRecordingBackup(mimeType || "video/webm").catch(
      (error: unknown) => {
        recordingUploadError.value = toErrorMessage(error);
        return undefined;
      },
    );
    if (!recordingBackup) {
      throw new Error(
        recordingUploadError.value || "Browser recording backup storage is required before recording can start.",
      );
    }
    if (await cleanupPendingRecordingStartAfterUnmount()) {
      return;
    }

    recordingUploadStatus.value = "idle";
    recordingUploadError.value = "";
    completedRecording.value = null;
    if (recordingPersistencePolicy.value === "local-only") {
      recordingUpload = undefined;
      recordingUploadStatus.value = "local";
    } else {
      recordingUpload = await createRecordingUpload(mimeType).catch((error: unknown) => {
        if (
          error instanceof StudioRequestError &&
          !shouldUseLocalRecordingFallback(error.status)
        ) {
          throw error;
        }
        recordingUploadStatus.value = "local";
        recordingUploadError.value = toErrorMessage(error);
        return undefined;
      });
    }
    if (await cleanupPendingRecordingStartAfterUnmount()) {
      return;
    }

    mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        const chunkIndex = recordingChunkIndex;
        recordingChunkIndex += 1;
        if (recordingBackup && !recordingBackup.failedMessage) {
          appendRecordingBackupChunk(recordingBackup, chunkIndex, event.data).catch(
            (error: unknown) => {
              recordedChunks.push({ chunk: event.data, chunkIndex });
              handleRecordingTerminalError(
                `Browser recording recovery storage failed: ${toErrorMessage(error)}`,
              );
            },
          );
        } else {
          recordedChunks.push({ chunk: event.data, chunkIndex });
        }
        if (recordingUpload) {
          queueRecordingChunk(event.data);
        }
      }
    });
    mediaRecorder.addEventListener("stop", () => {
      queueFinishRecordingArtifact();
    });
    mediaRecorder.addEventListener("error", (event) => {
      const recorderError = (event as Event & { error?: DOMException }).error;
      handleRecordingTerminalError(
        recorderError?.message || "The browser recording encoder failed.",
      );
    });
    mediaRecorder.start(1000);
    startRecordingHeartbeat(recordingUpload);
    isLocalRecording.value = true;
    emit("recording-change", true);
  } catch (error) {
    recordingUploadStatus.value = "failed";
    recordingUploadError.value = toErrorMessage(error);
    await abortRecordingUpload(recordingUpload);
    await deleteRecordingBackup(recordingBackup).catch((backupError: unknown) => {
      console.warn("Unable to delete recording backup", backupError);
    });
    finishLocalRecording();
  } finally {
    isStartingRecording.value = false;
  }
}

async function cleanupPendingRecordingStartAfterUnmount(): Promise<boolean> {
  if (!isComponentUnmounted) {
    return false;
  }

  await cleanupPendingRecordingStart();
  return true;
}

async function cleanupPendingRecordingStart(): Promise<void> {
  await abortRecordingUpload(recordingUpload);
  await deleteRecordingBackup(recordingBackup).catch((error: unknown) => {
    console.warn("Unable to delete recording backup", error);
  });
  finishLocalRecording();
}

function stopLocalRecording(): void {
  if (isFinishingRecording.value) {
    return;
  }
  if (!mediaRecorder) {
    finishLocalRecording();
    return;
  }

  isFinishingRecording.value = true;
  if (mediaRecorder.state === "inactive") {
    queueFinishRecordingArtifact();
    return;
  }

  mediaRecorder.stop();
}

function handleRecordingTerminalError(message: string): void {
  if (recordingTerminalError) return;

  recordingTerminalError = message;
  recordingUploadStatus.value = "failed";
  recordingUploadError.value = message;
  if (recordingUpload) {
    recordingUpload.failedMessage = message;
  }
  isFinishingRecording.value = true;

  const recorder = mediaRecorder;
  if (!recorder || recorder.state === "inactive") {
    queueFinishRecordingArtifact();
    return;
  }
  try {
    recorder.requestData();
  } catch {
    // Stopping still gives the encoder a chance to emit any recoverable tail.
  }
  try {
    recorder.stop();
  } catch {
    queueFinishRecordingArtifact();
  }
}

function flushLocalRecordingForVisibilityChange(): void {
  if (document.visibilityState !== "hidden") return;

  const recorder = mediaRecorder;
  if (!recorder || recorder.state !== "recording" || isFinishingRecording.value) {
    return;
  }
  try {
    recorder.requestData();
  } catch {
    // The one-second timeslice remains as the fallback flush cadence.
  }
}

function preserveLocalRecordingForPageHide(): void {
  const recorder = mediaRecorder;
  if (
    !recorder ||
    recorder.state !== "recording" ||
    isFinishingRecording.value
  ) {
    return;
  }

  isFinishingRecording.value = true;
  try {
    recorder.requestData();
  } catch {
    // The subsequent stop still gives MediaRecorder a chance to emit its final data.
  }
  try {
    recorder.stop();
  } catch {
    isFinishingRecording.value = false;
  }
}

function queueFinishRecordingArtifact(): void {
  if (!recordingFinishPromise) {
    recordingFinishPromise = finishRecordingArtifact().finally(() => {
      recordingFinishPromise = undefined;
    });
  }
  void recordingFinishPromise;
}

async function finishRecordingArtifact(): Promise<void> {
  const mimeType = mediaRecorder?.mimeType || "video/webm";
  const upload = recordingUpload;
  let deleteBackupAfterFinish = false;
  isFinishingRecording.value = true;
  try {
    await finalizeRecordingBackup(
      recordingBackup,
      recordingChunkIndex,
      recordingTerminalError,
    ).catch((error: unknown) => {
      recordingRecoveryError.value =
        `Recording recovery metadata could not be finalized: ${toErrorMessage(error)}`;
    });
    if (recordingBackup?.failedMessage && !recordingTerminalError) {
      handleRecordingTerminalError(
        `Browser recording recovery storage failed: ${recordingBackup.failedMessage}`,
      );
    }
    if (recordingTerminalError) {
      await upload?.uploadChain.catch(() => undefined);
      const abortResult = await abortRecordingUpload(upload);
      if (applyRecoveredRecordingAbort(abortResult)) {
        deleteBackupAfterFinish = true;
        recordingRecoveryStatus.value =
          "The completed server recording was recovered and its browser backup was removed.";
        return;
      }
      const partialBlob = await readRecordingFallbackBlob(mimeType).catch(() => null);
      if (partialBlob) {
        downloadRecording(partialBlob);
      }
      recordingRecoveryStatus.value =
        "Recording stopped after a browser media failure. Its incomplete browser recovery copy was retained.";
      return;
    }
    if (upload) {
      completedRecording.value = await completeRecordingUpload(upload);
      recordingUploadStatus.value = "ready";
      deleteBackupAfterFinish = true;
    } else {
      const localBlob = await readRecordingFallbackBlob(mimeType);
      if (!localBlob) {
        throw new Error(recordingUploadError.value || "No recording data was available to download.");
      }
      downloadRecording(localBlob);
      recordingRecoveryStatus.value =
        "Local download started. Its browser recovery copy remains until you discard it.";
    }
  } catch (error) {
    const failureMessage = toErrorMessage(error);
    recordingUploadStatus.value = "failed";
    recordingUploadError.value = failureMessage;
    const abortResult = await abortRecordingUpload(upload);
    if (applyRecoveredRecordingAbort(abortResult)) {
      deleteBackupAfterFinish = true;
      recordingRecoveryStatus.value =
        "The completed server recording was recovered and its browser backup was removed.";
      return;
    }
    if (upload) {
      const localBlob = await readRecordingFallbackBlob(mimeType).catch(
        (fallbackError: unknown) => {
          recordingRecoveryError.value = `The upload failed and the browser backup could not be read: ${toErrorMessage(fallbackError)}`;
          return null;
        },
      );
      if (localBlob) {
        downloadRecording(localBlob);
      }
      recordingUploadError.value = failureMessage;
      recordingRecoveryStatus.value = "The upload failed. Its browser recovery copy was retained.";
    } else {
      recordingRecoveryStatus.value = "The local recording could not be finalized. Its browser recovery copy was retained.";
    }
  } finally {
    await settleRecordingBackup(deleteBackupAfterFinish);
    finishLocalRecording();
  }
}

function downloadRecording(
  blob: Blob,
  recordedAt = Date.now(),
  updateRecordingStatus = true,
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date(recordedAt).toISOString().replace(/[:.]/g, "-");
  link.download = `rawkode-studio-${updateRecordingStatus ? "program" : "recovery"}-${timestamp}.webm`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  if (updateRecordingStatus && recordingUploadStatus.value !== "failed") {
    recordingUploadStatus.value = "local";
  }
}

async function readRecordingFallbackBlob(mimeType: string): Promise<Blob | null> {
  const backupChunks = await readRecordingBackupChunks(recordingBackup);
  const chunksByIndex = new Map<number, RecordingFallbackChunk>();
  for (const row of backupChunks) {
    chunksByIndex.set(row.chunkIndex, row);
  }
  for (const row of recordedChunks) {
    chunksByIndex.set(row.chunkIndex, row);
  }

  return createRecordingFallbackBlob([...chunksByIndex.values()], mimeType);
}

async function settleRecordingBackup(deleteAfterFinish: boolean): Promise<void> {
  const backup = recordingBackup;
  if (!backup) return;

  if (deleteAfterFinish) {
    try {
      await deleteRecordingBackup(backup);
      return;
    } catch (error) {
      await closeRecordingBackup(backup).catch(() => undefined);
      await refreshRecordingRecoveryArtifacts();
      recordingRecoveryError.value =
        `The recording completed, but its browser backup could not be removed: ${toErrorMessage(error)}`;
      return;
    }
  }

  let closeError = "";
  await closeRecordingBackup(backup).catch((error: unknown) => {
    closeError = toErrorMessage(error);
  });
  await refreshRecordingRecoveryArtifacts(true);
  if (closeError) {
    recordingRecoveryError.value =
      `The recovery copy was retained, but its browser database could not be closed cleanly: ${closeError}`;
  }
}

async function refreshRecordingRecoveryArtifacts(preserveError = false): Promise<void> {
  isLoadingRecordingRecovery.value = true;
  if (!preserveError) {
    recordingRecoveryError.value = "";
  }
  try {
    recordingRecoveryArtifacts.value = (await listRecordingBackupArtifacts())
      .filter((artifact) => artifact.chunkCount > 0 && artifact.size > 0);
  } catch (error) {
    recordingRecoveryError.value =
      `Unable to inspect browser recording backups: ${toErrorMessage(error)}`;
  } finally {
    isLoadingRecordingRecovery.value = false;
  }
}

async function downloadRecordingRecovery(artifact: RecordingBackupSummary): Promise<void> {
  if (recordingRecoveryActionId.value) return;

  recordingRecoveryActionId.value = artifact.id;
  recordingRecoveryError.value = "";
  recordingRecoveryStatus.value = "";
  try {
    const recovered = await readRecordingBackupArtifact(artifact.id);
    if (!recovered || recovered.size === 0) {
      throw new Error("This browser recovery copy no longer contains recording data.");
    }
    downloadRecording(recovered.blob, recovered.createdAt, false);
    recordingRecoveryStatus.value =
      "Recovery download started. The browser copy remains until you discard it.";
  } catch (error) {
    recordingRecoveryError.value =
      `Unable to download the recovery copy: ${toErrorMessage(error)}`;
  } finally {
    recordingRecoveryActionId.value = "";
  }
}

async function discardRecordingRecovery(artifact: RecordingBackupSummary): Promise<void> {
  if (
    recordingRecoveryActionId.value ||
    !window.confirm(
      `Discard the recording recovery copy from ${formatRecordingRecoveryTimestamp(artifact.createdAt)}? This cannot be undone.`,
    )
  ) {
    return;
  }

  recordingRecoveryActionId.value = artifact.id;
  recordingRecoveryError.value = "";
  recordingRecoveryStatus.value = "";
  try {
    await deleteRecordingBackupArtifact(artifact.id);
    await refreshRecordingRecoveryArtifacts();
    recordingRecoveryStatus.value = "Browser recording recovery copy discarded.";
  } catch (error) {
    recordingRecoveryError.value =
      `Unable to discard the recovery copy: ${toErrorMessage(error)}`;
  } finally {
    recordingRecoveryActionId.value = "";
  }
}

function formatRecordingRecoveryTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "an unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getRecordingRecoveryDateTime(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return new Date(timestamp).toISOString();
}

function formatRecordingRecoverySize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`;
  }
  return `${size} B`;
}

function getRecordingRecoveryIntegrityLabel(artifact: RecordingBackupSummary): string {
  if (artifact.integrity === "complete") {
    return "Finalized recovery copy";
  }
  if (artifact.integrity === "gapped") {
    return "Incomplete copy · missing chunks";
  }
  return "Incomplete copy · recording did not finalize";
}

function finishLocalRecording(): void {
  clearRecordingHeartbeat();
  for (const track of recordingOwnedVideoTracks) {
    track.stop();
  }
  recordingOwnedVideoTracks = [];
  mediaRecorder = undefined;
  recordedChunks = [];
  recordingBackup = undefined;
  recordingChunkIndex = 0;
  recordingTerminalError = "";
  recordingFinishPromise = undefined;
  recordingUpload = undefined;
  isFinishingRecording.value = false;
  isLocalRecording.value = false;
  isStartingRecording.value = false;
  emit("recording-change", false);
  if (isComponentUnmounted) {
    void programmeAudioMixer.close();
  }
}

async function createRecordingUpload(mimeType: string): Promise<RecordingUpload | undefined> {
  if (recordingPersistencePolicy.value !== "persistent" || !props.sessionId) {
    return undefined;
  }
  const sourceFormat = getRecordingSourceFormat(mimeType);
  const response = await fetch("/api/studio/recording-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create",
      sessionId: props.sessionId,
      sourceFormat,
    }),
  });
  if (!response.ok) {
    throw new StudioRequestError(await readErrorResponse(response), response.status);
  }
  const upload = await response.json() as {
    heartbeatIntervalMs?: number;
    partSizeBytes: number;
    recordingId: string;
    sessionId: string;
    sourceFormat: "webm";
    uploadId: string;
  };

  return {
    failedMessage: "",
    heartbeatIntervalMs: normalizeRecordingHeartbeatInterval(upload.heartbeatIntervalMs),
    partSizeBytes: upload.partSizeBytes,
    parts: [],
    buffer: createRecordingUploadBuffer("video/webm"),
    nextPartNumber: 1,
    recordingId: upload.recordingId,
    sessionId: upload.sessionId,
    sourceFormat: upload.sourceFormat,
    uploadChain: Promise.resolve(),
    uploadId: upload.uploadId,
  };
}

function startRecordingHeartbeat(upload: RecordingUpload | undefined): void {
  clearRecordingHeartbeat();
  if (!upload) return;

  let heartbeatInFlight = false;
  recordingHeartbeatTimer = window.setInterval(() => {
    if (heartbeatInFlight || recordingUpload !== upload || recordingTerminalError) {
      return;
    }
    heartbeatInFlight = true;
    void postRecordingHeartbeat(upload)
      .catch((error: unknown) => {
        if (recordingUpload !== upload || recordingTerminalError) return;
        handleRecordingTerminalError(
          `Recording upload lease was lost: ${toErrorMessage(error)}`,
        );
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, upload.heartbeatIntervalMs);
}

function clearRecordingHeartbeat(): void {
  if (recordingHeartbeatTimer !== undefined) {
    window.clearInterval(recordingHeartbeatTimer);
    recordingHeartbeatTimer = undefined;
  }
}

async function postRecordingHeartbeat(upload: RecordingUpload): Promise<void> {
  const response = await fetch("/api/studio/recording-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "heartbeat",
      recordingId: upload.recordingId,
      sessionId: upload.sessionId,
    }),
  });
  if (!response.ok) {
    throw new StudioRequestError(await readErrorResponse(response), response.status);
  }
}

function normalizeRecordingHeartbeatInterval(value: number | undefined): number {
  if (!Number.isFinite(value)) return 30_000;
  return Math.min(Math.max(Math.round(value ?? 30_000), 5_000), 60_000);
}

function queueRecordingChunk(chunk: Blob): void {
  const upload = recordingUpload;
  if (!upload || upload.failedMessage) {
    return;
  }

  for (const part of appendRecordingUploadChunk(
    upload.buffer,
    chunk,
    upload.partSizeBytes,
  )) {
    queueRecordingPart(upload, part);
  }
}

function queueRecordingPart(upload: RecordingUpload, part: Blob): void {
  if (part.size === 0) {
    return;
  }

  const partNumber = upload.nextPartNumber;
  upload.nextPartNumber += 1;
  recordingUploadStatus.value = "uploading";
  upload.uploadChain = upload.uploadChain
    .then(async () => {
      if (upload.failedMessage) {
        return;
      }
      const uploadedPart = await uploadRecordingPart(upload, partNumber, part);
      upload.parts.push(uploadedPart);
    })
    .catch((error: unknown) => {
      upload.failedMessage = toErrorMessage(error);
    });
}

async function uploadRecordingPart(
  upload: RecordingUpload,
  partNumber: number,
  part: Blob,
): Promise<RecordingUploadPart> {
  const params = new URLSearchParams({
    partNumber: String(partNumber),
    recordingId: upload.recordingId,
    sessionId: upload.sessionId,
    sourceFormat: upload.sourceFormat,
    uploadId: upload.uploadId,
  });
  const response = await fetch(`/api/studio/recording-upload?${params.toString()}`, {
    method: "PUT",
    body: part,
  });
  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return await response.json() as RecordingUploadPart;
}

async function completeRecordingUpload(upload: RecordingUpload): Promise<RecordingHandoff> {
  const finalPart = flushRecordingUploadRemainder(upload.buffer);
  if (finalPart) {
    queueRecordingPart(upload, finalPart);
  }
  await upload.uploadChain;
  if (recordingTerminalError) {
    throw new Error(recordingTerminalError);
  }
  if (upload.failedMessage) {
    throw new Error(upload.failedMessage);
  }

  const response = await fetch("/api/studio/recording-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      parts: upload.parts,
      recordingId: upload.recordingId,
      sessionId: upload.sessionId,
      sourceFormat: upload.sourceFormat,
      uploadId: upload.uploadId,
    }),
  });
  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }
  return parseRecordingHandoff(await response.json().catch(() => null));
}

async function abortRecordingUpload(
  upload: RecordingUpload | undefined,
): Promise<RecordingAbortResult | undefined> {
  if (!upload) {
    return undefined;
  }

  const params = new URLSearchParams({
    recordingId: upload.recordingId,
    sessionId: upload.sessionId,
    sourceFormat: upload.sourceFormat,
    uploadId: upload.uploadId,
  });
  const response = await fetch(`/api/studio/recording-upload?${params.toString()}`, {
    method: "DELETE",
  }).catch(() => undefined);
  if (!response?.ok) return undefined;

  const result = await response.json().catch(() => null) as RecordingAbortResult | null;
  return result?.outcome === "aborted" || result?.outcome === "recovered"
    ? result
    : undefined;
}

function applyRecoveredRecordingAbort(
  result: RecordingAbortResult | undefined,
): boolean {
  if (result?.outcome !== "recovered" || !result.handoff) {
    return false;
  }

  try {
    completedRecording.value = parseRecordingHandoff(result.handoff);
    recordingUploadStatus.value = "ready";
    recordingUploadError.value = "";
    return true;
  } catch {
    return false;
  }
}

async function toggleLivePublishing(): Promise<void> {
  if (liveButtonDisabled.value) {
    return;
  }
  if (canTakeOverLivePublish.value) {
    await takeOverLivePublishing();
    return;
  }
  if (
    livePublishStatus.value === "live" ||
    livePublishStatus.value === "starting" ||
    livePublishStatus.value === "confirming"
  ) {
    await stopLivePublishing();
    return;
  }

  await startLivePublishing();
}

async function takeOverLivePublishing(): Promise<void> {
  if (!props.sessionId || livePublishStatus.value === "stopping") {
    return;
  }

  canTakeOverLivePublish.value = false;
  livePublishStatus.value = "stopping";
  livePublishError.value = "Waiting for the previous publisher to disconnect";
  try {
    await postStreamAction("takeover");
    await delay(6_000);
    if (isComponentUnmounted) {
      return;
    }
    livePublishStatus.value = "ended";
    livePublishError.value = "";
    await startLivePublishing();
  } catch (error) {
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
  }
}

async function startLivePublishing(): Promise<void> {
  if (
    !props.sessionId ||
    isStartingLivePublish.value ||
    isHandlingTerminalLivePublish.value
  ) {
    return;
  }

  isStartingLivePublish.value = true;
  const publishGeneration = livePublishGeneration + 1;
  livePublishGeneration = publishGeneration;
  livePublishStatus.value = "starting";
  livePublishError.value = "";
  canTakeOverLivePublish.value = false;
  const streamToken = crypto.randomUUID();
  liveStreamToken = streamToken;
  try {
    const start = await postStreamAction<{
      liveInputId: string;
      playbackUrl: string;
      publishUrl: string;
      streamStatus: "starting";
      streamToken: string;
    }>("start", { streamToken });
    liveStreamToken = streamToken;
    liveServerStreamStarted = true;
    startLiveHeartbeat(publishGeneration, streamToken);
    if (publishGeneration !== livePublishGeneration) {
      await postStreamAction("stop", { keepalive: true, streamToken }).catch(() => undefined);
      liveServerStreamStarted = false;
      if (liveStreamToken === streamToken) {
        liveStreamToken = undefined;
      }
      return;
    }
    const programmeStream = await createProgrammeOutputStream((tracks) => {
      liveOwnedVideoTracks = tracks;
    });
    if (!programmeStream) {
      throw new Error("Programme canvas stream is not available.");
    }
    if (publishGeneration !== livePublishGeneration || isComponentUnmounted) {
      throw new Error("Live publishing stopped before media setup completed.");
    }
    const abortController = new AbortController();
    livePublishAbortController = abortController;
    const publishSession = await startWhipPublishing({
      publishUrl: start.publishUrl,
      signal: abortController.signal,
      stream: programmeStream,
    });
    if (
      publishGeneration !== livePublishGeneration ||
      isComponentUnmounted ||
      abortController.signal.aborted
    ) {
      await publishSession.close().catch(() => undefined);
      throw new Error("Live publishing stopped before the WHIP session completed.");
    }
    livePublishSession = publishSession;
    const terminalConnectionMonitor = createWhipTerminalConnectionMonitor(
      publishSession,
      async (state) => {
        await handleTerminalWhipConnection(
          publishSession,
          publishGeneration,
          streamToken,
          state,
        );
      },
    );
    livePublishConnectionMonitor = terminalConnectionMonitor;
    ownsLivePublish = true;
    livePublishStatus.value = "confirming";
    await confirmLivePublishing(publishGeneration, streamToken);
    if (publishGeneration !== livePublishGeneration) {
      await postStreamAction("stop", { keepalive: true, streamToken }).catch(() => undefined);
      liveServerStreamStarted = false;
      if (liveStreamToken === streamToken) {
        liveStreamToken = undefined;
      }
      await cleanupLivePublishing();
      return;
    }
    livePublishStatus.value = "live";
    terminalConnectionMonitor.activate();
  } catch (error) {
    if (publishGeneration !== livePublishGeneration) {
      await cleanupLivePublishing();
      return;
    }
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
    canTakeOverLivePublish.value = isStreamAlreadyActive(error);
    if (liveServerStreamStarted && liveStreamToken) {
      await postStreamAction("stop", { streamToken: liveStreamToken }).catch(() => undefined);
    }
    liveServerStreamStarted = false;
    liveStreamToken = undefined;
    await cleanupLivePublishing();
  } finally {
    isStartingLivePublish.value = false;
  }
}

async function handleTerminalWhipConnection(
  publishSession: WhipPublishSession,
  publishGeneration: number,
  streamToken: string,
  connectionState: RTCPeerConnectionState,
): Promise<void> {
  if (
    publishGeneration !== livePublishGeneration ||
    liveStreamToken !== streamToken ||
    livePublishSession !== publishSession ||
    livePublishStatus.value !== "live"
  ) {
    return;
  }

  livePublishGeneration += 1;
  isHandlingTerminalLivePublish.value = true;
  livePublishStatus.value = "failed";
  livePublishError.value = `Live publisher connection ${connectionState}; the live stream was stopped.`;
  canTakeOverLivePublish.value = false;
  const stopPromise = liveServerStreamStarted
    ? postStreamAction("stop", {
        keepalive: true,
        streamToken,
      }).catch(() => undefined)
    : Promise.resolve();
  liveServerStreamStarted = false;
  if (liveStreamToken === streamToken) {
    liveStreamToken = undefined;
  }
  try {
    await cleanupLivePublishing();
  } finally {
    isHandlingTerminalLivePublish.value = false;
  }
  await stopPromise;
}

async function stopLivePublishing(): Promise<void> {
  const streamToken = liveStreamToken;
  if (
    !props.sessionId ||
    !streamToken ||
    livePublishStatus.value === "stopping" ||
    (!ownsLivePublish && !liveServerStreamStarted && !isStartingLivePublish.value)
  ) {
    return;
  }

  livePublishStatus.value = "stopping";
  livePublishError.value = "";
  livePublishGeneration += 1;
  try {
    const stopPromise = postStreamAction("stop", { streamToken });
    await cleanupLivePublishing();
    await stopPromise;
    liveServerStreamStarted = false;
    liveStreamToken = undefined;
    livePublishStatus.value = "ended";
  } catch (error) {
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
  }
}

async function confirmLivePublishing(
  publishGeneration: number,
  streamToken: string,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (publishGeneration !== livePublishGeneration) {
      throw new Error("Live publishing stopped.");
    }
    try {
      await postStreamAction<{ notified: boolean; streamStatus: "live" }>(
        "confirm",
        { streamToken },
      );
      return;
    } catch (error) {
      lastError = error;
      if (!isStreamNotConnectedYet(error)) {
        throw error;
      }
      await delay(1000);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Cloudflare Stream live input did not connect.");
}

async function cleanupLivePublishing(): Promise<void> {
  clearLiveHeartbeat();
  const connectionMonitor = livePublishConnectionMonitor;
  livePublishConnectionMonitor = undefined;
  connectionMonitor?.dispose();
  const abortController = livePublishAbortController;
  livePublishAbortController = undefined;
  abortController?.abort();
  const publishSession = livePublishSession;
  livePublishSession = undefined;
  ownsLivePublish = false;
  await publishSession?.close().catch(() => undefined);
  for (const track of liveOwnedVideoTracks) {
    track.stop();
  }
  liveOwnedVideoTracks = [];
}

function startLiveHeartbeat(publishGeneration: number, streamToken: string): void {
  clearLiveHeartbeat();
  let lease: PublisherLeaseHeartbeat;
  lease = createPublisherLeaseHeartbeat({
    isLeaseLost: isPublisherLeaseLost,
    renew: async () => {
      if (
        publishGeneration !== livePublishGeneration ||
        liveStreamToken !== streamToken ||
        !liveServerStreamStarted
      ) {
        lease.stop();
        return;
      }
      await postStreamAction("heartbeat", { streamToken });
    },
    onLeaseLost: async (error) => {
      if (publishGeneration !== livePublishGeneration || liveStreamToken !== streamToken) {
        return;
      }
      livePublishGeneration += 1;
      liveServerStreamStarted = false;
      liveStreamToken = undefined;
      livePublishStatus.value = "failed";
      livePublishError.value = isPublisherLeaseLost(error)
        ? "Another producer took over the live stream."
        : "Publisher heartbeat failed; the live stream was stopped.";
      await cleanupLivePublishing();
    },
  });
  livePublisherLease = lease;
  lease.start();
}

function clearLiveHeartbeat(): void {
  livePublisherLease?.stop();
  livePublisherLease = undefined;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function postStreamAction<T = unknown>(
  action: "confirm" | "heartbeat" | "start" | "stop" | "takeover",
  options: { keepalive?: boolean; streamToken?: string } = {},
): Promise<T> {
  const response = await fetch("/api/studio/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      sessionId: props.sessionId,
      streamToken: options.streamToken,
    }),
    keepalive: options.keepalive,
  });
  if (!response.ok) {
    throw new StudioRequestError(await readErrorResponse(response), response.status);
  }
  return await response.json() as T;
}

async function stopOwnedLivePublishingForTeardown(): Promise<void> {
  if (
    !props.sessionId ||
    (!isStartingLivePublish.value && !liveServerStreamStarted && !ownsLivePublish)
  ) {
    return;
  }

  const streamToken = liveStreamToken;
  if (!streamToken) {
    return;
  }
  livePublishGeneration += 1;
  const stopPromise = postStreamAction("stop", {
    keepalive: true,
    streamToken,
  }).catch(() => undefined);
  liveServerStreamStarted = false;
  liveStreamToken = undefined;
  await cleanupLivePublishing();
  await stopPromise;
}

function isStreamNotConnectedYet(error: unknown): boolean {
  return error instanceof StudioRequestError &&
    error.status === 409 &&
    error.message.includes("not connected yet");
}

function isStreamAlreadyActive(error: unknown): boolean {
  return error instanceof StudioRequestError &&
    error.status === 409 &&
    error.message.includes("already active");
}

function isPublisherLeaseLost(error: unknown): boolean {
  return error instanceof StudioRequestError &&
    error.status === 409 &&
    error.message.includes("lease is no longer active");
}

async function createRecordingStream(): Promise<MediaStream | undefined> {
  return await createProgrammeOutputStream((tracks) => {
    recordingOwnedVideoTracks = tracks;
  });
}

async function createProgrammeOutputStream(
  setOwnedVideoTracks: (tracks: MediaStreamTrack[]) => void,
): Promise<MediaStream | undefined> {
  const canvasStream = captureCanvasStream();
  if (!canvasStream) {
    return undefined;
  }

  const videoTracks = canvasStream.getVideoTracks();
  setOwnedVideoTracks(videoTracks);
  try {
    const audioReady = await programmeAudioMixer.resume();
    const audioTrack = requireLiveProgrammeAudioTrack(
      audioReady,
      audioReady ? programmeAudioMixer.getOutputTrack() : undefined,
      programmeAudioMixer.hasAudibleSource(),
    );
    removeProgrammeAudioUnlockListeners();
    return new MediaStream([...videoTracks, audioTrack]);
  } catch (error) {
    for (const track of videoTracks) {
      track.stop();
    }
    setOwnedVideoTracks([]);
    throw error;
  }
}

function setProgrammeAudioSourceMuted(sourceId: string, muted: boolean): void {
  programmeAudioMixer.setSourceMuted(sourceId, muted);
}

function setProgrammeAudioSourceGain(sourceId: string, gain: number): void {
  programmeAudioMixer.setSourceGain(sourceId, gain);
}

function getProgrammeAudioSourceState(sourceId: string): ProgrammeAudioSourceState {
  return programmeAudioMixer.getSourceState(sourceId);
}

function updateProgrammeAudioLevel(): void {
  programmeAudioLevel.value = programmeAudioMixer.getOutputLevel();
}

function startProgrammeAudioMeter(): void {
  stopProgrammeAudioMeter();
  updateProgrammeAudioLevel();
  const reducedMotion = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interval = reducedMotion ? 500 : 80;
  programmeAudioMeterTimer = window.setInterval(updateProgrammeAudioLevel, interval);
}

function stopProgrammeAudioMeter(): void {
  if (programmeAudioMeterTimer !== undefined) {
    window.clearInterval(programmeAudioMeterTimer);
    programmeAudioMeterTimer = undefined;
  }
}

function addProgrammeAudioUnlockListeners(): void {
  window.addEventListener("pointerdown", requestProgrammeAudioResume, true);
  window.addEventListener("keydown", requestProgrammeAudioResume, true);
}

function removeProgrammeAudioUnlockListeners(): void {
  window.removeEventListener("pointerdown", requestProgrammeAudioResume, true);
  window.removeEventListener("keydown", requestProgrammeAudioResume, true);
}

function requestProgrammeAudioResume(): void {
  if (isResumingProgrammeAudio) return;

  isResumingProgrammeAudio = true;
  void programmeAudioMixer.resume()
    .then((ready) => {
      if (ready) {
        removeProgrammeAudioUnlockListeners();
        updateProgrammeAudioLevel();
      }
    })
    .finally(() => {
      isResumingProgrammeAudio = false;
    });
}

function getRecordingSourceFormat(_mimeType: string): "webm" {
  return "webm";
}

function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return "";
  }

  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  ) ?? "";
}

async function readErrorResponse(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? `Studio recording request failed with ${response.status}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Studio recording request failed.";
}

function onPointerDown(event: PointerEvent): void {
  if (!props.interactive) {
    return;
  }

  const canvasPoint = getCanvasPoint(event);
  const layer = canvasPoint ? getLayerAtPoint(canvasPoint.x, canvasPoint.y) : undefined;
  if (!canvasPoint || !layer) {
    return;
  }

  event.preventDefault();
  canvasElement.value?.setPointerCapture(event.pointerId);
  emit("select-layer", layer.id);
  isDragging.value = true;
  dragState = {
    layerId: layer.id,
    pointerId: event.pointerId,
    offsetX: canvasPoint.x - layer.bounds.x,
    offsetY: canvasPoint.y - layer.bounds.y,
  };
}

function onPointerMove(event: PointerEvent): void {
  if (!props.interactive) {
    return;
  }

  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  const canvasPoint = getCanvasPoint(event);
  const layer = props.layers.find((candidate) => candidate.id === dragState?.layerId);
  if (!canvasPoint || !layer) {
    return;
  }

  event.preventDefault();
  const x = clamp(
    Math.round(canvasPoint.x - dragState.offsetX),
    0,
    Math.max(0, props.resolution.width - layer.bounds.width),
  );
  const y = clamp(
    Math.round(canvasPoint.y - dragState.offsetY),
    0,
    Math.max(0, props.resolution.height - layer.bounds.height),
  );

  emit("update-layer-bounds", layer.id, {
    ...layer.bounds,
    x,
    y,
  });
  renderLoop.queuePaint();
}

function onPointerUp(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  canvasElement.value?.releasePointerCapture(event.pointerId);
  dragState = undefined;
  isDragging.value = false;
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } | undefined {
  const canvas = canvasElement.value;
  if (!canvas) {
    return undefined;
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * props.resolution.width,
    y: ((event.clientY - rect.top) / rect.height) * props.resolution.height,
  };
}

function getLayerAtPoint(x: number, y: number): StudioLayer | undefined {
  return getHitTestLayerStack(props.layers).find((layer) => isInsideBounds(x, y, layer));
}

function isInsideBounds(x: number, y: number, layer: StudioLayer): boolean {
  return (
    x >= layer.bounds.x &&
    x <= layer.bounds.x + layer.bounds.width &&
    y >= layer.bounds.y &&
    y <= layer.bounds.y + layer.bounds.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

watch(
  () => props.isPlaying,
  () => {
    renderLoop.queuePaint();
  },
  { immediate: true },
);

watch(
  () => [props.layers, props.isRecording, props.resolution],
  () => {
    updateCanvasDisplaySize();
    if (!props.isPlaying) {
      renderLoop.queuePaint();
    }
  },
  { deep: true },
);

watch(
  () => props.activeOverlays ?? {},
  (activeOverlays) => {
    syncOverlayPhaseStarts(activeOverlays);
    renderLoop.queuePaint();
  },
  { deep: true, immediate: true },
);

watch(
  () => props.programmeAudioStreams,
  (streams) => {
    const currentStreams = streams ?? new Map();
    programmeAudioMixer.reconcile(currentStreams);
  },
  { immediate: true },
);

watch(
  () => props.audioMix ?? {},
  (audioMix) => {
    programmeAudioMixer.reconcileControls(audioMix);
  },
  { deep: true, immediate: true },
);

watch(
  () => props.mediaStreams,
  (streams) => {
    const currentStreams = streams ?? new Map();
    syncMediaVideoElements(currentStreams);
    renderLoop.queuePaint();
  },
  { immediate: true },
);

watch(
  () => getActiveStingerKey(props.activeStinger),
  (nextKey) => {
    stingerStartedAt = nextKey ? performance.now() : undefined;
    syncStingerAnimation(nextKey);
    renderLoop.queuePaint();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("pagehide", stopOwnedLivePublishingForTeardown);
  window.addEventListener("pagehide", preserveLocalRecordingForPageHide);
  document.addEventListener("visibilitychange", flushLocalRecordingForVisibilityChange);
  addProgrammeAudioUnlockListeners();
  startProgrammeAudioMeter();
  void refreshRecordingRecoveryArtifacts();
  frameResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }

    updateCanvasDisplaySize(entry.contentRect.width, entry.contentRect.height);
  });

  if (frameElement.value) {
    frameResizeObserver.observe(frameElement.value);
    updateCanvasDisplaySize();
  }
});

onBeforeUnmount(() => {
  isComponentUnmounted = true;
  window.removeEventListener("pagehide", stopOwnedLivePublishingForTeardown);
  window.removeEventListener("pagehide", preserveLocalRecordingForPageHide);
  document.removeEventListener("visibilitychange", flushLocalRecordingForVisibilityChange);
  removeProgrammeAudioUnlockListeners();
  stopProgrammeAudioMeter();
  const deferAudioClose = isLocalRecording.value ||
    isStartingRecording.value ||
    isFinishingRecording.value;
  if (isLocalRecording.value) {
    stopLocalRecording();
  } else if (isStartingRecording.value) {
    void cleanupPendingRecordingStart();
  }
  void stopOwnedLivePublishingForTeardown();
  if (!deferAudioClose) {
    void programmeAudioMixer.close();
  }
  clearMediaVideoElements();
  stopOverlayAnimations();
  stopStingerAnimation();
  frameResizeObserver?.disconnect();
  renderLoop.stop();
});

defineExpose({
  captureCanvasStream,
  exportPng,
  getProgrammeAudioSourceState,
  setProgrammeAudioSourceGain,
  setProgrammeAudioSourceMuted,
});

function syncOverlayPhaseStarts(activeOverlays: Record<string, ActiveOverlay>): void {
  const now = performance.now();

  for (const [layerId, overlay] of Object.entries(activeOverlays)) {
    const existing = overlayPhaseStarts.get(layerId);
    if (existing?.phase === overlay.phase) {
      continue;
    }

    overlayPhaseStarts.set(layerId, {
      phase: overlay.phase,
      startedAt: now,
    });
    startOverlayAnimation(layerId, overlay);
  }

  for (const layerId of [...overlayPhaseStarts.keys()]) {
    if (!activeOverlays[layerId]) {
      overlayPhaseStarts.delete(layerId);
      stopOverlayAnimation(layerId);
      overlayTransitionProgresses.delete(layerId);
    }
  }
}

function getOverlayTransitionStarts(): Map<string, number> {
  return new Map([...overlayPhaseStarts.entries()].map(([layerId, value]) => [layerId, value.startedAt]));
}

function getOverlayTransitionProgresses(): Map<string, number> {
  return new Map(overlayTransitionProgresses);
}

function getMediaVideoElements(): Map<string, HTMLVideoElement> {
  return new Map(mediaVideoElements);
}

function syncMediaVideoElements(streams: Map<string, MediaStream>): void {
  for (const [sourceId, stream] of streams) {
    const existing = mediaVideoElements.get(sourceId);
    if (existing?.srcObject === stream) {
      continue;
    }

    const video = existing ?? document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    mediaVideoElements.set(sourceId, video);
    video.play().catch(() => {
      renderLoop.queuePaint();
    });
  }

  for (const [sourceId, video] of mediaVideoElements) {
    if (streams.has(sourceId)) {
      continue;
    }

    video.pause();
    video.srcObject = null;
    mediaVideoElements.delete(sourceId);
  }
}

function clearMediaVideoElements(): void {
  for (const video of mediaVideoElements.values()) {
    video.pause();
    video.srcObject = null;
  }
  mediaVideoElements.clear();
}

function startOverlayAnimation(layerId: string, overlay: ActiveOverlay): void {
  stopOverlayAnimation(layerId);

  if (overlay.phase === "visible") {
    overlayTransitionProgresses.set(layerId, 1);
    return;
  }

  const transition = overlay.phase === "entering" ? overlay.lifecycle.enter : overlay.lifecycle.exit;
  const duration = transition?.durationSeconds ?? 0;

  if (duration <= 0) {
    overlayTransitionProgresses.set(layerId, 1);
    return;
  }

  overlayTransitionProgresses.set(layerId, 0);
  const controls = animate(0, 1, {
    duration,
    ease: "circInOut",
    onUpdate(value) {
      overlayTransitionProgresses.set(layerId, value);
      renderLoop.queuePaint();
    },
    onComplete() {
      overlayTransitionProgresses.set(layerId, 1);
      overlayAnimations.delete(layerId);
      renderLoop.queuePaint();
    },
  });
  overlayAnimations.set(layerId, controls);
}

function stopOverlayAnimation(layerId: string): void {
  overlayAnimations.get(layerId)?.stop();
  overlayAnimations.delete(layerId);
}

function stopOverlayAnimations(): void {
  for (const layerId of [...overlayAnimations.keys()]) {
    stopOverlayAnimation(layerId);
  }
}

function syncStingerAnimation(nextKey: string): void {
  stopStingerAnimation();

  if (!nextKey || !props.activeStinger) {
    stingerProgress = undefined;
    return;
  }

  stingerProgress = 0;
  stingerAnimation = animate(0, 1, {
    duration: props.activeStinger.effect.durationSeconds ?? 2,
    ease: "circInOut",
    onUpdate(value) {
      stingerProgress = value;
      renderLoop.queuePaint();
    },
    onComplete() {
      stingerProgress = 1;
      stingerAnimation = undefined;
      renderLoop.queuePaint();
    },
  });
}

function stopStingerAnimation(): void {
  stingerAnimation?.stop();
  stingerAnimation = undefined;
}

function getActiveStingerKey(stinger: ActiveSceneStinger | undefined): string {
  if (!stinger) {
    return "";
  }

  return `${stinger.fromSceneId}:${stinger.toSceneId}:${stinger.effect.transition}`;
}

function updateCanvasDisplaySize(width = frameElement.value?.clientWidth ?? 0, height = frameElement.value?.clientHeight ?? 0): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  const aspectRatio = props.resolution.width / props.resolution.height;
  const widthLimitedHeight = width / aspectRatio;

  canvasDisplaySize.value =
    widthLimitedHeight <= height
      ? {
          width,
          height: widthLimitedHeight,
        }
      : {
          width: height * aspectRatio,
          height,
        };
}
</script>

<template>
  <section
    class="canvas-deck"
    :class="{ 'has-recording-recovery': showRecordingRecovery }"
    :aria-label="title"
  >
    <div class="canvas-toolbar">
      <div>
        <strong>{{ title }}</strong>
        <span>{{ subtitle ?? "HTML compositor" }}</span>
      </div>
      <div class="canvas-actions">
        <button class="secondary-button compact" type="button" @click="exportPng">
          Export PNG
        </button>
        <button
          v-if="canPublishLive"
          class="record-button compact"
          :class="{ active: livePublishStatus === 'live' }"
          type="button"
          :disabled="liveButtonDisabled"
          @click="toggleLivePublishing"
        >
          {{ liveButtonLabel }}
        </button>
        <span
          v-if="liveStatusText"
          class="recording-upload-state"
          :class="{ error: livePublishStatus === 'failed' }"
        >
          {{ liveStatusText }}
        </span>
        <button
          class="record-button compact"
          :class="{ active: isLocalRecording }"
          type="button"
          :disabled="!canRecordLocally || isFinishingRecording || isStartingRecording"
          @click="toggleLocalRecording"
        >
          {{
            isFinishingRecording
              ? "Saving"
              : isStartingRecording
                ? "Starting"
                : isLocalRecording
                  ? "Stop"
                  : "Record"
          }}
        </button>
        <span
          v-if="recordingStatusText"
          class="recording-upload-state"
          :class="{ error: recordingUploadStatus === 'failed' }"
        >
          {{ recordingStatusText }}
        </span>
        <a
          v-if="recordingStatusHref"
          class="secondary-button compact recording-status-link"
          :href="recordingStatusHref"
        >
          Status
        </a>
        <div
          class="canvas-meter"
          role="meter"
          aria-label="Mixed programme audio level"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="programmeAudioLevelPercent"
          :aria-valuetext="programmeAudioLevelText"
        >
          <span class="canvas-meter-label" aria-hidden="true">Mix</span>
          <span class="canvas-meter-track" aria-hidden="true">
            <span class="canvas-meter-fill" :style="programmeAudioMeterFillStyle" />
          </span>
          <span class="canvas-meter-value" aria-hidden="true">
            {{ programmeAudioLevelPercent }}%
          </span>
        </div>
      </div>
    </div>
    <section
      v-if="showRecordingRecovery"
      class="recording-recovery"
      aria-labelledby="recording-recovery-heading"
      :aria-busy="isLoadingRecordingRecovery"
    >
      <div class="recording-recovery-heading">
        <div>
          <strong id="recording-recovery-heading">Recording recovery</strong>
          <span v-if="recordingRecoveryArtifacts.length > 0">
            {{ recordingRecoveryArtifacts.length }}
            {{ recordingRecoveryArtifacts.length === 1 ? "copy" : "copies" }} saved in this browser
          </span>
        </div>
        <p
          v-if="isLoadingRecordingRecovery"
          class="recording-recovery-message"
          role="status"
          aria-live="polite"
        >
          Checking browser backups
        </p>
        <p
          v-else-if="recordingRecoveryError"
          class="recording-recovery-message error"
          role="alert"
        >
          {{ recordingRecoveryError }}
        </p>
        <p
          v-else-if="recordingRecoveryStatus"
          class="recording-recovery-message"
          role="status"
          aria-live="polite"
        >
          {{ recordingRecoveryStatus }}
        </p>
      </div>
      <article
        v-for="artifact in recordingRecoveryArtifacts"
        :key="artifact.id"
        class="recording-recovery-row"
      >
        <div class="recording-recovery-copy">
          <time :datetime="getRecordingRecoveryDateTime(artifact.createdAt)">
            {{ formatRecordingRecoveryTimestamp(artifact.createdAt) }}
          </time>
          <span>
            {{ formatRecordingRecoverySize(artifact.size) }}
            · {{ artifact.chunkCount }} {{ artifact.chunkCount === 1 ? "chunk" : "chunks" }}
          </span>
          <span
            class="recording-recovery-integrity"
            :class="{ warning: artifact.integrity !== 'complete' }"
          >
            {{ getRecordingRecoveryIntegrityLabel(artifact) }}
          </span>
        </div>
        <div class="recording-recovery-actions">
          <button
            class="secondary-button compact"
            type="button"
            :disabled="Boolean(recordingRecoveryActionId)"
            :aria-label="`Download recording recovery from ${formatRecordingRecoveryTimestamp(artifact.createdAt)}`"
            @click="downloadRecordingRecovery(artifact)"
          >
            Download
          </button>
          <button
            class="ghost-button mini"
            type="button"
            :disabled="Boolean(recordingRecoveryActionId)"
            :aria-label="`Discard recording recovery from ${formatRecordingRecoveryTimestamp(artifact.createdAt)}`"
            @click="discardRecordingRecovery(artifact)"
          >
            Discard
          </button>
        </div>
      </article>
    </section>
    <div ref="frameElement" class="canvas-frame">
      <canvas
        ref="canvasElement"
        :class="{ dragging: isDragging, interactive }"
        :style="canvasStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>
  </section>
</template>
