<script setup lang="ts">
import { onMounted, ref } from "vue";
import RealtimeKitRoom from "./RealtimeKitRoom.vue";

const sessionId = ref("");
const inviteToken = ref<string | undefined>();

onMounted(() => {
  const shell = document.querySelector<HTMLElement>("[data-guest-room]");
  sessionId.value = shell?.dataset.sessionId ?? "";
  inviteToken.value = new URLSearchParams(window.location.search).get("invite") ?? undefined;
});
</script>

<template>
  <RealtimeKitRoom
    v-if="sessionId"
    :invite-token="inviteToken"
    role="guest"
    :session-id="sessionId"
  />
  <p v-else class="room-error" role="alert">Guest room details are unavailable.</p>
</template>
