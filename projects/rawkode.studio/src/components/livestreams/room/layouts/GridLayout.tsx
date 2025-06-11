import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import type { LayoutProps } from "./types";

interface GridDimensions {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

function calculateOptimalGrid(
  containerWidth: number,
  containerHeight: number,
  participantCount: number,
  gap = 16,
): GridDimensions {
  // 16:9 aspect ratio
  const aspectRatio = 16 / 9;

  let bestLayout = {
    cols: 1,
    rows: 1,
    tileWidth: 0,
    tileHeight: 0,
    area: 0,
  };

  // Try different column configurations
  for (let cols = 1; cols <= participantCount; cols++) {
    const rows = Math.ceil(participantCount / cols);

    // Calculate available space for each tile
    const availableWidth = containerWidth - gap * (cols - 1);
    const availableHeight = containerHeight - gap * (rows - 1);

    // Calculate tile dimensions maintaining aspect ratio
    const tileWidthByWidth = availableWidth / cols;
    const tileHeightByWidth = tileWidthByWidth / aspectRatio;

    const tileHeightByHeight = availableHeight / rows;
    const tileWidthByHeight = tileHeightByHeight * aspectRatio;

    // Use the smaller dimension to ensure tiles fit
    let tileWidth: number;
    let tileHeight: number;

    if (tileHeightByWidth * rows <= availableHeight) {
      // Width-constrained
      tileWidth = tileWidthByWidth;
      tileHeight = tileHeightByWidth;
    } else {
      // Height-constrained
      tileWidth = tileWidthByHeight;
      tileHeight = tileHeightByHeight;
    }

    // Calculate the area used by a single tile
    const area = tileWidth * tileHeight;

    // Keep the layout that maximizes tile size
    if (area > bestLayout.area) {
      bestLayout = {
        cols,
        rows,
        tileWidth,
        tileHeight,
        area,
      };
    }
  }

  return {
    cols: bestLayout.cols,
    rows: bestLayout.rows,
    tileWidth: bestLayout.tileWidth,
    tileHeight: bestLayout.tileHeight,
  };
}

export function GridLayout({ cameraTrackReferences }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridDimensions, setGridDimensions] = useState<GridDimensions>({
    cols: 1,
    rows: 1,
    tileWidth: 640,
    tileHeight: 360,
  });

  useEffect(() => {
    const updateGrid = () => {
      if (!containerRef.current) return;

      const { clientWidth, clientHeight } = containerRef.current;
      // Add padding around the edges (32px on each side)
      const padding = 32;
      const dimensions = calculateOptimalGrid(
        clientWidth - padding * 2,
        clientHeight - padding * 2,
        cameraTrackReferences.length,
      );
      setGridDimensions(dimensions);
    };

    updateGrid();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateGrid);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [cameraTrackReferences.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center"
    >
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${gridDimensions.cols}, ${gridDimensions.tileWidth}px)`,
          gridTemplateRows: `repeat(${gridDimensions.rows}, ${gridDimensions.tileHeight}px)`,
        }}
      >
        {cameraTrackReferences.map((track) => (
          <div
            key={track.publication?.trackSid}
            className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
            style={{
              width: `${gridDimensions.tileWidth}px`,
              height: `${gridDimensions.tileHeight}px`,
            }}
          >
            <ParticipantTile
              trackRef={track}
              disableSpeakingIndicator={true}
              className="w-full h-full [&_.lk-participant-tile]:rounded-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
