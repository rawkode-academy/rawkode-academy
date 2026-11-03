<script setup lang="ts">
import RealtimeKitClient from "@cloudflare/realtimekit";
import { defineCustomElements } from "@cloudflare/realtimekit-ui/loader";
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import ContributorLocalRecording from "./ContributorLocalRecording.vue";
import {
  createRealtimeKitSourceAuthority,
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
// Keep the SDK client raw: callbacks compare it with the original instance.
const meeting = shallowRef<RealtimeKitMeeting | null>(null);
const roomJoined = ref(false);
const selfMediaStream = ref<MediaStream | null>(null);
const selfParticipantId = ref("");
let roomOperationGeneration = 0;
const roomMediaEvents = [
  "participantJoined",
  "participantsUpdate",
  "audioUpdate",
  "videoUpdate",
] as const;
let removeRoomMediaListeners: Array<() => void> = [];
const roomSourceAuthority = createRealtimeKitSourceAuthority();

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
  const closeGeneration = roomOperationGeneration;
  const currentMeeting = meeting.value;
  meeting.value = null;
  roomJoined.value = false;
  selfMediaStream.value = null;
  selfParticipantId.value = "";
  stopWatchingRoomMedia();
  // Revoke immediately: leave() may hang or finish after another room opens.
  emitRoomMediaLoss();

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

  if (resetState && closeGeneration === roomOperationGeneration) {
    state.value = closeError ? "unavailable" : "idle";
    errorMessage.value = closeError;
  }
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
  let roomConnectionInterrupted = false;
  let browserOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  let socketDisconnected = nextMeeting.meta.socketState?.state !== "connected";
  const syncMedia = (departedSourceIds: string[] = [], authoritative?: boolean) => {
    if (meeting.value !== nextMeeting) {
      return;
    }
    emitRoomMediaStreams(
      nextMeeting,
      !roomConnectionInterrupted && !browserOffline && !socketDisconnected &&
        (authoritative ?? isRealtimeKitSnapshotAuthoritative(nextMeeting.self, roomJoinedEventObserved)),
      departedSourceIds,
    );
  };
  const handleRoomJoined = () => {
    if (browserOffline || socketDisconnected || nextMeeting.self.roomJoined !== true) return;
    roomJoinedEventObserved = true;
    roomConnectionInterrupted = false;
    if (meeting.value === nextMeeting) {
      roomJoined.value = true;
      syncSelfMedia(nextMeeting);
    }
    syncMedia([], true);
  };
  const handleRoomLeft = () => {
    roomJoinedEventObserved = false;
    roomConnectionInterrupted = true;
    if (meeting.value === nextMeeting) {
      roomJoined.value = false;
      selfMediaStream.value = null;
    }
    syncMedia([], false);
  };
  const handleParticipantLeft = (participant: RealtimeKitParticipant) => {
    // Revoke before a peer can reappear in a coalesced map snapshot.
    const sourceIds = getRealtimeKitParticipantSourceIds(participant);
    if (sourceIds.length > 0) syncMedia(sourceIds);
    else handleConnectionLost();
  };
  const handleConnectionLost = () => {
    roomConnectionInterrupted = true;
    if (meeting.value === nextMeeting) {
      roomJoined.value = false;
      selfMediaStream.value = null;
    }
    syncMedia([], false);
  };
  const handleScreenShareUpdate = (
    participant: RealtimeKitParticipant,
    update?: { screenShareEnabled?: boolean },
  ) => {
    const enabled = update?.screenShareEnabled ?? participant.screenShareEnabled ?? participant.screenshareEnabled;
    if (enabled !== true) {
      const screenSourceId = getRealtimeKitParticipantSourceIds(participant)[1];
      if (screenSourceId) syncMedia([screenSourceId]);
      else handleConnectionLost();
      return;
    }
    syncMedia();
  };
  const handleSocketState = ({ state: socketState }: { state: string }) => {
    socketDisconnected = socketState !== "connected";
    if (socketDisconnected) handleConnectionLost();
  };
  const handleOffline = () => {
    browserOffline = true;
    // An online event alone does not prove the SDK signaling socket recovered.
    socketDisconnected = true;
    handleConnectionLost();
  };
  const handleOnline = () => { browserOffline = false; };

  const meetingSelf = nextMeeting.self;
  meetingSelf.on("roomJoined", handleRoomJoined);
  meetingSelf.on("roomLeft", handleRoomLeft);
  const syncSelf = () => syncSelfMedia(nextMeeting);
  meetingSelf.on("audioUpdate", syncSelf);
  meetingSelf.on("videoUpdate", syncSelf);
  nextMeeting.meta.on("socketConnectionUpdate", handleSocketState);
  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  removeRoomMediaListeners.push(() => {
    meetingSelf.off("roomJoined", handleRoomJoined);
    meetingSelf.off("roomLeft", handleRoomLeft);
    meetingSelf.off("audioUpdate", syncSelf);
    meetingSelf.off("videoUpdate", syncSelf);
    nextMeeting.meta.off("socketConnectionUpdate", handleSocketState);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  });

  const joinedParticipants = nextMeeting.participants.joined;
  const activeParticipants = nextMeeting.participants.active;
  // Leaving the subscribed/active map does not mean leaving the meeting.
  const handleActiveRemoved = () => syncMedia();
  joinedParticipants.on("participantLeft", handleParticipantLeft);
  joinedParticipants.on("participantsCleared", handleConnectionLost);
  activeParticipants.on("participantLeft", handleActiveRemoved);
  activeParticipants.on("participantsCleared", handleActiveRemoved);
  removeRoomMediaListeners.push(() => {
    joinedParticipants.off("participantLeft", handleParticipantLeft);
    joinedParticipants.off("participantsCleared", handleConnectionLost);
    activeParticipants.off("participantLeft", handleActiveRemoved);
    activeParticipants.off("participantsCleared", handleActiveRemoved);
  });

  for (const participantMap of [
    joinedParticipants,
    activeParticipants,
  ]) {
    participantMap.on("screenShareUpdate", handleScreenShareUpdate);
    removeRoomMediaListeners.push(() => {
      participantMap.off("screenShareUpdate", handleScreenShareUpdate);
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
  const mapping = authoritative
    ? mapRealtimeKitParticipantSources(getRemoteParticipants(nextMeeting))
    : { sources: [], streams: [] };
  emit("media-streams-change", {
    authoritative,
    departedSourceIds: roomSourceAuthority.update(
      authoritative,
      mapping.sources.map((source) => source.id),
      departedSourceIds,
    ),
    sources: mapping.sources,
    streams: new Map(
      mapping.streams.map(({ sourceId, tracks }) => [sourceId, new MediaStream(tracks)]),
    ),
  });
}

function emitRoomMediaLoss(): void {
  emit("media-streams-change", {
    authoritative: false,
    departedSourceIds: roomSourceAuthority.update(false, []),
    sources: [],
    streams: new Map(),
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
