import { useState } from "react";

interface MediaSettings {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export function useParticipantInfo() {
  // Get initial media settings from prejoin preferences
  const getInitialMediaSettings = (): MediaSettings => {
    if (typeof window !== "undefined") {
      const audioEnabled = sessionStorage.getItem("prejoin-audio-enabled");
      const videoEnabled = sessionStorage.getItem("prejoin-video-enabled");
      const audioDeviceId = sessionStorage.getItem("prejoin-audio-device");
      const videoDeviceId = sessionStorage.getItem("prejoin-video-device");
      return {
        audio: audioEnabled === "true",
        video: videoEnabled === "true",
        audioDeviceId: audioDeviceId || undefined,
        videoDeviceId: videoDeviceId || undefined,
      };
    }
    return {
      audio: false,
      video: false,
      audioDeviceId: undefined,
      videoDeviceId: undefined,
    };
  };

  const [initialMediaSettings] = useState<MediaSettings>(
    getInitialMediaSettings,
  );

  return {
    initialMediaSettings,
  };
}
