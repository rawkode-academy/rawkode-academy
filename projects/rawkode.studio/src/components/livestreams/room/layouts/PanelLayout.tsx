import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import type { LayoutProps } from "./types";

export function PanelLayout({
	cameraTrackReferences,
	screenShareTrack,
}: LayoutProps) {
	const panelists = cameraTrackReferences.slice(0, 3);
	const containerRef = useRef<HTMLDivElement>(null);
	const [mainTileDimensions, setMainTileDimensions] = useState({
		width: 640,
		height: 360,
	});
	const [panelTileDimensions, setPanelTileDimensions] = useState({
		width: 256,
		height: 144,
	});

	useEffect(() => {
		const updateDimensions = () => {
			if (!containerRef.current) return;

			const { clientWidth, clientHeight } = containerRef.current;
			const padding = 32;
			const gap = 16;

			if (screenShareTrack) {
				// Calculate panel height (fixed at 180px)
				const panelHeight = 180;
				const availableMainHeight =
					clientHeight - padding * 2 - panelHeight - gap;
				const availableMainWidth = clientWidth - padding * 2;

				// 16:9 aspect ratio for main content
				const aspectRatio = 16 / 9;
				const mainWidthByHeight = availableMainHeight * aspectRatio;
				const mainHeightByWidth = availableMainWidth / aspectRatio;

				if (mainWidthByHeight <= availableMainWidth) {
					// Height-constrained
					setMainTileDimensions({
						width: mainWidthByHeight,
						height: availableMainHeight,
					});
				} else {
					// Width-constrained
					setMainTileDimensions({
						width: availableMainWidth,
						height: mainHeightByWidth,
					});
				}

				// Calculate panel tile dimensions
				const panelTileWidth = Math.min(
					320,
					(clientWidth - padding * 2 - gap * 2) / 3,
				);
				setPanelTileDimensions({
					width: panelTileWidth,
					height: panelTileWidth / aspectRatio,
				});
			} else {
				// Without screen share, just calculate panel dimensions
				const panelTileWidth = Math.min(
					320,
					(clientWidth - padding * 2 - gap * 2) / 3,
				);
				setPanelTileDimensions({
					width: panelTileWidth,
					height: panelTileWidth / (16 / 9),
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
	}, [screenShareTrack]);

	if (screenShareTrack) {
		return (
			<div
				ref={containerRef}
				className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex flex-col items-center justify-center gap-4 p-8"
			>
				{/* Screen share centered with proper aspect ratio */}
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

				{/* Panelists strip at bottom */}
				<div className="flex gap-4">
					{panelists.map((track) => (
						<div
							key={track.publication?.trackSid}
							className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
							style={{
								width: `${panelTileDimensions.width}px`,
								height: `${panelTileDimensions.height}px`,
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

	// Without screen share, show horizontal strip at bottom
	return (
		<div
			ref={containerRef}
			className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex flex-col justify-end items-center p-8"
		>
			<div className="flex gap-4">
				{panelists.map((track) => (
					<div
						key={track.publication?.trackSid}
						className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
						style={{
							width: `${panelTileDimensions.width}px`,
							height: `${panelTileDimensions.height}px`,
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
