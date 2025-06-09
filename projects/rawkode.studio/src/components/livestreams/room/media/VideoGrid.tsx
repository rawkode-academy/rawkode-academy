import { useLayout } from "@/components/livestreams/room/core/LayoutContext";
import {
	GridLayout,
	InterviewLayout,
	PanelLayout,
	PictureInPictureLayout,
	PresentationLayout,
	SideBySideLayout,
	SingleSpeakerLayout,
} from "@/components/livestreams/room/layouts";
import {
	LayoutType,
	getDefaultLayout,
	parseRoomMetadata,
} from "@/components/livestreams/room/layouts/permissions";
import {
	useLocalParticipant,
	useParticipants,
	useRoomInfo,
	useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Users } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

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
	const roomInfo = useRoomInfo();
	const { localParticipant } = useLocalParticipant();
	const { currentLayout, setCurrentLayout } = useLayout();

	// Get presenter from room metadata
	const presenter = parseRoomMetadata(roomInfo?.metadata)?.presenter;

	// Check for screen share tracks - only show presenter's screen share
	const allScreenShareTracks = tracks.filter(
		(track) =>
			track.source === Track.Source.ScreenShare &&
			track.publication?.isSubscribed,
	);

	const screenShareTrack = allScreenShareTracks.find(
		(track) => !presenter || track.participant.identity === presenter,
	);

	// Check if non-presenter is trying to share
	const nonPresenterSharing = allScreenShareTracks.find(
		(track) => presenter && track.participant.identity !== presenter,
	);

	// Filter camera tracks
	const cameraTrackReferences = tracks.filter((track) => {
		if (track.source !== Track.Source.Camera) return false;
		if (track.participant.isCameraEnabled !== true) return false;

		// In PIP and Single Speaker modes, only show presenter cameras
		if (
			currentLayout === LayoutType.PICTURE_IN_PICTURE ||
			currentLayout === LayoutType.SINGLE_SPEAKER
		) {
			const isPresenter = track.participant.identity === presenter;
			return isPresenter;
		}

		return true;
	});

	// Update layout based on room metadata
	useEffect(() => {
		const metadata = parseRoomMetadata(roomInfo?.metadata);
		if (metadata?.activeLayout) {
			setCurrentLayout(metadata.activeLayout);
		} else {
			// Use default layout based on room state
			setCurrentLayout(
				getDefaultLayout(!!screenShareTrack, cameraTrackReferences.length),
			);
		}
	}, [
		roomInfo?.metadata,
		screenShareTrack,
		cameraTrackReferences.length,
		setCurrentLayout,
	]);

	// Show notification when non-presenter tries to share
	useEffect(() => {
		if (nonPresenterSharing && localParticipant) {
			const isLocalSharing =
				nonPresenterSharing.participant.identity === localParticipant.identity;

			if (isLocalSharing) {
				toast.error("Only the presenter can share their screen", {
					description: "Ask a director to make you the presenter first",
					duration: 5000,
				});
			}
		}
	}, [nonPresenterSharing, localParticipant]);

	// Empty state if no participants
	if (participants.length === 0) {
		return (
			<div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
				<div className="text-center p-8 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl max-w-md border border-white/10">
					<div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
						<Users className="w-12 h-12 text-gray-400" />
					</div>
					<h3 className="text-xl font-semibold text-white mb-2">
						Waiting for participants...
					</h3>
					<p className="text-gray-400 text-sm">You're the first one here</p>
				</div>
			</div>
		);
	}

	// Render based on active layout with transition wrapper
	return (
		<div className="relative w-full h-full transition-all duration-500 ease-in-out">
			{(() => {
				const layoutProps = {
					cameraTrackReferences,
					screenShareTrack,
					presenter,
				};

				switch (currentLayout) {
					case LayoutType.SINGLE_SPEAKER:
						return <SingleSpeakerLayout {...layoutProps} />;

					case LayoutType.SIDE_BY_SIDE:
						return <SideBySideLayout {...layoutProps} />;

					case LayoutType.PICTURE_IN_PICTURE:
						return <PictureInPictureLayout {...layoutProps} />;

					case LayoutType.PRESENTATION:
						return <PresentationLayout {...layoutProps} />;

					case LayoutType.INTERVIEW:
						return <InterviewLayout {...layoutProps} />;

					case LayoutType.PANEL:
						return <PanelLayout {...layoutProps} />;

					default:
						return <GridLayout {...layoutProps} />;
				}
			})()}
		</div>
	);
}
