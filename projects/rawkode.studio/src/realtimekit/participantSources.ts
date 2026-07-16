import type { StudioSource } from "../types";

export type RealtimeKitParticipantRole = "guest" | "host" | "producer" | "program";

export interface RealtimeKitScreenShareTracks {
  audio?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  video?: MediaStreamTrack | null;
  videoTrack?: MediaStreamTrack | null;
}

export interface RealtimeKitParticipant {
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

export interface RealtimeKitParticipantSourceMapping {
  sources: StudioSource[];
  streams: Array<{
    sourceId: string;
    tracks: MediaStreamTrack[];
  }>;
}

export function isRealtimeKitSnapshotAuthoritative(
  meetingSelf: { roomJoined?: boolean } | null | undefined,
  roomJoinedEventObserved: boolean,
): boolean {
  if (typeof meetingSelf?.roomJoined === "boolean") {
    return meetingSelf.roomJoined;
  }
  return roomJoinedEventObserved;
}

type SourceRole = "guest" | "host" | "producer";

export function mapRealtimeKitParticipantSources(
  participants: RealtimeKitParticipant[],
): RealtimeKitParticipantSourceMapping {
  const sources: StudioSource[] = [];
  const streams: RealtimeKitParticipantSourceMapping["streams"] = [];
  const roleIndexes: Record<SourceRole, number> = {
    guest: 0,
    host: 0,
    producer: 0,
  };

  for (const participant of getStableParticipants(participants)) {
    const identity = getRealtimeKitParticipantIdentity(participant);
    const role = getRealtimeKitParticipantRole(participant);
    const sourceRole = role === "program" ? "producer" : role;
    const roleIndex = roleIndexes[sourceRole];
    roleIndexes[sourceRole] += 1;

    const cameraTracks = getCameraTracks(participant);
    if (cameraTracks.length > 0) {
      const sourceId = getCameraSourceId(identity);
      sources.push(createCameraSource(sourceId, participant, role, roleIndex + 1));
      streams.push({ sourceId, tracks: cameraTracks });
    }

    const screenTracks = getScreenTracks(participant);
    if (screenTracks.length > 0) {
      const sourceId = `source-realtimekit-screen-${toSafeSourceSegment(identity)}`;
      sources.push(createScreenSource(sourceId, participant, role));
      streams.push({ sourceId, tracks: screenTracks });
    }
  }

  return { sources, streams };
}

export function getRealtimeKitParticipantIdentity(
  participant: RealtimeKitParticipant,
): string {
  return participant.customParticipantId?.trim() ||
    participant.userId?.trim() ||
    participant.id?.trim() ||
    participant.name?.trim() ||
    "anonymous-participant";
}

export function getRealtimeKitParticipantRole(
  participant: RealtimeKitParticipant,
): RealtimeKitParticipantRole {
  const roleFromCustomId = participant.customParticipantId
    ?.match(/^studio:(guest|host|producer|program):/)?.[1];
  if (isRealtimeKitParticipantRole(roleFromCustomId)) {
    return roleFromCustomId;
  }

  const preset = participant.presetName?.toLowerCase() ?? "";
  if (preset.includes("program")) return "program";
  if (preset.includes("producer")) return "producer";
  if (preset.includes("host")) return "host";
  return "guest";
}

function getStableParticipants(
  participants: RealtimeKitParticipant[],
): RealtimeKitParticipant[] {
  const participantsByIdentity = new Map<string, RealtimeKitParticipant>();
  for (const participant of participants) {
    participantsByIdentity.set(getRealtimeKitParticipantIdentity(participant), participant);
  }

  return [...participantsByIdentity.values()].sort((left, right) =>
    getRealtimeKitParticipantIdentity(left).localeCompare(
      getRealtimeKitParticipantIdentity(right),
    )
  );
}

function getCameraTracks(
  participant: RealtimeKitParticipant,
): MediaStreamTrack[] {
  const videoTrack = participant.videoEnabled === false
    ? undefined
    : getLiveTrack(participant.videoTrack);
  const audioTrack = participant.audioEnabled === false
    ? undefined
    : getLiveTrack(participant.audioTrack);
  return [videoTrack, audioTrack].filter(isLiveTrack);
}

function getScreenTracks(
  participant: RealtimeKitParticipant,
): MediaStreamTrack[] {
  if (!hasScreenShareEnabled(participant)) {
    return [];
  }

  return [
    getScreenShareTrack(participant, "video"),
    getScreenShareTrack(participant, "audio"),
  ].filter(isLiveTrack);
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
    return screenShareTracks.find((track) =>
      track.kind === kind && track.readyState === "live"
    );
  }

