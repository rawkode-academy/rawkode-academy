<script setup lang="ts">
import RealtimeKitClient from "@cloudflare/realtimekit";
import { defineCustomElements } from "@cloudflare/realtimekit-ui/loader";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ContributorLocalRecording from "./ContributorLocalRecording.vue";
import {
  getRealtimeKitParticipantSourceIds,
  isRealtimeKitSnapshotAuthoritative,
  mapRealtimeKitParticipantSources,
  type RealtimeKitParticipant,
  type RealtimeKitParticipantRole,
} from "../realtimekit/participantSources";
import {
  getRealtimeKitRoomStatus,
  type RealtimeKitRoomPhase,
} from "../realtimekit/roomConnection";
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
    departedSourceIds?: string[];
    sources: StudioSource[];
    streams: Map<string, MediaStream>;
  }];
}>();

const meetingElement = ref<HTMLElement | null>(null);
const state = ref<RoomState>("idle");
const errorMessage = ref("");
const meeting = ref<RealtimeKitMeeting | null>(null);
const roomJoined = ref(false);
const selfMediaStream = ref<MediaStream | null>(null);
const selfParticipantId = ref("");
let roomOperationGeneration = 0;
const roomMediaEvents = [
  "participantJoined",
  "participantsUpdate",
  "audioUpdate",
  "videoUpdate",
  "screenShareUpdate",
] as const;
let removeRoomMediaListeners: Array<() => void> = [];

const buttonLabel = computed(() => {
  if (state.value === "opening") return "Opening device check";
  if (state.value === "open") return "Close room";
  return "Open device check";
});
const roomStateLabel = computed(() => {
  return roomStatus.value.label;
});
const roomPhase = computed<RealtimeKitRoomPhase>(() => {
  if (state.value === "opening") return "opening";
  if (state.value === "open") return roomJoined.value ? "joined" : "setup";
  if (state.value === "unavailable") return "unavailable";
  return "closed";
});
const roomStatus = computed(() => getRealtimeKitRoomStatus(roomPhase.value, props.role));
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
    roomJoined.value = nextMeeting.self.roomJoined === true;
    syncSelfMedia(nextMeeting);
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
  roomJoined.value = false;
  selfMediaStream.value = null;
  selfParticipantId.value = "";
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
  const syncMedia = (departedSourceIds: string[] = [], authoritative?: boolean) => {
    if (meeting.value !== nextMeeting) {
      return;
    }
    emitRoomMediaStreams(
      nextMeeting,
      authoritative ?? isRealtimeKitSnapshotAuthoritative(nextMeeting.self, roomJoinedEventObserved),
      departedSourceIds,
    );
  };
  const handleRoomJoined = () => {
    roomJoinedEventObserved = true;
    if (meeting.value === nextMeeting) {
      roomJoined.value = true;
      syncSelfMedia(nextMeeting);
    }
    syncMedia();
  };
  const handleRoomLeft = () => {
    roomJoinedEventObserved = false;
    if (meeting.value === nextMeeting) {
      roomJoined.value = false;
      selfMediaStream.value = null;
    }
    syncMedia();
  };
  const handleParticipantLeft = (participant: RealtimeKitParticipant) => {
    // Revoke admission before a durable identity can reappear in a coalesced map snapshot.
    syncMedia(getRealtimeKitParticipantSourceIds(participant), true);
  };

  const meetingSelf = nextMeeting.self;
  meetingSelf.on("roomJoined", handleRoomJoined);
  meetingSelf.on("roomLeft", handleRoomLeft);
  const syncSelf = () => syncSelfMedia(nextMeeting);
  meetingSelf.on("audioUpdate", syncSelf);
  meetingSelf.on("videoUpdate", syncSelf);
  removeRoomMediaListeners.push(() => {
    meetingSelf.off("roomJoined", handleRoomJoined);
    meetingSelf.off("roomLeft", handleRoomLeft);
    meetingSelf.off("audioUpdate", syncSelf);
    meetingSelf.off("videoUpdate", syncSelf);
  });

  for (const participantMap of [
    nextMeeting.participants.joined,
    nextMeeting.participants.active,
  ]) {
    participantMap.on("participantLeft", handleParticipantLeft);
    removeRoomMediaListeners.push(() => {
      participantMap.off("participantLeft", handleParticipantLeft);
    });
    for (const event of roomMediaEvents) {
      const syncSnapshot = () => syncMedia();
      participantMap.on(event, syncSnapshot);
      removeRoomMediaListeners.push(() => {
        participantMap.off(event, syncSnapshot);
      });
    }
  }

  syncMedia();
}

/** Uses RealtimeKit Self's documented audioTrack/videoTrack getters. */
function syncSelfMedia(nextMeeting: RealtimeKitMeeting): void {
  const self = nextMeeting.self;
  const tracks = [
    self.videoEnabled ? self.videoTrack : undefined,
    self.audioEnabled ? self.audioTrack : undefined,
  ].filter((track): track is MediaStreamTrack => track?.readyState === "live");
  selfMediaStream.value = tracks.length > 0 ? new MediaStream(tracks) : null;
  selfParticipantId.value = self.customParticipantId || self.userId || self.id;
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
  departedSourceIds: string[] = [],
): void {
  const mapping = mapRealtimeKitParticipantSources(getRemoteParticipants(nextMeeting));
  emit("media-streams-change", {
    authoritative,
    departedSourceIds,
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
    <p class="room-preflight-summary" aria-live="polite">
      {{ roomStatus.instructions }}
    </p>
    <div
      id="realtimekit-room-drawer"
      v-show="state === 'open'"
      class="realtimekit-room-drawer"
      role="region"
      :aria-label="roomJoined ? 'RealtimeKit contributor room' : 'RealtimeKit device setup'"
    >
      <rtk-meeting ref="meetingElement" mode="fill" show-setup-screen="true" />
    </div>
    <ContributorLocalRecording
      v-if="state === 'open' && selfParticipantId"
      :media-stream="selfMediaStream"
      :participant-id="selfParticipantId"
      :session-id="sessionId"
    />
  </div>
</template>
