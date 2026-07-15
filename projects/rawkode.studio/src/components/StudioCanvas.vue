<script setup lang="ts">
import { animate } from "motion";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderProgramCanvas } from "../canvas/programRenderer";
import {
  captureProgrammeCanvasStream,
  configureProgrammeCanvasBackingStore,
} from "../canvas/programmeCanvas";
import RecordingRecovery from "./RecordingRecovery.vue";
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
  readRecordingBackupChunks,
  type RecordingBackup,
} from "../recording/recordingBackup";
import { initialiseRecordingDestinations } from "../recording/recordingDestinations";
import { fetchWithTransientRetry } from "../recording/transientRetry";
import {
  getRecordingHandoffStatusLabel,
  getRecordingHandoffStatusUrl,
  parseRecordingHandoff,
  type RecordingHandoff,
} from "../recording/handoff";
import {
  startWhipPublishing,
  type WhipPublishSession,
} from "../live/whipClient";
import { getWebRtcConnectionHealth } from "../live/connectionHealth";
import {
  createProgrammeOutput,
  type ProgrammeOutput,
} from "../live/programmeOutput";
import {
  startWhepPlayback,
  type WhepPlaybackSession,
} from "../live/whepClient";
import { useCanvasRenderLoop } from "../canvas/useCanvasRenderLoop";
import { getHitTestLayerStack } from "../studio/layerStack";
import { getProgrammeMediaSourceIds } from "../studio/programmeMedia";
import type { ActiveOverlay, ActiveSceneStinger, CanvasResolution, StudioLayer } from "../types";

type MotionAnimationControls = ReturnType<typeof animate>;
type LivePublishStatus =
  | "confirming"
  | "degraded"
  | "ended"
  | "failed"
  | "idle"
  | "live"
  | "starting"
  | "stopping";
type RecordingUploadStatus = "failed" | "idle" | "local" | "ready" | "uploading";
type TestPreviewStatus = "degraded" | "failed" | "idle" | "playing" | "starting";

interface RecordingUploadPart {
  etag: string;
  partNumber: number;
}

interface RecordingUpload {
  failedMessage: string;
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
  layers: StudioLayer[];
  mediaStreams?: Map<string, MediaStream>;
  programmeSourceIds?: string[];
  publishBlockedReason?: string;
  resolution: CanvasResolution;
  isPlaying: boolean;
  isRecording: boolean;
  sessionId?: string;
  canPublishLive?: boolean;
  prodConfirmed?: boolean;
  streamEnvironment?: "prod" | "test";
  streamStatus?: string;
  title: string;
  subtitle?: string;
  interactive?: boolean;
}>();

const emit = defineEmits<{
  exported: [];
  "prod-confirmation-reset": [];
  "recording-change": [recording: boolean];
  "select-layer": [id: string];
  "update-layer-bounds": [id: string, bounds: StudioLayer["bounds"]];
}>();

const canvasElement = ref<HTMLCanvasElement | null>(null);
const frameElement = ref<HTMLElement | null>(null);
const canvasDisplaySize = ref({ width: 0, height: 0 });
const canRecordLocally = typeof MediaRecorder !== "undefined";
const isDragging = ref(false);
const isFinishingRecording = ref(false);
const hasUnownedServerStream =
  props.streamStatus === "live" || props.streamStatus === "starting";
