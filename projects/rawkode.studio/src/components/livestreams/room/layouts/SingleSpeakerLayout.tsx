import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "./EmptyState";
import type { LayoutProps } from "./types";

export function SingleSpeakerLayout({
  cameraTrackReferences,
  screenShareTrack,
  presenter,
}: LayoutProps) {
  // In single speaker layout, only show presenter cameras
  const presenterCameraTracks = presenter
    ? cameraTrackReferences.filter(
        (track) => track.participant.identity === presenter,
      )
    : cameraTrackReferences;

  const primaryTrack = screenShareTrack || presenterCameraTracks[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [tileDimensions, setTileDimensions] = useState({
    width: 640,
    height: 360,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;

      // For screen share, use full width with minimal padding
      if (screenShareTrack) {
        const padding = 16;
        const availableWidth = clientWidth - padding * 2;
        const aspectRatio = 16 / 9;
        const calculatedHeight = availableWidth / aspectRatio;

        // Use full width but maintain 16:9 aspect ratio
        setTileDimensions({
          width: availableWidth,
          height: Math.min(calculatedHeight, clientHeight),
        });
      } else {
        // For camera, maintain 16:9 aspect ratio
        const padding = 32;
        const availableWidth = clientWidth - padding * 2;
        const availableHeight = clientHeight - padding * 2;

        const aspectRatio = 16 / 9;
        const tileWidthByHeight = availableHeight * aspectRatio;
        const tileHeightByWidth = availableWidth / aspectRatio;

        if (tileWidthByHeight <= availableWidth) {
          // Height-constrained
          setTileDimensions({
            width: tileWidthByHeight,
            height: availableHeight,
          });
        } else {
          // Width-constrained
          setTileDimensions({
            width: availableWidth,
            height: tileHeightByWidth,
          });
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [screenShareTrack]);

  if (!primaryTrack) {
    return <EmptyState />;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center"
    >
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
        style={{
          width: `${tileDimensions.width}px`,
          height: `${tileDimensions.height}px`,
        }}
      >
        <ParticipantTile
          trackRef={primaryTrack}
          disableSpeakingIndicator={true}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