  const track = kind === "audio"
    ? screenShareTracks.audio ?? screenShareTracks.audioTrack
    : screenShareTracks.video ?? screenShareTracks.videoTrack;
  return getLiveTrack(track);
}

function hasScreenShareEnabled(participant: RealtimeKitParticipant): boolean {
  return participant.screenShareEnabled === true || participant.screenshareEnabled === true;
}

function getLiveTrack(
  track: MediaStreamTrack | null | undefined,
): MediaStreamTrack | undefined {
  return track?.readyState === "live" ? track : undefined;
}

function isLiveTrack(
  track: MediaStreamTrack | undefined,
): track is MediaStreamTrack {
  return track?.readyState === "live";
}

function getCameraSourceId(identity: string): string {
  return `source-realtimekit-camera-${toSafeSourceSegment(identity)}`;
}

function createCameraSource(
  sourceId: string,
  participant: RealtimeKitParticipant,
  role: RealtimeKitParticipantRole,
  slotNumber: number,
): StudioSource {
  const name = participant.name?.trim() || getFallbackSourceName(role, slotNumber);
  const videoTrack = participant.videoEnabled === false
    ? undefined
    : getLiveTrack(participant.videoTrack);
  return {
    id: sourceId,
    name,
    type: "camera",
    status: videoTrack ? "ready" : "muted",
    color: getSourceColor(role, slotNumber),
    label: name,
    roles: getSourceRoles(role),
    settings: {
      realtimeKitParticipantId: participant.id ?? getRealtimeKitParticipantIdentity(participant),
      realtimeKitRole: role,
      realtimeKitSource: "camera",
      runtimeSource: "realtimekit",
    },
  };
}

function createScreenSource(
  sourceId: string,
  participant: RealtimeKitParticipant,
  role: RealtimeKitParticipantRole,
): StudioSource {
  const participantName = participant.name?.trim() || getFallbackSourceName(role, 1);
  const videoTrack = getScreenShareTrack(participant, "video");
  return {
    id: sourceId,
    name: `${participantName} screen`,
    type: "screen",
    status: videoTrack ? "ready" : "muted",
    color: getSourceColor(role, 1),
    label: `${participantName} screen`,
    settings: {
      realtimeKitParticipantId: participant.id ?? getRealtimeKitParticipantIdentity(participant),
      realtimeKitRole: role,
      realtimeKitSource: "screen",
      runtimeSource: "realtimekit",
    },
  };
}

function getSourceRoles(
  role: RealtimeKitParticipantRole,
): StudioSource["roles"] {
  if (role === "host") return ["hosts"];
  if (role === "guest") return ["guests"];
  return ["producer"];
}

function getSourceColor(
  role: RealtimeKitParticipantRole,
  slotNumber: number,
): string {
  if (role === "host") return "#39d5c5";
  if (role === "guest") {
    return ["#ff9167", "#7688ff", "#d980fa", "#f6c85f"][(slotNumber - 1) % 4] ??
      "#ff9167";
  }
  return "#ffb26f";
}

function getFallbackSourceName(
  role: RealtimeKitParticipantRole,
  slotNumber: number,
): string {
  if (role === "host") return "Host";
  if (role === "guest") return slotNumber > 1 ? `Guest ${slotNumber}` : "Guest";
  return role === "program" ? "Program" : "Producer";
}

function toSafeSourceSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") ||
    "participant";
}

function isRealtimeKitParticipantRole(
  role: string | undefined,
): role is RealtimeKitParticipantRole {
  return role === "guest" || role === "host" || role === "producer" || role === "program";
}