const livePublishError = ref(
  hasUnownedServerStream
    ? "This browser is not publishing the active stream. Reset it before restarting."
    : "",
);
const livePublishWarning = ref("");
const livePublishStatus = ref<LivePublishStatus>(
  hasUnownedServerStream
    ? "failed"
    : props.streamStatus === "ended"
      ? "ended"
      : "idle",
);
const requiresServerReset = ref(hasUnownedServerStream);
const isLocalRecording = ref(false);
const isStartingLivePublish = ref(false);
const isRetryingLiveNotification = ref(false);
const isStartingRecording = ref(false);
const activeRecordingBackupId = ref("");
const recordingRecoveryVersion = ref(0);
const recordingRecoveryWarning = ref("");
const programmeAudioWarning = ref("");
const recordingUploadError = ref("");
const recordingUploadStatus = ref<RecordingUploadStatus>("idle");
const completedRecording = ref<RecordingHandoff | null>(null);
const testPlaybackUrl = ref("");
const testPreviewElement = ref<HTMLVideoElement | null>(null);
const testPreviewError = ref("");
const testPreviewStatus = ref<TestPreviewStatus>("idle");
const overlayPhaseStarts = new Map<string, { phase: ActiveOverlay["phase"]; startedAt: number }>();
const overlayTransitionProgresses = new Map<string, number>();
const overlayAnimations = new Map<string, MotionAnimationControls>();
let bufferCanvas: HTMLCanvasElement | undefined;
let frameResizeObserver: ResizeObserver | undefined;
let mediaRecorder: MediaRecorder | undefined;
let recordedChunks: RecordingFallbackChunk[] = [];
let recordingBackup: RecordingBackup | undefined;
let recordingChunkIndex = 0;
let recordingFinishPromise: Promise<void> | undefined;
let recordingUpload: RecordingUpload | undefined;
let recordingProgrammeOutput: ProgrammeOutput | undefined;
let livePublishSession: WhipPublishSession | undefined;
let livePublishAbortController: AbortController | undefined;
let removeWhipConnectionStateListener: (() => void) | undefined;
let whipDisconnectedTimer: number | undefined;
let whipHealthFailureGeneration: number | undefined;
let liveProgrammeOutput: ProgrammeOutput | undefined;
let liveServerStreamStarted = false;
let ownsLivePublish = false;
let livePublishConfirmed = false;
let livePublishGeneration = 0;
let liveStreamToken: string | undefined;
let testPreviewSession: WhepPlaybackSession | undefined;
let testPreviewAbortController: AbortController | undefined;
let removeTestPreviewConnectionStateListener: (() => void) | undefined;
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
    return isLocalRecording.value ? "Local recording" : "Saved locally";
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
const mediaBlockedReason = computed(() => props.publishBlockedReason?.trim() ?? "");
const hasActiveLivePublish = computed(() =>
  livePublishStatus.value === "starting" ||
  livePublishStatus.value === "confirming" ||
  livePublishStatus.value === "live" ||
  livePublishStatus.value === "degraded"
);
const liveStatusText = computed(() => {
  if (livePublishStatus.value === "starting") return "Starting live stream";
  if (livePublishStatus.value === "confirming") return "Confirming stream";
  if (livePublishStatus.value === "degraded") {
    return "Publisher connection interrupted — reconnecting";
  }
  if (livePublishStatus.value === "live") {
    return `${props.streamEnvironment === "prod" ? "Prod" : "Test"} stream live`;
  }
  if (livePublishStatus.value === "stopping") return "Stopping stream";
  if (livePublishStatus.value === "failed") return livePublishError.value;
  if (mediaBlockedReason.value) return `Not ready: ${mediaBlockedReason.value}`;
  if (livePublishStatus.value === "ended") return "Stream ended";
  return "";
});
const liveButtonLabel = computed(() => {
  if (requiresServerReset.value) return "Reset stream";
  if (livePublishStatus.value === "starting" || livePublishStatus.value === "confirming") {
    return "Cancel live start";
  }
  if (livePublishStatus.value === "stopping") return "Stopping";
  if (livePublishStatus.value === "live" || livePublishStatus.value === "degraded") {
    return "Stop live";
  }
  if (livePublishStatus.value === "failed") {
    return `Retry ${props.streamEnvironment === "prod" ? "Prod" : "Test"}`;
  }
  return "Go live";
});
const liveButtonDisabled = computed(() =>
  !props.sessionId ||
  livePublishStatus.value === "stopping" ||
  (!requiresServerReset.value && !hasActiveLivePublish.value && Boolean(mediaBlockedReason.value)),
);
const recordButtonDisabled = computed(() =>
  !canRecordLocally ||
  isFinishingRecording.value ||
  isStartingRecording.value ||
  (!isLocalRecording.value && Boolean(mediaBlockedReason.value)),
);
const testPreviewStatusText = computed(() => {
  if (testPreviewStatus.value === "starting") return "Connecting";
  if (testPreviewStatus.value === "playing") return "Playing";
  if (testPreviewStatus.value === "degraded") return "Reconnecting";
  if (testPreviewStatus.value === "failed") return testPreviewError.value;
  return "";
});

