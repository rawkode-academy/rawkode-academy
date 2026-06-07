<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { StudioSource } from "../types";

type StudioRole = "guest" | "host" | "producer" | "program";
type RoomState = "connected" | "connecting" | "idle" | "unavailable";
type SourceSlotRole = "guest" | "host" | "producer";

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
  participants?: {
    active?: RealtimeKitParticipantMap;
    joined?: RealtimeKitParticipantMap;
  };
}

interface RealtimeKitParticipant {
  audioEnabled?: boolean;
  audioTrack?: MediaStreamTrack | null;
  customParticipantId?: string | null;
  id?: string | null;
  name?: string | null;
  presetName?: string | null;
  screenShareTracks?: RealtimeKitScreenShareTracks | MediaStreamTrack[] | null;
  screenshareEnabled?: boolean;
  screenShareEnabled?: boolean;
  userId?: string | null;
  videoEnabled?: boolean;
  videoTrack?: MediaStreamTrack | null;
}

interface RealtimeKitParticipantMap {
  forEach?: (callback: (participant: RealtimeKitParticipant) => void) => void;
  off?: (event: string, listener: RealtimeKitParticipantListener) => void;
  on?: (event: string, listener: RealtimeKitParticipantListener) => void;
  removeListener?: (event: string, listener: RealtimeKitParticipantListener) => void;
  toArray?: () => RealtimeKitParticipant[];
  values?: () => IterableIterator<RealtimeKitParticipant>;
  [Symbol.iterator]?: () => IterableIterator<[string, RealtimeKitParticipant]>;
}

interface RealtimeKitScreenShareTracks {
  audio?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  video?: MediaStreamTrack | null;
  videoTrack?: MediaStreamTrack | null;
}

const props = defineProps<{
  inviteToken?: string;
  role: StudioRole;
  sessionId: string;
}>();

const emit = defineEmits<{
  "media-streams-change": [payload: {
    sources: StudioSource[];
    streams: Map<string, MediaStream>;
  }];
}>();

const meetingElement = ref<HTMLElement | null>(null);
const state = ref<RoomState>("idle");
const errorMessage = ref("");
const meeting = ref<RealtimeKitMeeting | null>(null);
let uiKitLoaded: Promise<void> | undefined;
let clientLoaded: Promise<void> | undefined;
type RealtimeKitParticipantListener = (...args: unknown[]) => void;
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
    watchRoomMedia(nextMeeting);
    emitRoomMediaStreams(nextMeeting);
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
  stopWatchingRoomMedia();

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
  emit("media-streams-change", {
    sources: [],
    streams: new Map(),
  });
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

function watchRoomMedia(nextMeeting: RealtimeKitMeeting): void {
  stopWatchingRoomMedia();
  const syncMedia = () => emitRoomMediaStreams(nextMeeting);
  for (const participantMap of [
    nextMeeting.participants?.joined,
    nextMeeting.participants?.active,
  ]) {
    if (!participantMap?.on) {
      continue;
    }
    for (const event of roomMediaEvents) {
      participantMap.on(event, syncMedia);
      removeRoomMediaListeners.push(() => {
        if (participantMap.off) {
          participantMap.off(event, syncMedia);
        } else {
          participantMap.removeListener?.(event, syncMedia);
        }
      });
    }
  }
}

function stopWatchingRoomMedia(): void {
  for (const removeListener of removeRoomMediaListeners) {
    removeListener();
  }
  removeRoomMediaListeners = [];
}

function emitRoomMediaStreams(nextMeeting: RealtimeKitMeeting): void {
  const participants = getRemoteParticipants(nextMeeting);
  const streams = new Map<string, MediaStream>();
  const sources: StudioSource[] = [];
  const slotIndexes: Record<SourceSlotRole, number> = {
    guest: 0,
    host: 0,
    producer: 0,
  };

  for (const participant of participants) {
    const stream = createParticipantMediaStream(participant);
    if (!stream) {
      continue;
    }

    const role = getParticipantRole(participant);
    const slotRole = getSourceSlotRole(role);
    const slotIndex = slotIndexes[slotRole];
    slotIndexes[slotRole] += 1;
    const sourceId = getParticipantSourceId(slotRole, slotIndex);
    if (!sourceId) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        streams.set(`source-realtimekit-audio-${getSafeParticipantId(participant)}`, new MediaStream(audioTracks));
      }
      continue;
    }

    streams.set(sourceId, stream);
    sources.push(createParticipantSource(sourceId, participant, role, slotIndex + 1));
  }

  emit("media-streams-change", { sources, streams });
}

function getRemoteParticipants(nextMeeting: RealtimeKitMeeting): RealtimeKitParticipant[] {
  const participantsById = new Map<string, RealtimeKitParticipant>();
  for (const participantMap of [
    nextMeeting.participants?.active,
    nextMeeting.participants?.joined,
  ]) {
    for (const participant of participantMapToArray(participantMap)) {
      if (!createParticipantMediaStream(participant)) {
        continue;
      }
      participantsById.set(getParticipantId(participant), participant);
    }
  }
  return [...participantsById.values()];
}

