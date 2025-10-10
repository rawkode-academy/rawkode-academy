import {
	RealtimeKitProvider,
	useRealtimeKitClient,
	useRealtimeKitMeeting,
} from "@cloudflare/realtimekit-react";
import { RtkMeeting } from "@cloudflare/realtimekit-react-ui";
import { LocalRecorderControls } from "@/components/recording/LocalRecorderControls";
import { useEffect } from "react";

interface VideoMeetingProps {
	meetingId: string;
	authToken: string;
	participantName: string;
	preset?: "livestream_viewer" | "livestream_host";
	showSetupScreen?: boolean;
	onLeave?: () => void;
}

function MeetingUI({ showSetupScreen = false, meetingId }: { showSetupScreen?: boolean; meetingId: string }) {
  const { meeting } = useRealtimeKitMeeting();

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <RtkMeeting mode="fill" meeting={meeting} showSetupScreen={showSetupScreen} />
      <LocalRecorderControls meetingId={meetingId} participantRole="host" />
    </div>
  );
}

export function VideoMeeting(props: VideoMeetingProps) {
  const { authToken, showSetupScreen = false } = props;
  const [meeting, initMeeting] = useRealtimeKitClient();

	useEffect(() => {
		if (authToken) {
			initMeeting({
				authToken,
				defaults: {
					audio: true,
					video: true,
				},
			});
		}
	}, [authToken, initMeeting]);

  return (
    <RealtimeKitProvider value={meeting}>
      <MeetingUI showSetupScreen={showSetupScreen} meetingId={props.meetingId} />
    </RealtimeKitProvider>
  );
}
