import {
	RealtimeKitProvider,
	useRealtimeKitClient,
	useRealtimeKitMeeting,
} from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import { useEffect } from "react";

interface VideoMeetingProps {
	meetingId: string;
	authToken: string;
	participantName: string;
	preset?: "livestream_viewer" | "livestream_host";
	showSetupScreen?: boolean;
	onLeave?: () => void;
}

function MeetingUI({
	showSetupScreen = false,
	onLeave,
}: {
	showSetupScreen?: boolean;
	onLeave?: () => void;
}) {
	const { meeting } = useRealtimeKitMeeting();

	const handleLeave = () => {
		onLeave?.();
	};

	return (
		<div style={{ height: "100vh", width: "100%" }}>
			<RtkMeeting
				mode="fill"
				meeting={meeting}
				showSetupScreen={showSetupScreen}
				onLeave={handleLeave}
			/>
		</div>
	);
}

export function VideoMeeting({
	meetingId,
	authToken,
	participantName,
	preset,
	showSetupScreen = false,
	onLeave,
}: VideoMeetingProps) {
	const [meeting, initMeeting] = useRealtimeKitClient();

	useEffect(() => {
		if (authToken && meetingId) {
			initMeeting({
				authToken: authToken,
				meetingId: meetingId,
				participantName: participantName,
				preset: preset,
				defaults: {
					audio: true,
					video: true,
				},
			});
		}
	}, [authToken, meetingId, participantName, preset, initMeeting]);

	return (
		<RealtimeKitProvider value={meeting}>
			<MeetingUI showSetupScreen={showSetupScreen} onLeave={onLeave} />
		</RealtimeKitProvider>
	);
}