function participantMapToArray(
  participantMap: RealtimeKitParticipantMap | undefined,
): RealtimeKitParticipant[] {
  if (!participantMap) {
    return [];
  }
  if (participantMap.toArray) {
    return participantMap.toArray();
  }
  if (participantMap.values) {
    return [...participantMap.values()];
  }
  if (participantMap[Symbol.iterator]) {
    return [...participantMap].map(([, participant]) => participant);
  }
  const participants: RealtimeKitParticipant[] = [];
  participantMap.forEach?.((participant) => participants.push(participant));
  return participants;
}

function createParticipantMediaStream(participant: RealtimeKitParticipant): MediaStream | undefined {
  const audioTrack = participant.audioEnabled === false
    ? undefined
    : getLiveTrack(participant.audioTrack);
  const screenShareAudioTrack = hasScreenShareEnabled(participant)
    ? getScreenShareTrack(participant, "audio")
    : undefined;
  const videoTrack = participant.videoEnabled === false
    ? undefined
    : getLiveTrack(participant.videoTrack) ?? (
        hasScreenShareEnabled(participant)
          ? getScreenShareTrack(participant, "video")
          : undefined
      );
  const tracks = [videoTrack, audioTrack, screenShareAudioTrack].filter(isLiveTrack);
  return tracks.length > 0 ? new MediaStream(tracks) : undefined;
}

function getScreenShareTrack(
  participant: RealtimeKitParticipant,
  kind: MediaStreamTrack["kind"],
): MediaStreamTrack | undefined {
  const screenShareTracks = participant.screenShareTracks;
  if (!screenShareTracks) {
    return undefined;
  }
  if (Array.isArray(screenShareTracks)) {
    return screenShareTracks.find((track) => track.kind === kind && track.readyState === "live");
  }
  const track = kind === "audio"
    ? screenShareTracks.audio ?? screenShareTracks.audioTrack
    : screenShareTracks.video ?? screenShareTracks.videoTrack;
  return getLiveTrack(track);
}

function hasScreenShareEnabled(participant: RealtimeKitParticipant): boolean {
  return participant.screenShareEnabled === true || participant.screenshareEnabled === true;
}

function getLiveTrack(track: MediaStreamTrack | null | undefined): MediaStreamTrack | undefined {
  return track?.readyState === "live" ? track : undefined;
}

function isLiveTrack(track: MediaStreamTrack | undefined): track is MediaStreamTrack {
  return track?.readyState === "live";
}

function getParticipantId(participant: RealtimeKitParticipant): string {
  return participant.customParticipantId ?? participant.userId ?? participant.id ?? participant.name ?? "participant";
}

function getSafeParticipantId(participant: RealtimeKitParticipant): string {
  return getParticipantId(participant).replace(/[^A-Za-z0-9_-]+/g, "-");
}

function getParticipantRole(participant: RealtimeKitParticipant): StudioRole {
  const roleFromCustomId = participant.customParticipantId?.match(/^studio:(guest|host|producer|program):/)?.[1];
  if (isStudioRole(roleFromCustomId)) {
    return roleFromCustomId;
  }

  const preset = participant.presetName?.toLowerCase() ?? "";
  if (preset.includes("program")) return "program";
  if (preset.includes("producer")) return "producer";
  if (preset.includes("host")) return "host";
  return "guest";
}

function isStudioRole(role: string | undefined): role is StudioRole {
  return role === "guest" || role === "host" || role === "producer" || role === "program";
}

function getSourceSlotRole(role: StudioRole): SourceSlotRole {
  return role === "program" ? "producer" : role;
}

function getParticipantSourceId(role: SourceSlotRole, index: number): string | undefined {
  if (role === "host") {
    return index === 0 ? "source-host-camera" : undefined;
  }
  if (role === "producer") {
    return index === 0 ? "source-producer-camera" : undefined;
  }
  return ["source-guest-camera", "source-second-guest-camera"][index];
}

function createParticipantSource(
  sourceId: string,
  participant: RealtimeKitParticipant,
  role: StudioRole,
  slotNumber: number,
): StudioSource {
  const name = participant.name?.trim() || getFallbackSourceName(role, slotNumber);
  return {
    id: sourceId,
    name,
    type: "camera",
    status: participant.videoEnabled === false ? "muted" : "ready",
    color: getSourceColor(role, slotNumber),
    label: name,
    roles: getSourceRoles(role),
    settings: {
      realtimeKitParticipantId: participant.id ?? participant.customParticipantId ?? getParticipantId(participant),
      realtimeKitRole: role,
    },
  };
}

function getSourceRoles(role: StudioRole): StudioSource["roles"] {
  if (role === "host") return ["hosts"];
  if (role === "guest") return ["guests"];
  return ["producer"];
}

function getSourceColor(role: StudioRole, slotNumber: number): string {
  if (role === "host") return "#39d5c5";
  if (role === "guest") return ["#ff9167", "#7688ff"][slotNumber - 1] ?? "#ff9167";
  return "#ffb26f";
}

function getFallbackSourceName(role: StudioRole, slotNumber: number): string {
  if (role === "host") return "Host";
  if (role === "guest") return slotNumber > 1 ? `Guest ${slotNumber}` : "Guest";
  return role === "program" ? "Program" : "Producer";
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
