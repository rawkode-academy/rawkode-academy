<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  stream?: MediaStream;
}>();

const videoElement = ref<HTMLVideoElement | null>(null);

watch(() => props.stream, syncVideoStream, { immediate: true });

onMounted(syncVideoStream);

onBeforeUnmount(() => {
  if (!videoElement.value) {
    return;
  }

  videoElement.value.pause();
  videoElement.value.srcObject = null;
});

function syncVideoStream(): void {
  const video = videoElement.value;
  if (!video) {
    return;
  }

  video.srcObject = props.stream ?? null;
  if (props.stream) {
    video.play().catch(() => undefined);
  }
}
</script>

<template>
  <video ref="videoElement" autoplay muted playsinline />
</template>