async function paint(timestamp = performance.now()): Promise<void> {
  const canvas = canvasElement.value;
  if (!canvas) {
    return;
  }

  configureProgrammeCanvasBackingStore(canvas, props.resolution);
  const backingWidth = canvas.width;
  const backingHeight = canvas.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const buffer = getBufferCanvas(backingWidth, backingHeight);
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) {
    return;
  }

  bufferContext.setTransform(1, 0, 0, 1, 0, 0);
  await renderProgramCanvas(bufferContext, {
    activeOverlays: props.activeOverlays,
    activeStinger: props.activeStinger,
    layers: props.layers,
    mediaVideoElements: getMediaVideoElements(),
    overlayTransitionProgresses: getOverlayTransitionProgresses(),
    overlayTransitionStarts: getOverlayTransitionStarts(),
    resolution: props.resolution,
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
  const canvas = canvasElement.value;
  return canvas
    ? captureProgrammeCanvasStream(canvas, props.resolution)
    : undefined;
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
  recordingRecoveryWarning.value = "";
  if (mediaBlockedReason.value) {
    recordingUploadStatus.value = "failed";
    recordingUploadError.value = mediaBlockedReason.value;
    return;
  }
  isStartingRecording.value = true;
  try {
    if (typeof MediaRecorder === "undefined") {
      return;
    }

    recordingProgrammeOutput = await createProgrammeOutputStream();
    syncProgrammeOutputAudioStreams();
    const recordingStream = recordingProgrammeOutput.stream;

    const mimeType = getSupportedRecordingMimeType();
    recordedChunks = [];
    recordingChunkIndex = 0;
    recordingUploadStatus.value = "idle";
    recordingUploadError.value = "";
    completedRecording.value = null;
    const destinations = await initialiseRecordingDestinations({
      createBackup: () => createRecordingBackup(mimeType || "video/webm"),
      createUpload: () => createRecordingUpload(mimeType),
      shouldContinue: () => !isComponentUnmounted,
    });
    recordingBackup = destinations.backup;
    recordingUpload = destinations.upload;
    activeRecordingBackupId.value = recordingBackup?.id ?? "";
    recordingRecoveryWarning.value = destinations.recoveryWarning;
    if (destinations.uploadWarning) {
      recordingUploadStatus.value = "local";
      recordingUploadError.value = destinations.uploadWarning;
    }
    if (destinations.cancelled) {
      await cleanupPendingRecordingStart();
      return;
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
            () => {
              recordedChunks.push({ chunk: event.data, chunkIndex });
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
    mediaRecorder.start(5000);
    isLocalRecording.value = true;
    emit("recording-change", true);
  } catch (error) {
    recordingUploadStatus.value = "failed";
    recordingUploadError.value = toErrorMessage(error);
    await abortRecordingUpload(recordingUpload);
    await deleteRecordingBackup(recordingBackup).catch((backupError: unknown) => {
      console.warn("Unable to delete recording backup", backupError);
    });
    recordingRecoveryVersion.value += 1;
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
  recordingRecoveryVersion.value += 1;
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
  isFinishingRecording.value = true;
  let handoffSucceeded = false;
  try {
    if (recordingUpload) {
      completedRecording.value = await completeRecordingUpload(recordingUpload);
      recordingUploadStatus.value = "ready";
      handoffSucceeded = true;
    } else {
      const localBlob = await readRecordingFallbackBlob(mimeType);
      if (localBlob) {
        downloadRecording(localBlob);
      }
    }
  } catch (error) {
    recordingUploadStatus.value = "failed";
    recordingUploadError.value = toErrorMessage(error);
    await abortRecordingUpload(recordingUpload);
    const localBlob = await readRecordingFallbackBlob(mimeType);
    if (localBlob) {
      downloadRecording(localBlob);
    }
  } finally {
    if (handoffSucceeded) {
      await deleteRecordingBackup(recordingBackup).catch(async (error: unknown) => {
        console.warn("Unable to delete recording backup after successful handoff", error);
        await closeRecordingBackup(recordingBackup);
      });
    } else {
      await closeRecordingBackup(recordingBackup);
    }
    recordingRecoveryVersion.value += 1;
    finishLocalRecording();
  }
}

function downloadRecording(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `rawkode-studio-program-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  if (recordingUploadStatus.value !== "failed") {
    recordingUploadStatus.value = "local";
  }
}

async function readRecordingFallbackBlob(mimeType: string): Promise<Blob | null> {
  const backupChunks = await readRecordingBackupChunks(recordingBackup).catch((error: unknown) => {
    recordingUploadError.value = toErrorMessage(error);
    return [];
  });
  const chunksByIndex = new Map<number, RecordingFallbackChunk>();
  for (const row of backupChunks) {
    chunksByIndex.set(row.chunkIndex, row);
  }
  for (const row of recordedChunks) {
    chunksByIndex.set(row.chunkIndex, row);
  }

  return createRecordingFallbackBlob([...chunksByIndex.values()], mimeType);
}

function finishLocalRecording(): void {
  const programmeOutput = recordingProgrammeOutput;
  recordingProgrammeOutput = undefined;
  void programmeOutput?.close();
  mediaRecorder = undefined;
  recordedChunks = [];
  recordingBackup = undefined;
  activeRecordingBackupId.value = "";
  recordingFinishPromise = undefined;
  recordingUpload = undefined;
  isFinishingRecording.value = false;
  isLocalRecording.value = false;
  isStartingRecording.value = false;
  emit("recording-change", false);
}

async function createRecordingUpload(mimeType: string): Promise<RecordingUpload | undefined> {
  if (!props.sessionId) {
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
    throw new Error(await readErrorResponse(response));
  }
  const upload = await response.json() as {
    partSizeBytes: number;
    recordingId: string;
    sessionId: string;
    sourceFormat: "webm";
    uploadId: string;
  };

  return {
    failedMessage: "",
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
  const response = await fetchWithTransientRetry(
    `/api/studio/recording-upload?${params.toString()}`,
    {
      method: "PUT",
      body: part,
    },
  );
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
  if (upload.failedMessage) {
    throw new Error(upload.failedMessage);
  }

  // Multipart completion is not idempotent: a retry could run after R2 completed
  // but before the D1/ready-marker handoff returned. Keep the browser backup
  // instead of retrying a completion whose server-side outcome is ambiguous.
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

async function abortRecordingUpload(upload: RecordingUpload | undefined): Promise<void> {
  if (!upload) {
    return;
  }

  const params = new URLSearchParams({
    recordingId: upload.recordingId,
    sessionId: upload.sessionId,
    sourceFormat: upload.sourceFormat,
    uploadId: upload.uploadId,
  });
  await fetch(`/api/studio/recording-upload?${params.toString()}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

async function toggleLivePublishing(): Promise<void> {
  if (liveButtonDisabled.value) {
    return;
  }
  if (requiresServerReset.value) {
    await resetLivePublishing();
    return;
  }
  if (
    livePublishStatus.value === "live" ||
    livePublishStatus.value === "degraded" ||
    livePublishStatus.value === "starting" ||
    livePublishStatus.value === "confirming"
  ) {
    await stopLivePublishing();
    return;
  }

  await startLivePublishing();
}

async function startLivePublishing(): Promise<void> {
  if (!props.sessionId || isStartingLivePublish.value) {
    return;
  }
  if (mediaBlockedReason.value) {
    livePublishStatus.value = "failed";
    livePublishError.value = mediaBlockedReason.value;
    return;
  }
  if (props.streamEnvironment === "prod" && !props.prodConfirmed) {
    livePublishStatus.value = "failed";
    livePublishError.value = "Type PROD in the control room to arm production streaming.";
    return;
  }

  isStartingLivePublish.value = true;
  const publishGeneration = livePublishGeneration + 1;
  livePublishGeneration = publishGeneration;
  livePublishStatus.value = "starting";
  livePublishError.value = "";
  livePublishWarning.value = "";
  requiresServerReset.value = false;
  whipHealthFailureGeneration = undefined;
  const streamToken = crypto.randomUUID();
  liveStreamToken = streamToken;
  try {
    const programmeOutput = await createProgrammeOutputStream();
    liveProgrammeOutput = programmeOutput;
    syncProgrammeOutputAudioStreams();
    const start = await postStreamAction<{
      liveInputId: string;
      playbackUrl: string;
      publishUrl: string;
      recovered: boolean;
      streamStatus: "starting";
      streamToken: string;
    }>("start", { streamToken });
    liveStreamToken = streamToken;
    liveServerStreamStarted = true;
    if (props.streamEnvironment !== "prod") {
      testPlaybackUrl.value = start.playbackUrl;
      testPreviewStatus.value = "starting";
    }
    if (publishGeneration !== livePublishGeneration) {
      await postStreamAction("stop", { keepalive: true, streamToken }).catch(() => undefined);
      liveServerStreamStarted = false;
      if (liveStreamToken === streamToken) {
        liveStreamToken = undefined;
      }
      await cleanupLivePublishing();
      return;
    }
    const abortController = new AbortController();
    livePublishAbortController = abortController;
    livePublishSession = await startWhipPublishing({
      publishUrl: start.publishUrl,
      signal: abortController.signal,
      stream: programmeOutput.stream,
    });
    ownsLivePublish = true;
    watchWhipConnectionState(livePublishSession, publishGeneration);
    livePublishStatus.value = "confirming";
    const confirmation = await confirmLivePublishing(publishGeneration, streamToken);
    if (publishGeneration !== livePublishGeneration) {
      await postStreamAction("stop", { keepalive: true, streamToken }).catch(() => undefined);
      liveServerStreamStarted = false;
      if (liveStreamToken === streamToken) {
        liveStreamToken = undefined;
      }
      await cleanupLivePublishing();
      return;
    }
    livePublishConfirmed = true;
    livePublishStatus.value = "live";
    if (props.streamEnvironment === "prod" && !confirmation.notified) {
      livePublishWarning.value = "Prod is live, but the public alert was not sent.";
    }
    if (props.streamEnvironment !== "prod") {
      await startUnlistedTestPreview(start.playbackUrl, publishGeneration);
    }
  } catch (error) {
    if (publishGeneration !== livePublishGeneration) {
      await cleanupLivePublishing();
      return;
    }
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
    if (liveServerStreamStarted) {
      try {
        await postStreamAction("stop", { streamToken: liveStreamToken });
        liveServerStreamStarted = false;
        liveStreamToken = undefined;
      } catch {
        requiresServerReset.value = true;
      }
    } else {
      liveStreamToken = undefined;
    }
    await cleanupLivePublishing();
    resetProdConfirmation();
  } finally {
    isStartingLivePublish.value = false;
  }
}

async function stopLivePublishing(): Promise<void> {
  if (!props.sessionId || livePublishStatus.value === "stopping") {
    return;
  }

  livePublishStatus.value = "stopping";
  livePublishError.value = "";
  livePublishGeneration += 1;
  const streamToken = liveStreamToken;
  try {
    const stopPromise = postStreamAction("stop", { streamToken });
    await cleanupLivePublishing();
    await stopPromise;
    liveServerStreamStarted = false;
    liveStreamToken = undefined;
    requiresServerReset.value = false;
    livePublishStatus.value = "ended";
    resetProdConfirmation();
  } catch (error) {
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
    requiresServerReset.value = true;
    resetProdConfirmation();
  }
}

async function stopLivePublishingForOutputLoss(reason: string): Promise<void> {
  if (!hasActiveLivePublish.value) {
    return;
  }
  await stopLivePublishing();
  if (livePublishStatus.value === "ended" && mediaBlockedReason.value) {
    livePublishStatus.value = "failed";
    livePublishError.value = `Publishing stopped: ${reason}`;
  }
}

async function resetLivePublishing(): Promise<void> {
  if (!props.sessionId || livePublishStatus.value === "stopping") {
    return;
  }

  livePublishStatus.value = "stopping";
  livePublishError.value = "";
  livePublishGeneration += 1;
  const streamToken = liveStreamToken;
  await cleanupLivePublishing();
  try {
    await postStreamAction("reset", { streamToken });
    liveServerStreamStarted = false;
    liveStreamToken = undefined;
    requiresServerReset.value = false;
    livePublishStatus.value = "ended";
  } catch (error) {
    livePublishStatus.value = "failed";
    livePublishError.value = toErrorMessage(error);
    requiresServerReset.value = true;
  } finally {
    resetProdConfirmation();
  }
}

async function confirmLivePublishing(
  publishGeneration: number,
  streamToken: string,
): Promise<{ notified: boolean; streamStatus: "live" }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (publishGeneration !== livePublishGeneration) {
      throw new Error("Live publishing stopped.");
    }
    try {
      return await postStreamAction<{ notified: boolean; streamStatus: "live" }>(
        "confirm",
        { streamToken },
      );
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

async function retryLiveNotification(): Promise<void> {
  if (
    props.streamEnvironment !== "prod" ||
    livePublishStatus.value !== "live" ||
    isRetryingLiveNotification.value
  ) {
    return;
  }

  isRetryingLiveNotification.value = true;
  try {
    const confirmation = await postStreamAction<{
      notified: boolean;
      streamStatus: "live";
    }>("confirm", { streamToken: liveStreamToken });
    livePublishWarning.value = confirmation.notified
      ? ""
      : "The public alert was not sent. Retry when notification delivery is available.";
  } catch (error) {
    livePublishWarning.value = `The public alert retry failed: ${toErrorMessage(error)}`;
  } finally {
    isRetryingLiveNotification.value = false;
  }
}

async function startUnlistedTestPreview(
  playbackUrl: string,
  publishGeneration: number,
): Promise<void> {
  if (
    props.streamEnvironment === "prod" ||
    publishGeneration !== livePublishGeneration
  ) {
    return;
  }

  await cleanupTestPreview(false);
  testPlaybackUrl.value = playbackUrl;
  testPreviewStatus.value = "starting";
  testPreviewError.value = "";
  const abortController = new AbortController();
  testPreviewAbortController = abortController;

  try {
    const previewSession = await startWhepPlayback({
      playbackUrl,
      signal: abortController.signal,
    });
    if (publishGeneration !== livePublishGeneration) {
      await previewSession.close();
      return;
    }

    testPreviewSession = previewSession;
    removeTestPreviewConnectionStateListener =
      previewSession.onConnectionStateChange((state) => {
        const health = getWebRtcConnectionHealth(state);
        if (health === "healthy") {
          testPreviewStatus.value = "playing";
          testPreviewError.value = "";
        } else if (health === "degraded") {
          testPreviewStatus.value = "degraded";
        } else if (health === "failed") {
          testPreviewStatus.value = "failed";
          testPreviewError.value = "Test playback connection failed.";
        } else {
          testPreviewStatus.value = "starting";
        }
      });

    await nextTick();
    const previewElement = testPreviewElement.value;
    if (previewElement) {
      previewElement.srcObject = previewSession.stream;
      await previewElement.play().catch(() => undefined);
    }
  } catch (error) {
    if (
      publishGeneration === livePublishGeneration &&
      !abortController.signal.aborted
    ) {
      testPreviewStatus.value = "failed";
      testPreviewError.value = toErrorMessage(error);
    }
  }
}

async function cleanupTestPreview(clearPlaybackUrl = true): Promise<void> {
  removeTestPreviewConnectionStateListener?.();
  removeTestPreviewConnectionStateListener = undefined;
  const abortController = testPreviewAbortController;
  testPreviewAbortController = undefined;
  abortController?.abort();
  const previewSession = testPreviewSession;
  testPreviewSession = undefined;
  await previewSession?.close().catch(() => undefined);
  if (testPreviewElement.value) {
    testPreviewElement.value.pause();
    testPreviewElement.value.srcObject = null;
  }
  if (clearPlaybackUrl) {
    testPlaybackUrl.value = "";
    testPreviewStatus.value = "idle";
    testPreviewError.value = "";
  }
}

async function cleanupLivePublishing(): Promise<void> {
  clearWhipDisconnectedTimer();
  removeWhipConnectionStateListener?.();
  removeWhipConnectionStateListener = undefined;
  const abortController = livePublishAbortController;
  livePublishAbortController = undefined;
  abortController?.abort();
  const publishSession = livePublishSession;
  livePublishSession = undefined;
  ownsLivePublish = false;
  livePublishConfirmed = false;
  livePublishWarning.value = "";
  isRetryingLiveNotification.value = false;
  await publishSession?.close().catch(() => undefined);
  const programmeOutput = liveProgrammeOutput;
  liveProgrammeOutput = undefined;
  await programmeOutput?.close().catch(() => undefined);
  await cleanupTestPreview();
}

function watchWhipConnectionState(
  publishSession: WhipPublishSession,
  publishGeneration: number,
): void {
  removeWhipConnectionStateListener?.();
  removeWhipConnectionStateListener = publishSession.onConnectionStateChange((state) => {
    if (
      publishGeneration !== livePublishGeneration ||
      publishSession !== livePublishSession
    ) {
      return;
    }

    const health = getWebRtcConnectionHealth(state);
    if (health === "healthy") {
      clearWhipDisconnectedTimer();
      if (livePublishStatus.value === "degraded") {
        livePublishStatus.value = livePublishConfirmed ? "live" : "confirming";
        livePublishError.value = "";
      }
      return;
    }
    if (health === "degraded") {
      livePublishStatus.value = "degraded";
      if (whipDisconnectedTimer === undefined) {
        whipDisconnectedTimer = window.setTimeout(() => {
          whipDisconnectedTimer = undefined;
          void failWhipPublishing(
            publishGeneration,
            "Publisher connection did not recover. Reset complete; retry when ready.",
          );
        }, 6000);
      }
      return;
    }
    if (health === "failed") {
      clearWhipDisconnectedTimer();
      void failWhipPublishing(
        publishGeneration,
        "Publisher connection failed. Reset complete; retry when ready.",
      );
    }
  });
}

function clearWhipDisconnectedTimer(): void {
  if (whipDisconnectedTimer !== undefined) {
    window.clearTimeout(whipDisconnectedTimer);
    whipDisconnectedTimer = undefined;
  }
}

async function failWhipPublishing(
  publishGeneration: number,
  message: string,
): Promise<void> {
  if (
    publishGeneration !== livePublishGeneration ||
    whipHealthFailureGeneration === publishGeneration
  ) {
    return;
  }

  whipHealthFailureGeneration = publishGeneration;
  livePublishGeneration += 1;
  const streamToken = liveStreamToken;
  livePublishStatus.value = "failed";
  livePublishError.value = message;
  requiresServerReset.value = true;
  await cleanupLivePublishing();
  try {
    await postStreamAction("reset", { streamToken });
    liveServerStreamStarted = false;
    liveStreamToken = undefined;
    requiresServerReset.value = false;
  } catch (error) {
    livePublishError.value = `${message} Server reset failed: ${toErrorMessage(error)}`;
  } finally {
    resetProdConfirmation();
  }
}

function resetProdConfirmation(): void {
  if (props.streamEnvironment === "prod") {
    emit("prod-confirmation-reset");
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function postStreamAction<T = unknown>(
  action: "confirm" | "reset" | "start" | "stop",
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

  livePublishGeneration += 1;
  const streamToken = liveStreamToken;
  if (!liveServerStreamStarted && !ownsLivePublish && !streamToken) {
    return;
  }
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

async function createProgrammeOutputStream(): Promise<ProgrammeOutput> {
  const canvasStream = captureCanvasStream();
  if (!canvasStream) {
    throw new Error("Programme canvas stream is not available.");
  }

  return await createProgrammeOutput(canvasStream, getProgrammeAudioStreams);
}

function getProgrammeAudioStreams(): MediaStream[] {
  const sourceIds = props.programmeSourceIds ?? getProgrammeMediaSourceIds(props.layers);
  return [...new Set(sourceIds)]
    .map((sourceId) => props.mediaStreams?.get(sourceId))
    .filter((stream): stream is MediaStream => Boolean(stream));
}

function syncProgrammeOutputAudioStreams(): void {
  const audioStreams = getProgrammeAudioStreams();
  const failures: string[] = [];
  for (const [label, output] of [
    ["live", liveProgrammeOutput],
    ["recording", recordingProgrammeOutput],
  ] as const) {
    if (!output) {
      continue;
    }
    try {
      output.setAudioStreams(audioStreams);
    } catch (error) {
      failures.push(`${label}: ${toErrorMessage(error)}`);
    }
  }
  programmeAudioWarning.value = failures.length > 0
    ? `Programme audio update failed (${failures.join("; ")}). Output continues with the existing mix.`
    : "";
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
  return body?.error ?? `Studio request failed with ${response.status}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Studio request failed.";
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
  () => props.mediaStreams,
  (streams) => {
    syncMediaVideoElements(streams ?? new Map());
    renderLoop.queuePaint();
  },
  { immediate: true },
);

watch(
  [
    () => props.layers,
    () => props.mediaStreams,
    () => props.programmeSourceIds,
  ],
  syncProgrammeOutputAudioStreams,
);

watch(
  () => props.publishBlockedReason,
  (reason) => {
    const blockedReason = reason?.trim();
    if (!blockedReason) {
      return;
    }
    if (isLocalRecording.value) {
      stopLocalRecording();
    }
    if (hasActiveLivePublish.value) {
      void stopLivePublishingForOutputLoss(blockedReason);
    }
  },
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
  if (isLocalRecording.value) {
    stopLocalRecording();
  } else if (isStartingRecording.value) {
    void cleanupPendingRecordingStart();
  }
  void stopOwnedLivePublishingForTeardown();
  clearMediaVideoElements();
  stopOverlayAnimations();
  stopStingerAnimation();
  frameResizeObserver?.disconnect();
  renderLoop.stop();
});

defineExpose({
  captureCanvasStream,
  exportPng,
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
  <section class="canvas-deck" :aria-label="title">
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
          :title="liveButtonDisabled ? mediaBlockedReason : undefined"
          @click="toggleLivePublishing"
        >
          {{ liveButtonLabel }}
        </button>
        <span
          v-if="liveStatusText"
          class="recording-upload-state"
          :class="{ error: livePublishStatus === 'failed' || Boolean(mediaBlockedReason) }"
        >
          {{ liveStatusText }}
        </span>
        <span
          v-if="livePublishWarning"
          class="recording-upload-state error"
          aria-live="polite"
        >
          {{ livePublishWarning }}
        </span>
        <button
          v-if="livePublishWarning && streamEnvironment === 'prod'"
          class="secondary-button compact"
          type="button"
          :disabled="isRetryingLiveNotification"
          @click="retryLiveNotification"
        >
          {{ isRetryingLiveNotification ? "Retrying alert" : "Retry alert" }}
        </button>
        <button
          class="record-button compact"
          :class="{ active: isLocalRecording }"
          type="button"
          :disabled="recordButtonDisabled"
          :title="recordButtonDisabled ? mediaBlockedReason : undefined"
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
        <span
          v-if="recordingRecoveryWarning"
          class="recording-upload-state warning"
          :title="recordingRecoveryWarning"
          aria-live="polite"
        >
          {{ recordingRecoveryWarning }}
        </span>
        <span
          v-if="programmeAudioWarning"
          class="recording-upload-state warning"
          aria-live="polite"
        >
          {{ programmeAudioWarning }}
        </span>
        <a
          v-if="recordingStatusHref"
          class="secondary-button compact recording-status-link"
          :href="recordingStatusHref"
        >
          Status
        </a>
        <div class="canvas-meter" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
    <RecordingRecovery
      v-if="canPublishLive"
      :active-recording-id="activeRecordingBackupId"
      :refresh-version="recordingRecoveryVersion"
    />
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
      <aside
        v-if="testPlaybackUrl && streamEnvironment !== 'prod'"
        class="test-playback-preview"
        aria-label="Unlisted Test playback"
      >
        <div class="test-playback-preview-header">
          <strong>Unlisted Test playback</strong>
          <span
            :class="{ error: testPreviewStatus === 'failed' }"
            aria-live="polite"
          >
            {{ testPreviewStatusText }}
          </span>
        </div>
        <video
          ref="testPreviewElement"
          autoplay
          muted
          playsinline
        />
      </aside>
    </div>
  </section>
</template>

<style scoped>
.canvas-frame {
  position: relative;
}

.test-playback-preview {
  position: absolute;
  right: 18px;
  bottom: 18px;
  width: min(320px, 36%);
  overflow: hidden;
  border: 1px solid rgba(143, 243, 233, 0.55);
  border-radius: 8px;
  background: #080b10;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.48);
}

.test-playback-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  color: #d8f8f4;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.test-playback-preview-header span {
  color: #8ff3e9;
}

.test-playback-preview-header span.error {
  color: #ffb0a4;
}

.test-playback-preview video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  object-fit: contain;
}

@media (max-width: 900px) {
  .test-playback-preview {
    width: min(240px, 48%);
  }
}
</style>
