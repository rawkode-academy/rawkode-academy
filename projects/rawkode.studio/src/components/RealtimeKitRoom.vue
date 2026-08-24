<script setup lang="ts">
import RealtimeKitClient from "@cloudflare/realtimekit";
import { defineCustomElements } from "@cloudflare/realtimekit-ui/loader";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  isRealtimeKitSnapshotAuthoritative,
  mapRealtimeKitParticipantSources,
  type RealtimeKitParticipant,
  type RealtimeKitParticipantRole,
} from "../realtimekit/participantSources";
import type { StudioSource } from "../types";

type RoomState = "idle" | "open" | "opening" | "unavailable";
type RealtimeKitMeeting = Awaited<ReturnType<typeof RealtimeKitClient.init>>;
type RealtimeKitMeetingElement = HTMLElement & {
  meeting?: RealtimeKitMeeting;
};

const props = defineProps<{
  inviteToken?: string;
  providerReady?: boolean;
  role: RealtimeKitParticipantRole;
  sessionId: string;
}>();

const emit = defineEmits<{
  "media-streams-change": [payload: {
    authoritative: boolean;
    sources: StudioSource[];
    streams: Map<string, MediaStream>;
  }];
}>();

const meetingElement = ref<HTMLElement | null>(null);
const state = ref<RoomState>("idle");
const errorMessage = ref("");
const meeting = ref<RealtimeKitMeeting | null>(null);
let roomOperationGeneration = 0;
const roomMediaEvents = [
  "participantJoined",
  "participantLeft",
  "participantsUpdate",
  "audioUpdate",
  "videoUpdate",
  "screenShareUpdate",
] as const;
let removeRoomMediaListeners: Array<() => void> = [];

const buttonLabel = computed(() => {
  if (state.value === "opening") return "Opening room";
  if (state.value === "open") return "Close room";
  return "Open room";
});
const roomStateLabel = computed(() => {
  if (state.value === "opening") return "Opening device setup";
  if (state.value === "open") return "Device setup open";
  if (state.value === "unavailable") return "Room unavailable";
  return "Room closed";
});
const canToggleRoom = computed(() =>
  state.value === "open" ||
  (
    Boolean(props.sessionId) &&
    props.providerReady !== false &&
    state.value !== "opening"
  )
);

async function toggleRoom(): Promise<void> {
  if (state.value === "open") {
    await closeRoom();
    return;
  }

  await openRoom();
}

async function openRoom(): Promise<void> {
  if (!canToggleRoom.value || state.value === "open") return;

  const operationGeneration = roomOperationGeneration + 1;
  roomOperationGeneration = operationGeneration;
  state.value = "opening";
  errorMessage.value = "";

  try {
    await registerRealtimeKitElements();
    const token = await issueParticipantToken();
    const nextMeeting = await RealtimeKitClient.init({
      authToken: token,
      defaults: { audio: true, video: true },
    });
    if (operationGeneration !== roomOperationGeneration) {
      await disconnectMeeting(nextMeeting);
      return;
    }
    meeting.value = nextMeeting;
    const element = meetingElement.value as RealtimeKitMeetingElement | null;
    if (element) {
      element.meeting = nextMeeting;
    }
    watchRoomMedia(nextMeeting);
    state.value = "open";
  } catch (error) {
    if (operationGeneration !== roomOperationGeneration) {
      return;
    }
    state.value = "unavailable";
    errorMessage.value = error instanceof Error ? error.message : "Unable to open room";
    await closeRoom(false);
  }
}

async function closeRoom(resetState = true): Promise<void> {
  roomOperationGeneration += 1;
  const currentMeeting = meeting.value;
  meeting.value = null;
  stopWatchingRoomMedia();

  const element = meetingElement.value as RealtimeKitMeetingElement | null;
  if (element) {
    element.meeting = undefined;
  }

  let closeError = "";
  if (currentMeeting) {
    await disconnectMeeting(currentMeeting).catch((error: unknown) => {
      closeError = error instanceof Error ? error.message : "Unable to close room";
    });
  }

  if (resetState) {
    state.value = closeError ? "unavailable" : "idle";
    errorMessage.value = closeError;
  }
  emit("media-streams-change", {
    authoritative: false,
    sources: [],
    streams: new Map(),
  });
}

