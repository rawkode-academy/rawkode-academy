import type { StudioSource } from "../types";
import { sha256 } from "@noble/hashes/sha2.js";

export type RealtimeKitParticipantRole = "guest" | "host" | "producer" | "program";

export interface RealtimeKitScreenShareTracks {
  audio?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
  video?: MediaStreamTrack | null;
  videoTrack?: MediaStreamTrack | null;
}

export interface RealtimeKitProducerState {
  producerId?: string | null;
  producingPeerId?: string | null;
  producingTransportId?: string | null;
  kind?: string;
  pause?: boolean;
  screenShare?: boolean;
  consumer?: {
    id?: string | null;
    producerId?: string | null;
    peerId?: string | null;
    kind?: string;
    paused?: boolean;
    appData?: Record<string, unknown>;
    rtpReceiver?: { track?: MediaStreamTrack | null } | null;
  } | null;
}

export interface RealtimeKitParticipant {
  audioEnabled?: boolean;
  audioTrack?: MediaStreamTrack | null;
  customParticipantId?: string | null;
  id?: string | null;
  name?: string | null;
  presetName?: string | null;
  producers?: RealtimeKitProducerState[] | null;
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

/** Track every source seen while room membership is authoritative. */
export function createRealtimeKitSourceAuthority() {
  const observedSourceIds = new Set<string>();

  return {
    update(authoritative: boolean, sourceIds: readonly string[], departures: readonly string[] = []): string[] {
      const revoked = new Set(departures);
      if (authoritative) {
        for (const id of sourceIds) observedSourceIds.add(id);
      } else {
        for (const id of observedSourceIds) revoked.add(id);
        observedSourceIds.clear();
      }
      return [...revoked];
    },
  };
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

// Control-state source and layer IDs are limited to 256 characters. Leave
// room for the scene prefix added when a camera layer is compiled.
const MAXIMUM_SOURCE_ID_LENGTH = 240;
const CAMERA_SOURCE_PREFIX = "source-realtimekit-camera-v2.";
const SCREEN_SOURCE_PREFIX = "source-realtimekit-screen-v2.";
const SCREEN_PUBLICATION_PREFIX = "source-realtimekit-screen-v3.";

export function mapRealtimeKitParticipantSources(
  participants: RealtimeKitParticipant[],
  sessionId?: string,
  joinedParticipants: RealtimeKitParticipant[] = participants,
): RealtimeKitParticipantSourceMapping {
  const sources: StudioSource[] = [];
  const streams: RealtimeKitParticipantSourceMapping["streams"] = [];
  const roleIndexes: Record<SourceRole, number> = {
    guest: 0,
    host: 0,
    producer: 0,
  };
  // Only the joined map establishes publication membership. Active-map media
  // subscription varies independently in each producer tab.
  const joinedByIdentity = new Map<string, RealtimeKitParticipant>();
  const ambiguousJoined = new Set<string>();
  for (const joined of joinedParticipants) {
    const identity = getRealtimeKitParticipantIdentity(joined);
    if (!identity) continue;
    const existing = joinedByIdentity.get(identity);
    if (existing && existing !== joined) ambiguousJoined.add(identity);
    else joinedByIdentity.set(identity, joined);
  }

  for (const participant of getStableParticipants(participants)) {
    const identity = getRealtimeKitParticipantIdentity(participant);
    if (identity === undefined) continue;
    const [cameraSourceId] = getRealtimeKitParticipantSourceIds(participant);
    if (!cameraSourceId) continue;
    const role = getRealtimeKitParticipantRole(participant);
    const sourceRole = role === "program" ? "producer" : role;
    const roleIndex = roleIndexes[sourceRole];
    roleIndexes[sourceRole] += 1;

    const cameraTracks = getCameraTracks(participant);
    // Membership is shared state; track subscription is local to this tab.
    // A standby waiting for tracks must not remove an admitted peer.
    sources.push(createCameraSource(cameraSourceId, participant, role, roleIndex + 1));
    if (cameraTracks.length > 0) {
      streams.push({ sourceId: cameraSourceId, tracks: cameraTracks });
    }

    const joined = ambiguousJoined.has(identity) ? undefined : joinedByIdentity.get(identity);
    const publication = joined && getScreenPublication(joined, sessionId);
    if (joined && publication) {
      sources.push(createScreenSource(publication.id, joined, role, publication.producer));
      const videoTrack = getBoundScreenVideoTrack(joined, publication.producer);
      if (videoTrack) streams.push({ sourceId: publication.id, tracks: [videoTrack] });
    }
  }

  return { sources, streams };
}

export function getRealtimeKitParticipantIdentity(
  participant: RealtimeKitParticipant,
): string | undefined {
  // RealtimeKit's peer ID is unique per connection. Its user/custom IDs can
  // be shared by multiple peers and names are not identities.
  return typeof participant.id === "string" && participant.id.trim()
    ? participant.id
    : undefined;
}

/**
 * A departure revokes both possible programme sources for this peer. Track IDs
 * are deliberately not used: switching a device is not a room departure.
 */
export function getRealtimeKitParticipantSourceIds(participant: RealtimeKitParticipant): string[] {
  const identity = getRealtimeKitParticipantIdentity(participant);
  if (identity === undefined) return [];
  const encoded = encodePeerIdentity(identity);
  if (encoded === undefined) return [];
  return [
    `${CAMERA_SOURCE_PREFIX}${encoded}`,
    `${SCREEN_SOURCE_PREFIX}${encoded}`,
  ];
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
  const ambiguousIdentities = new Set<string>();
  for (const participant of participants) {
    const identity = getRealtimeKitParticipantIdentity(participant);
    if (identity === undefined || getRealtimeKitParticipantSourceIds(participant).length === 0) continue;
    const existing = participantsByIdentity.get(identity);
    if (existing && (
      conflictingIdentityField(existing.userId, participant.userId) ||
      conflictingIdentityField(existing.customParticipantId, participant.customParticipantId)
    )) {
      ambiguousIdentities.add(identity);
      continue;
    }
    participantsByIdentity.set(identity, participant);
  }

  return [...participantsByIdentity.entries()]
    .filter(([identity]) => !ambiguousIdentities.has(identity))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, participant]) => participant);
}

