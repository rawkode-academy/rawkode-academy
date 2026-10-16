<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ContributorLocalIsoStore,
  getContributorLocalIsoMediaSignature,
  getContributorLocalIsoMimeType,
  startContributorLocalIsoRecording,
  type ContributorLocalIsoManifest,
  type ContributorLocalIsoRecording,
} from "../recording/contributorLocalIso";

const props = defineProps<{
  mediaStream?: MediaStream | null;
  participantId: string;
  sessionId: string;
}>();

const recording = ref<ContributorLocalIsoRecording | null>(null);
const records = ref<ContributorLocalIsoManifest[]>([]);
const isLoading = ref(false);
const isStopping = ref(false);
const message = ref("");
let isUnmounted = false;
let activeMediaSignature = "";
let stopReason = "";
const isSupported = computed(() => getContributorLocalIsoMimeType() !== undefined);
const hasLiveMedia = computed(() => props.mediaStream?.getTracks().some((track) => track.readyState === "live") === true);
const canStart = computed(() => isSupported.value && hasLiveMedia.value && !recording.value && !isLoading.value);

async function refreshRecords(): Promise<void> {
  if (!props.sessionId || !props.participantId || typeof indexedDB === "undefined") return;
  try {
    const store = await ContributorLocalIsoStore.open();
    try {
      records.value = await store.listRecoverable(props.sessionId, props.participantId);
    } finally {
      store.close();
    }
  } catch {
    message.value = "Local recording recovery is unavailable in this browser.";
  }
}

async function start(): Promise<void> {
  if (!canStart.value || !props.mediaStream) return;
  isLoading.value = true;
  message.value = "";
  const requestedMediaStream = props.mediaStream;
  const requestedMediaSignature = getContributorLocalIsoMediaSignature(requestedMediaStream);
  try {
    const activeRecording = await startContributorLocalIsoRecording({
      mediaStream: requestedMediaStream,
      participantId: props.participantId,
      sessionId: props.sessionId,
    });
    if (isUnmounted || getContributorLocalIsoMediaSignature(props.mediaStream) !== requestedMediaSignature) {
      await activeRecording.stop();
      if (!isUnmounted) {
        message.value = "Local recording stopped because your selected camera or microphone changed. Start a new recording to continue.";
      }
      return;
    }
    recording.value = activeRecording;
    activeMediaSignature = requestedMediaSignature;
    message.value = "Local recording is running on this device.";
    void recording.value.finished.then((manifest) => {
      if (recording.value?.manifest.id !== manifest.id) return;
      recording.value = null;
      isStopping.value = false;
      message.value = stopReason || (manifest.status === "complete"
        ? "Local recording saved on this device. Download or discard it below."
        : `Local recording stopped with a problem: ${manifest.failureReason ?? "capture was incomplete"}`);
      stopReason = "";
      void refreshRecords();
    }).catch((error: unknown) => {
      if (recording.value) recording.value = null;
      isStopping.value = false;
      message.value = error instanceof Error ? error.message : "Local recording could not be finalized.";
    });
  } catch (error) {
    message.value = error instanceof Error ? error.message : "Unable to start local recording.";
  } finally {
    isLoading.value = false;
  }
}

async function stop(): Promise<void> {
  if (!recording.value || isStopping.value) return;
  isStopping.value = true;
  message.value = "Finalizing your local recording…";
  try {
    await recording.value.stop();
  } catch (error) {
    message.value = error instanceof Error ? error.message : "Unable to finalize local recording.";
  } finally {
    // The `finished` observer above updates recovery state for manual and failure stops.
  }
}

async function download(manifest: ContributorLocalIsoManifest): Promise<void> {
  try {
    const store = await ContributorLocalIsoStore.open();
    let blob: Blob | undefined;
    try {
      blob = await store.readBlob(manifest.id);
    } finally {
      store.close();
    }
    if (!blob || blob.size === 0) {
      message.value = "This local recording has no recoverable media.";
      return;
    }
    downloadBlob(blob, `rawkode-local-iso-${manifest.sessionId}-${manifest.startedAt.replaceAll(/[:.]/g, "-")}.webm`);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "Unable to download this local recording.";
  }
}

function downloadManifest(manifest: ContributorLocalIsoManifest): void {
  downloadBlob(
    new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    `rawkode-local-iso-${manifest.sessionId}-${manifest.startedAt.replaceAll(/[:.]/g, "-")}.json`,
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function discard(manifest: ContributorLocalIsoManifest): Promise<void> {
  if (!window.confirm(`Discard local recording from ${new Date(manifest.startedAt).toLocaleString()}? This cannot be undone.`)) {
    return;
  }
  try {
    const store = await ContributorLocalIsoStore.open();
    try {
      await store.discard(manifest.id);
    } finally {
      store.close();
    }
    records.value = records.value.filter((record) => record.id !== manifest.id);
  } catch (error) {
    message.value = error instanceof Error ? error.message : "Unable to discard this local recording.";
  }
}

watch(() => [props.sessionId, props.participantId], () => void refreshRecords());
watch(() => getContributorLocalIsoMediaSignature(props.mediaStream), (signature) => {
  if (!recording.value || signature === activeMediaSignature) return;
  stopReason = "Local recording stopped because your selected camera or microphone changed. Start a new recording to continue.";
  void recording.value.stop();
});
onMounted(() => void refreshRecords());
onBeforeUnmount(() => {
  isUnmounted = true;
  if (recording.value) void recording.value.stop();
});
</script>

<template>
  <section class="contributor-local-recording" aria-labelledby="local-recording-heading">
    <div>
      <h3 id="local-recording-heading">Personal local recording</h3>
      <p>
        Optional and saved only in this browser. It records your own camera and microphone;
        it is never uploaded or added to the programme recording.
      </p>
    </div>
    <div class="contributor-local-recording-actions">
      <button
        v-if="!recording"
        class="secondary-button compact"
        type="button"
        :disabled="!canStart"
        @click="start"
      >
        {{ isLoading ? "Starting local recording" : "Start local recording" }}
      </button>
      <button
        v-else
        class="secondary-button compact"
        type="button"
        :disabled="isStopping"
        @click="stop"
      >
        {{ isStopping ? "Stopping local recording" : "Stop local recording" }}
      </button>
      <span v-if="!isSupported" class="room-error">Local recording is not supported by this browser.</span>
      <span v-else-if="!hasLiveMedia && !recording" class="room-state">Join with a live camera or microphone to record.</span>
    </div>
    <p v-if="message" class="contributor-local-recording-status" role="status">{{ message }}</p>
    <div v-if="records.length" class="contributor-local-recording-recovery" aria-label="Recovered local recordings">
      <strong>Recovered local recordings</strong>
      <article v-for="manifest in records" :key="manifest.id">
        <span>{{ new Date(manifest.startedAt).toLocaleString() }} · {{ manifest.status }}</span>
        <div>
          <button class="ghost-button mini" type="button" @click="download(manifest)">Download</button>
          <button class="ghost-button mini" type="button" @click="downloadManifest(manifest)">Manifest</button>
          <button class="ghost-button mini" type="button" @click="discard(manifest)">Discard</button>
        </div>
      </article>
    </div>
  </section>
</template>
