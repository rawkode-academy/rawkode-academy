<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  stream?: MediaStream;
}>();
const emit = defineEmits<{
  "readiness-change": [stream: MediaStream | undefined, track: MediaStreamTrack | undefined, ready: boolean];
}>();

const videoElement = ref<HTMLVideoElement | null>(null);
let previewTrack: MediaStreamTrack | undefined;

watch(() => props.stream, syncVideoStream, { immediate: true });

onMounted(syncVideoStream);

onBeforeUnmount(() => {
  emit("readiness-change", props.stream, previewTrack, false);
  if (!videoElement.value) {
    return;
  }

  videoElement.value.pause();
  videoElement.value.srcObject = null;
});

function syncVideoStream(): void {
  emit("readiness-change", props.stream, previewTrack, false);
  const tracks = props.stream?.getVideoTracks() ?? [];
  previewTrack = tracks.length === 1 ? tracks[0] : undefined;
  const video = videoElement.value;
  if (!video) {
    return;
  }

  video.srcObject = props.stream ?? null;
  if (props.stream) {
    video.play().catch(() => undefined);
  }
}

function reportFrame(): void {
  const video = videoElement.value;
  const stream = props.stream;
  const tracks = stream?.getVideoTracks() ?? [];
  if (stream && previewTrack && tracks.length === 1 && tracks[0] === previewTrack &&
      previewTrack.readyState === "live" && previewTrack.enabled && !previewTrack.muted &&
      video?.srcObject === stream && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    emit("readiness-change", stream, previewTrack, true);
  }
}

function clearFrame(): void {
  emit("readiness-change", props.stream, previewTrack, false);
}
</script>

<template>
  <video ref="videoElement" autoplay muted playsinline @loadeddata="reportFrame" @playing="reportFrame" @emptied="clearFrame" @error="clearFrame" />
</template>
