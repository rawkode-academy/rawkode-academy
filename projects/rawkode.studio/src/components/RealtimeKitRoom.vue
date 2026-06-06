<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

type StudioRole = "guest" | "host" | "producer" | "program";
type RoomState = "connected" | "connecting" | "idle" | "unavailable";

declare global {
  interface Window {
    RealtimeKitClient?: {
      init(input: {
        authToken: string;
        defaults: {
          audio: boolean;
          video: boolean;
        };
      }): Promise<RealtimeKitMeeting>;
    };
  }
}

interface RealtimeKitMeeting {
  disconnect?: () => Promise<void> | void;
  join?: () => Promise<void> | void;
  joinRoom?: () => Promise<void> | void;
  leave?: () => Promise<void> | void;
  leaveRoom?: () => Promise<void> | void;
}

const props = defineProps<{
  inviteToken?: string;
  role: StudioRole;
  sessionId: string;
}>();

const meetingElement = ref<HTMLElement | null>(null);
const state = ref<RoomState>("idle");
const errorMessage = ref("");
const meeting = ref<RealtimeKitMeeting | null>(null);
let uiKitLoaded: Promise<void> | undefined;
let clientLoaded: Promise<void> | undefined;

const buttonLabel = computed(() => {
  if (state.value === "connecting") return "Joining";
  if (state.value === "connected") return "Leave room";
  return "Join room";
});
const canJoin = computed(() => Boolean(props.sessionId) && state.value !== "connecting");

async function toggleRoom(): Promise<void> {
  if (state.value === "connected") {
    await leaveRoom();
    return;
  }

  await joinRoom();
}

async function joinRoom(): Promise<void> {
  if (!canJoin.value) return;

  state.value = "connecting";
  errorMessage.value = "";

  try {
    await loadRealtimeKit();
    const token = await issueParticipantToken();
    const client = window.RealtimeKitClient;
    if (!client) {
      throw new Error("RealtimeKit client did not load");
    }

    const nextMeeting = await client.init({
      authToken: token,
      defaults: { audio: true, video: true },
    });
    meeting.value = nextMeeting;
    const element = meetingElement.value as
      | (HTMLElement & { meeting?: RealtimeKitMeeting })
      | null;
    if (element) {
      element.meeting = nextMeeting;
    }
    const join = nextMeeting.joinRoom ?? nextMeeting.join;
    if (join) {
      await join.call(nextMeeting);
    }
    state.value = "connected";
  } catch (error) {
    state.value = "unavailable";
    errorMessage.value = error instanceof Error ? error.message : "Unable to join room";
    await leaveRoom(false);
  }
}

async function leaveRoom(resetState = true): Promise<void> {
  const currentMeeting = meeting.value;
  meeting.value = null;

  const element = meetingElement.value as
    | (HTMLElement & { meeting?: RealtimeKitMeeting })
    | null;
  if (element) {
    element.meeting = undefined;
  }

  if (currentMeeting) {
    const leave =
      currentMeeting.leaveRoom ??
      currentMeeting.leave ??
      currentMeeting.disconnect;
    if (leave) {
      await leave.call(currentMeeting);
    }
  }

  if (resetState) {
    state.value = "idle";
    errorMessage.value = "";
  }
}

async function issueParticipantToken(): Promise<string> {
  const response = await fetch("/api/studio/participant-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteToken: props.inviteToken,
      role: props.role,
      sessionId: props.sessionId,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    token?: string;
  } | null;

  if (!response.ok || !body?.token) {
    throw new Error(body?.error ?? `Participant token failed with ${response.status}`);
  }

  return body.token;
}

async function loadRealtimeKit(): Promise<void> {
  uiKitLoaded ??= import(
    /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit-ui@latest/loader/index.es2017.js"
  ).then((module) => module.defineCustomElements());
  clientLoaded ??= loadScript(
    "https://cdn.jsdelivr.net/npm/@cloudflare/realtimekit@latest/dist/browser.js",
  );

  await Promise.all([uiKitLoaded, clientLoaded]);
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existing?.dataset.ready === "true") return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.ready = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("RealtimeKit client failed to load")), {
      once: true,
    });
    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

watch(
  () => [props.sessionId, props.role, props.inviteToken],
  () => {
    if (state.value === "connected") {
      void leaveRoom();
    }
  },
);

onBeforeUnmount(() => {
  void leaveRoom();
});
</script>

<template>
  <div class="realtimekit-room" :data-state="state">
    <button
      class="secondary-button compact"
      type="button"
      :disabled="!canJoin"
      @click="toggleRoom"
    >
      {{ buttonLabel }}
    </button>
    <span class="room-state">{{ state }}</span>
    <span v-if="errorMessage" class="room-error">{{ errorMessage }}</span>
    <div v-show="state === 'connected'" class="realtimekit-room-drawer">
      <rtk-meeting ref="meetingElement" mode="fill" show-setup-screen="true" />
    </div>
  </div>
</template>