async function disconnectMeeting(currentMeeting: RealtimeKitMeeting): Promise<void> {
  await currentMeeting.leave();
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

async function registerRealtimeKitElements(): Promise<void> {
  if (!window.customElements.get("rtk-meeting")) {
    await defineCustomElements(window);
  }
}

function watchRoomMedia(nextMeeting: RealtimeKitMeeting): void {
  stopWatchingRoomMedia();
  let roomJoinedEventObserved = false;
  const syncMedia = () => {
    if (meeting.value !== nextMeeting) {
      return;
    }
    emitRoomMediaStreams(
      nextMeeting,
      isRealtimeKitSnapshotAuthoritative(
        nextMeeting.self,
        roomJoinedEventObserved,
      ),
    );
  };
  const handleRoomJoined = () => {
    roomJoinedEventObserved = true;
    syncMedia();
  };
  const handleRoomLeft = () => {
    roomJoinedEventObserved = false;
    syncMedia();
  };

  const meetingSelf = nextMeeting.self;
  meetingSelf.on("roomJoined", handleRoomJoined);
  meetingSelf.on("roomLeft", handleRoomLeft);
  removeRoomMediaListeners.push(() => {
    meetingSelf.off("roomJoined", handleRoomJoined);
    meetingSelf.off("roomLeft", handleRoomLeft);
  });

  for (const participantMap of [
    nextMeeting.participants.joined,
    nextMeeting.participants.active,
  ]) {
    for (const event of roomMediaEvents) {
      participantMap.on(event, syncMedia);
      removeRoomMediaListeners.push(() => {
        participantMap.off(event, syncMedia);
      });
    }
  }

  syncMedia();
}

function stopWatchingRoomMedia(): void {
  for (const removeListener of removeRoomMediaListeners) {
    removeListener();
  }
  removeRoomMediaListeners = [];
}

function emitRoomMediaStreams(
  nextMeeting: RealtimeKitMeeting,
  authoritative: boolean,
): void {
  const mapping = mapRealtimeKitParticipantSources(getRemoteParticipants(nextMeeting));
  emit("media-streams-change", {
    authoritative,
    sources: mapping.sources,
    streams: new Map(
      mapping.streams.map(({ sourceId, tracks }) => [sourceId, new MediaStream(tracks)]),
    ),
  });
}

function getRemoteParticipants(nextMeeting: RealtimeKitMeeting): RealtimeKitParticipant[] {
  return [
    ...nextMeeting.participants.joined.values(),
    ...nextMeeting.participants.active.values(),
  ];
}

watch(
  () => [props.sessionId, props.role, props.inviteToken],
  () => {
    if (state.value !== "idle" || meeting.value) {
      void closeRoom();
    }
  },
);

onBeforeUnmount(() => {
  void closeRoom(false);
});
</script>

<template>
  <div
    class="realtimekit-room"
    :data-state="state"
    :aria-busy="state === 'opening'"
  >
    <button
      class="secondary-button compact"
      type="button"
      :disabled="!canToggleRoom"
      :aria-expanded="state === 'open'"
      aria-controls="realtimekit-room-drawer"
      @click="toggleRoom"
    >
      {{ buttonLabel }}
    </button>
    <span class="room-state" role="status" aria-live="polite" aria-atomic="true">
      {{ roomStateLabel }}
    </span>
    <span v-if="errorMessage" class="room-error" role="alert">{{ errorMessage }}</span>
    <div
      id="realtimekit-room-drawer"
      v-show="state === 'open'"
      class="realtimekit-room-drawer"
      role="region"
      aria-label="RealtimeKit device setup"
    >
      <rtk-meeting ref="meetingElement" mode="fill" show-setup-screen="true" />
    </div>
  </div>
</template>
