import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import EgressHelper from "@livekit/egress-sdk";
import { type RemoteTrackPublication, RoomEvent, Track } from "livekit-client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "@/styles/global.css";
import { GridRecordingTemplate } from "./layouts/GridRecordingTemplate";
import { InterviewRecordingTemplate } from "./layouts/InterviewRecordingTemplate";
import { PanelRecordingTemplate } from "./layouts/PanelRecordingTemplate";
import { PictureInPictureRecordingTemplate } from "./layouts/PictureInPictureRecordingTemplate";
import { PresentationRecordingTemplate } from "./layouts/PresentationRecordingTemplate";
import { SideBySideRecordingTemplate } from "./layouts/SideBySideRecordingTemplate";
import { SingleSpeakerRecordingTemplate } from "./layouts/SingleSpeakerRecordingTemplate";

const FRAME_DECODE_TIMEOUT = 5000; // 5 seconds max wait time
const EMPTY_ROOM_TIMEOUT = 30000; // 30 seconds for empty room
const AUDIO_ONLY_DELAY = 500; // 500ms delay for audio-only rooms

// Type for video track with getRTCStatsReport method
interface VideoTrackWithStats {
  getRTCStatsReport(): Promise<RTCStatsReport>;
}

// Helper to check if a video track has decoded frames
async function hasDecodedFrames(
  publication: RemoteTrackPublication,
): Promise<boolean> {
  if (publication.kind !== Track.Kind.Video || !publication.track) {
    return false;
  }

  try {
    // Check if the track has the getRTCStatsReport method
    const videoTrack = publication.track as VideoTrackWithStats;
    if (!videoTrack.getRTCStatsReport) {
      return false;
    }

    const stats = await videoTrack.getRTCStatsReport();
    if (!stats) return false;

    for (const [, stat] of stats) {
      if (stat.type === "inbound-rtp" && stat.framesDecoded > 0) {
        return true;
      }
    }
  } catch (error) {
    console.warn("Failed to get RTC stats:", error);
  }

  return false;
}

function RoomStartSignal() {
  const room = useRoomContext();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasStartedRecording = useRef(false);

  // Set the room in EgressHelper when available
  useEffect(() => {
    if (room) {
      EgressHelper.setRoom(room);
    }
  }, [room]);

  const checkAndStartRecording = useCallback(async () => {
    if (!room || hasStartedRecording.current) return;

    let hasVideoTracks = false;
    let hasSubscribedTracks = false;
    let hasDecodedVideoFrames = false;

    // Analyze all remote participants
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.isSubscribed) {
          hasSubscribedTracks = true;

          if (publication.kind === Track.Kind.Video) {
            hasVideoTracks = true;
            const decoded = await hasDecodedFrames(publication);
            if (decoded) {
              hasDecodedVideoFrames = true;
              break;
            }
          }
        }
      }
      if (hasDecodedVideoFrames) break;
    }

    const timeDelta = Date.now() - startTimeRef.current;
    let shouldStartRecording = false;
    let reason = "";

    // Decision logic for when to start recording
    if (hasDecodedVideoFrames) {
      shouldStartRecording = true;
      reason = "video frames decoded";
    } else if (
      !hasVideoTracks &&
      hasSubscribedTracks &&
      timeDelta > AUDIO_ONLY_DELAY
    ) {
      shouldStartRecording = true;
      reason = "audio-only room";
    } else if (timeDelta > FRAME_DECODE_TIMEOUT && hasSubscribedTracks) {
      shouldStartRecording = true;
      reason = "timeout reached with subscribed tracks";
    } else if (
      timeDelta > EMPTY_ROOM_TIMEOUT &&
      room.remoteParticipants.size === 0
    ) {
      shouldStartRecording = true;
      reason = "empty room timeout";
    }

    if (shouldStartRecording && !hasStartedRecording.current) {
      hasStartedRecording.current = true;
      console.log(`Starting recording: ${reason}`);
      EgressHelper.startRecording();

      // Clean up the interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [room]);

  const startMonitoring = useCallback(() => {
    if (intervalRef.current) return; // Already monitoring

    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(checkAndStartRecording, 100);
  }, [checkAndStartRecording]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      console.log("Room connected, starting recording monitor");
      startMonitoring();
    };

    if (room.state === "connected") {
      handleConnected();
    } else {
      room.on(RoomEvent.Connected, handleConnected);
    }

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      stopMonitoring();
    };
  }, [room, startMonitoring, stopMonitoring]);

  return null;
}

function LayoutContent({ layout }: { layout: string }) {
  switch (layout) {
    case "grid":
      return <GridRecordingTemplate />;
    case "single-speaker":
      return <SingleSpeakerRecordingTemplate />;
    case "side-by-side":
      return <SideBySideRecordingTemplate />;
    case "picture-in-picture":
      return <PictureInPictureRecordingTemplate />;
    case "presentation":
      return <PresentationRecordingTemplate />;
    case "interview":
      return <InterviewRecordingTemplate />;
    case "panel":
      return <PanelRecordingTemplate />;
    default:
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
          <p>Unknown layout: {layout}</p>
        </div>
      );
  }
}

interface RoomContentProps {
  layout: string;
  error?: Error;
}

function RoomContent({ layout, error }: RoomContentProps) {
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-red-900 text-white">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">Recording Error</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <RoomStartSignal />
      <div className="h-screen w-screen bg-gray-950">
        <LayoutContent layout={layout} />
      </div>
      <RoomAudioRenderer />
    </React.Fragment>
  );
}

export function RecordingTemplateWrapper() {
  const [error, setError] = useState<Error>();

  // Get parameters from URL using the official SDK
  const url = EgressHelper.getLiveKitURL();
  const token = EgressHelper.getAccessToken();
  const layout = EgressHelper.getLayout() || "grid";

  // Listen for layout changes
  useEffect(() => {
    EgressHelper.onLayoutChanged((newLayout: string) => {
      console.log(`Layout changed to: ${newLayout}`);
      // In this implementation, we handle layout changes through re-renders
      // The layout is fetched fresh from EgressHelper on each render
    });
  }, []);

  if (!url || !token) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">
            Missing Connection Parameters
          </p>
          <p className="text-sm">URL and token are required for recording</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={url}
      token={token}
      onError={setError}
      className="h-screen w-screen"
    >
      <RoomContent layout={layout} error={error} />
    </LiveKitRoom>
  );
}
