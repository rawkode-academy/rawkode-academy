import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import EgressHelper from "@livekit/egress-sdk";
import "@/styles/global.css";
import { GridRecordingTemplate } from "./layouts/GridRecordingTemplate";
import { InterviewRecordingTemplate } from "./layouts/InterviewRecordingTemplate";
import { PanelRecordingTemplate } from "./layouts/PanelRecordingTemplate";
import { PictureInPictureRecordingTemplate } from "./layouts/PictureInPictureRecordingTemplate";
import { PresentationRecordingTemplate } from "./layouts/PresentationRecordingTemplate";
import { SideBySideRecordingTemplate } from "./layouts/SideBySideRecordingTemplate";
import { SingleSpeakerRecordingTemplate } from "./layouts/SingleSpeakerRecordingTemplate";

function LayoutContent({ layout }: { layout: string }) {
  switch (layout) {
    case "grid":
      return <GridRecordingTemplate />;
    case "single-speaker":
      return <SingleSpeakerRecordingTemplate />;
    case "side-by-side":
      return <SideBySideRecordingTemplate />;
    case "picture-in-picture":
      return <PictureInPictureRecordingTemplate />;
    case "presentation":
      return <PresentationRecordingTemplate />;
    case "interview":
      return <InterviewRecordingTemplate />;
    case "panel":
      return <PanelRecordingTemplate />;
    default:
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
          <p>Unknown layout: {layout}</p>
        </div>
      );
  }
}

export function RecordingTemplateWrapper() {
  // Get parameters from URL using the official SDK
  const url = EgressHelper.getLiveKitURL();
  const token = EgressHelper.getAccessToken();
  const layout = EgressHelper.getLayout() || "grid"; // Default to grid if no layout specified

  if (!url || !token) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Missing connection parameters</p>
      </div>
    );
  }

  return (
    <LiveKitRoom serverUrl={url} token={token}>
      <div className="h-screen w-screen bg-gray-950">
        <LayoutContent layout={layout} />
      </div>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
