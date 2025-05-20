import {
	ParticipantTile,
	useParticipants,
	useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

// Video Grid Component
export function VideoGrid() {
	const tracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: true },
			{ source: Track.Source.ScreenShare, withPlaceholder: false },
		],
		{
			onlySubscribed: true,
		},
	);

	const participants = useParticipants();

	// Check for screen share tracks - if anyone is sharing screen, focus on that
	const screenShareTrack = tracks.find(
		(track) =>
			track.source === Track.Source.ScreenShare &&
			track.publication?.isSubscribed,
	);

	// Empty state if no participants
	if (participants.length === 0) {
		return (
			<div className="w-full h-full flex items-center justify-center p-4 bg-black">
				<div className="text-center p-6 bg-sidebar-accent/20 backdrop-blur-sm rounded-xl shadow-sm max-w-md">
					<h3 className="text-xl font-medium mb-3 text-white">
						Waiting for participants...
					</h3>
					<p className="text-white/70 mb-4 text-sm">
						You're the first one here
					</p>
				</div>
			</div>
		);
	}

	// Filter to only get tracks from participants who have their camera enabled
	const cameraTrackReferences = tracks.filter((track) => {
		// Only include Camera tracks
		if (track.source !== Track.Source.Camera) return false;

		// Check if the participant has their camera enabled
		return track.participant.isCameraEnabled === true;
	});

	// If someone is screen sharing, use a custom layout with screen share and floating participant tiles
	if (screenShareTrack) {
		return (
			<div className="w-full h-full bg-black relative">
				{/* Main screen share takes full screen */}
				<div className="absolute inset-0 w-full h-full">
					<ParticipantTile
						trackRef={screenShareTrack}
						disableSpeakingIndicator={true}
						className="w-full h-full"
					/>
				</div>

				{/* Floating participant videos in a vertical column on the right */}
				<div className="absolute top-4 right-4 w-48 max-h-[90%] overflow-y-auto space-y-2 z-10">
					{cameraTrackReferences.map((track) => (
						<div
							key={track.publication?.trackSid}
							className="w-full aspect-video rounded-lg overflow-hidden shadow-lg border border-white/10"
						>
							<ParticipantTile
								trackRef={track}
								disableSpeakingIndicator={false}
								className="w-full h-full"
							/>
						</div>
					))}
				</div>
			</div>
		);
	}

	// Default 3-column grid when no screen sharing
	return (
		<div className="w-full h-full bg-black p-4">
			<div
				className={`grid gap-4 w-full h-full ${
					cameraTrackReferences.length === 1
						? "grid-cols-1"
						: cameraTrackReferences.length === 2
							? "grid-cols-2"
							: cameraTrackReferences.length === 3
								? "grid-cols-3"
								: cameraTrackReferences.length === 4
									? "grid-cols-2 grid-rows-2"
									: cameraTrackReferences.length <= 6
										? "grid-cols-3 grid-rows-2"
										: cameraTrackReferences.length <= 9
											? "grid-cols-3 grid-rows-3"
											: cameraTrackReferences.length <= 12
												? "grid-cols-4 grid-rows-3"
												: "grid-cols-4 grid-rows-4"
				}`}
			>
				{cameraTrackReferences.map((track) => (
					<div
						key={track.publication?.trackSid}
						className={`rounded-lg overflow-hidden shadow-md ${
							cameraTrackReferences.length === 1
								? "w-full h-full"
								: "aspect-video"
						}`}
					>
						<ParticipantTile
							trackRef={track}
							disableSpeakingIndicator={false}
							className="w-full h-full"
						/>
					</div>
				))}
			</div>
		</div>
	);
}
