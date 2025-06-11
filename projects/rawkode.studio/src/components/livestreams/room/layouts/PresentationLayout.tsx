import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { GridLayout } from "./GridLayout";
import type { LayoutProps } from "./types";

export function PresentationLayout({
  cameraTrackReferences,
  screenShareTrack,
}: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mainTileDimensions, setMainTileDimensions] = useState({
    width: 640,
    height: 360,
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 32;
      const availableWidth = clientWidth - padding * 2;
      const availableHeight = clientHeight - padding * 2;

      // 16:9 aspect ratio
      const aspectRatio = 16 / 9;
      const tileWidthByHeight = availableHeight * aspectRatio;
      const tileHeightByWidth = availableWidth / aspectRatio;

      if (tileWidthByHeight <= availableWidth) {
        // Height-constrained
        setMainTileDimensions({
          width: tileWidthByHeight,
          height: availableHeight,
        });
      } else {
        // Width-constrained
        setMainTileDimensions({
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

  if (!screenShareTrack) {
    // Fallback to grid if no screen share
    return <GridLayout cameraTrackReferences={cameraTrackReferences} />;
  }

  // Calculate sidebar tile dimensions (16:9 aspect ratio)
  const sidebarTileWidth = 240;
  const sidebarTileHeight = sidebarTileWidth / (16 / 9);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black relative"
    >
      {/* Main screen share centered with proper aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 bg-gray-900"
          style={{
            width: `${mainTileDimensions.width}px`,
            height: `${mainTileDimensions.height}px`,
          }}
        >
          <ParticipantTile
            trackRef={screenShareTrack}
            disableSpeakingIndicator={true}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Floating participant videos in a vertical column on the right */}
      <div className="absolute top-6 right-6 max-h-[calc(100%-3rem)] overflow-y-auto space-y-3 z-10 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {cameraTrackReferences.map((track) => (
          <div
            key={track.publication?.trackSid}
            className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
            style={{
              width: `${sidebarTileWidth}px`,
              height: `${sidebarTileHeight}px`,
            }}
          >
            <ParticipantTile
              trackRef={track}
              disableSpeakingIndicator={true}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
