import { ParticipantTile } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import type { LayoutProps } from "./types";

export function PictureInPictureLayout({
	cameraTrackReferences,
	screenShareTrack,
	presenter,
}: LayoutProps) {
	// In PiP layout, only show presenter cameras
	const presenterCameraTracks = presenter
		? cameraTrackReferences.filter(
				(track) => track.participant.identity === presenter,
			)
		: cameraTrackReferences;

	const mainTrack = screenShareTrack || presenterCameraTracks[0];
	const pipTrack = screenShareTrack
		? presenterCameraTracks[0]
		: presenterCameraTracks[1];

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

	// Calculate PiP dimensions (16:9 aspect ratio)
	const pipWidth = Math.min(mainTileDimensions.width * 0.25, 320);
	const pipHeight = pipWidth / (16 / 9);

	return (
		<div
			ref={containerRef}
			className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black relative"
		>
			{/* Main content centered with proper aspect ratio */}
			<div className="absolute inset-0 flex items-center justify-center">
				{mainTrack && (
					<div
						className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 bg-gray-900"
						style={{
							width: `${mainTileDimensions.width}px`,
							height: `${mainTileDimensions.height}px`,
						}}
					>
						<ParticipantTile
							trackRef={mainTrack}
							disableSpeakingIndicator={true}
							className="w-full h-full"
						/>
					</div>
				)}
			</div>

			{/* PiP overlay */}
			{pipTrack && (
				<div
					className="absolute bottom-8 right-8 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 hover:ring-white/20 bg-gray-900"
					style={{
						width: `${pipWidth}px`,
						height: `${pipHeight}px`,
					}}
				>
					<ParticipantTile
						trackRef={pipTrack}
						disableSpeakingIndicator={true}
						className="w-full h-full"
					/>
				</div>
			)}
		</div>
	);
}