function conflictingIdentityField(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left !== right);
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

function getScreenPublication(
  participant: RealtimeKitParticipant,
  sessionId: string | undefined,
): { id: string; producer: RealtimeKitProducerState } | undefined {
  const peerId = getRealtimeKitParticipantIdentity(participant);
  const producers = participant.producers;
  if (!peerId || !isValidIdentity(sessionId) || !Array.isArray(producers)) return undefined;
  // Unknown producer classifications could hide another screen publication.
  if (producers.some((producer) =>
    !producer || (producer.kind !== "audio" && producer.kind !== "video") ||
    typeof producer.screenShare !== "boolean"
  )) return undefined;
  const screens = producers.filter((producer) => producer.kind === "video" && producer.screenShare === true);
  if (screens.length !== 1) return undefined;
  const producer = screens[0];
  if (producer.pause !== false || producer.producingPeerId !== peerId ||
      !isValidIdentity(producer.producerId) || !isValidIdentity(producer.producingTransportId)) return undefined;
  const encoded = encodeIdentityTuple([sessionId, peerId, producer.producingTransportId, producer.producerId]);
  if (!encoded || SCREEN_PUBLICATION_PREFIX.length + encoded.length > MAXIMUM_SOURCE_ID_LENGTH) return undefined;
  return { id: `${SCREEN_PUBLICATION_PREFIX}${encoded}`, producer };
}

function getBoundScreenVideoTrack(
  participant: RealtimeKitParticipant,
  producer: RealtimeKitProducerState,
): MediaStreamTrack | undefined {
  if (participant.screenShareEnabled !== true || participant.screenshareEnabled === false) return undefined;
  const shares = participant.screenShareTracks;
  if (!shares) return undefined;
  let video: MediaStreamTrack | null | undefined;
  if (Array.isArray(shares)) {
    const videoTracks = shares.filter((track) => track.kind === "video");
    if (videoTracks.length !== 1) return undefined;
    video = videoTracks[0];
  } else {
    if (shares.video && shares.videoTrack && shares.video !== shares.videoTrack) return undefined;
    video = shares.video ?? shares.videoTrack;
  }
  const consumer = producer.consumer;
  if (!video || video.kind !== "video" || video.readyState !== "live" || video.enabled === false || video.muted === true ||
      !consumer || !isValidIdentity(consumer.id) || consumer.kind !== "video" ||
      consumer.producerId !== producer.producerId ||
      consumer.peerId !== producer.producingPeerId || consumer.paused !== false ||
      consumer.appData?.screenShare !== true || consumer.rtpReceiver?.track !== video) return undefined;
  return video;
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

function createCameraSource(
  sourceId: string,
  participant: RealtimeKitParticipant,
  role: RealtimeKitParticipantRole,
  slotNumber: number,
): StudioSource {
  const name = participant.name?.trim() || getFallbackSourceName(role, slotNumber);
  return {
    id: sourceId,
    name,
    type: "camera",
    status: participant.videoEnabled === true ? "ready" : "muted",
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
  producer: RealtimeKitProducerState,
): StudioSource {
  const participantName = participant.name?.trim() || getFallbackSourceName(role, 1);
  return {
    id: sourceId,
    name: `${participantName} screen`,
    type: "screen",
    status: "ready",
    color: getSourceColor(role, 1),
    label: `${participantName} screen`,
    settings: {
      realtimeKitParticipantId: participant.id ?? getRealtimeKitParticipantIdentity(participant),
      realtimeKitRole: role,
      realtimeKitSource: "screen",
      realtimeKitScreenProducerId: producer.producerId,
      realtimeKitScreenTransportId: producer.producingTransportId,
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

function encodePeerIdentity(value: string): string | undefined {
  try {
    // TextEncoder replaces unpaired surrogates; reject them instead of
    // allowing two different malformed identities to alias.
    encodeURIComponent(value);
    const bytes = new TextEncoder().encode(value);
    if (bytes.length > MAXIMUM_SOURCE_ID_LENGTH) return undefined;
    const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    if (Math.max(CAMERA_SOURCE_PREFIX.length, SCREEN_SOURCE_PREFIX.length) + encoded.length > MAXIMUM_SOURCE_ID_LENGTH) {
      return undefined;
    }
    // The period cannot occur in the legacy sanitized suffix, so an old
    // source's admission or mix never transfers to this namespace.
    return encoded;
  } catch {
    return undefined;
  }
}

function isValidIdentity(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

function encodeIdentityTuple(values: readonly string[]): string | undefined {
  if (!values.every(isValidIdentity)) return undefined;
  // JSON preserves tuple boundaries, while a full SHA-256 digest keeps the
  // source ID bounded even when a valid Studio session has a long show slug.
  const digest = sha256(new TextEncoder().encode(JSON.stringify(values)));
  return btoa(Array.from(digest, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isRealtimeKitParticipantRole(
  role: string | undefined,
): role is RealtimeKitParticipantRole {
  return role === "guest" || role === "host" || role === "producer" || role === "program";
}
