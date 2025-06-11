import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import type { LayoutProps } from "./types";

export function SideBySideLayout({
  cameraTrackReferences,
  screenShareTrack,
  presenter,
}: LayoutProps) {
  // In side-by-side layout, only show presenter cameras
  const presenterCameraTracks = presenter
    ? cameraTrackReferences.filter(
        (track) => track.participant.identity === presenter,
      )
    : cameraTrackReferences;

  const tracks = screenShareTrack
    ? [screenShareTrack, presenterCameraTracks[0]].filter(Boolean)
    : presenterCameraTracks.slice(0, 2);

  const containerRef = useRef<HTMLDivElement>(null);
  const [tileDimensions, setTileDimensions] = useState({
    width: 640,
    height: 360,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 32;
      const gap = 16;
      const cols = 2;

      // Calculate available space for each tile
      const availableWidth =
        (clientWidth - padding * 2 - gap * (cols - 1)) / cols;
      const availableHeight = clientHeight - padding * 2;

      // 16:9 aspect ratio
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
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center"
    >
      <div className="flex gap-4">
        {tracks.map((track, index) => (
          <div
            key={track?.publication?.trackSid || index}
            className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
            style={{
              width: `${tileDimensions.width}px`,
              height: `${tileDimensions.height}px`,
            }}
          >
            {track && (
              <ParticipantTile
                trackRef={track}
                disableSpeakingIndicator={true}
                className="w-full h-full"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
