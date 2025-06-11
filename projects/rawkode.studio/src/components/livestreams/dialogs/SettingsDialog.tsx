import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
// Removed LiveKit imports - using native WebRTC instead
import {
  AlertCircle,
  Camera,
  CameraOff,
  Mic,
  Monitor,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SettingsDialogProps {
  className?: string;
}

interface StreamingSettings {
  videoResolution: string;
  videoFramerate: number;
  videoBitrate: number;
  screenShareResolution: string;
  screenShareFramerate: number;
  screenShareBitrate: number;
}

const DEFAULT_SETTINGS: StreamingSettings = {
  videoResolution: "h1080",
  videoFramerate: 60,
  videoBitrate: 10_000_000,
  screenShareResolution: "h1080",
  screenShareFramerate: 60,
  screenShareBitrate: 10_000_000,
};

export function SettingsDialog({ className }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({
    audioInputs: [],
    videoInputs: [],
  });
  const [selectedDevices, setSelectedDevices] = useState({
    audioInput: "no-device",
    videoInput: "no-device",
  });
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [permissions, setPermissions] = useState({
    camera: "prompt" as PermissionState,
    microphone: "prompt" as PermissionState,
  });

  // Streaming quality settings
  const [streamingSettings, setStreamingSettings] = useState<StreamingSettings>(
    () => {
      // Try to load from session storage or use defaults
      const stored = sessionStorage.getItem("streaming-settings");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return DEFAULT_SETTINGS;
        }
      }
      return DEFAULT_SETTINGS;
    },
  );

  const createPreviewStream = useCallback(async () => {
    if (!cameraEnabled || selectedDevices.videoInput === "no-device") {
      // If camera is disabled or no device available, just cleanup
      setPreviewStream((prevStream) => {
        if (prevStream) {
          for (const track of prevStream.getTracks()) {
            track.stop();
          }
        }
        return null;
      });
      return;
    }

    try {
      // Create new preview stream using native WebRTC API
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDevices.videoInput,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      // Stop and cleanup the previous preview stream
      setPreviewStream((prevStream) => {
        if (prevStream) {
          for (const track of prevStream.getTracks()) {
            track.stop();
          }
        }
        return stream;
      });
    } catch (error) {
      console.error("Error creating preview stream:", error);
    }
  }, [selectedDevices.videoInput, cameraEnabled]);

  // Check permissions
  const checkPermissions = useCallback(async () => {
    try {
      // Check camera permission
      const cameraPermission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      // Check microphone permission
      const micPermission = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      setPermissions({
        camera: cameraPermission.state,
        microphone: micPermission.state,
      });

      // Listen for permission changes
      cameraPermission.addEventListener("change", () => {
        setPermissions((prev) => ({ ...prev, camera: cameraPermission.state }));
      });
      micPermission.addEventListener("change", () => {
        setPermissions((prev) => ({
          ...prev,
          microphone: micPermission.state,
        }));
      });
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  }, []);

  // Get available media devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Check permissions first
        await checkPermissions();

        const devices = await navigator.mediaDevices.enumerateDevices();
        // Filter out devices with empty deviceIds (happens when permissions not granted)
        const audioInputs = devices.filter(
          (device) =>
            device.kind === "audioinput" &&
            device.deviceId &&
            device.deviceId !== "",
        );
        const videoInputs = devices.filter(
          (device) =>
            device.kind === "videoinput" &&
            device.deviceId &&
            device.deviceId !== "",
        );
        setDevices({ audioInputs, videoInputs });

        // Try to get stored device preferences from sessionStorage
        const storedAudioDevice = sessionStorage.getItem(
          "prejoin-audio-device",
        );
        const storedVideoDevice = sessionStorage.getItem(
          "prejoin-video-device",
        );

        // Validate stored devices still exist and are not empty
        const validStoredAudioDevice =
          storedAudioDevice &&
          storedAudioDevice !== "" &&
          audioInputs.some((d) => d.deviceId === storedAudioDevice)
            ? storedAudioDevice
            : null;
        const validStoredVideoDevice =
          storedVideoDevice &&
          storedVideoDevice !== "" &&
          videoInputs.some((d) => d.deviceId === storedVideoDevice)
            ? storedVideoDevice
            : null;

        // Use stored device or fallback to first available
        setSelectedDevices(() => ({
          audioInput:
            validStoredAudioDevice ||
            (audioInputs[0]?.deviceId && audioInputs[0].deviceId !== ""
              ? audioInputs[0].deviceId
              : null) ||
            "no-device",
          videoInput:
            validStoredVideoDevice ||
            (videoInputs[0]?.deviceId && videoInputs[0].deviceId !== ""
              ? videoInputs[0].deviceId
              : null) ||
            "no-device",
        }));

        // Camera preview is disabled by default, user must click to enable
      } catch (error) {
        console.error("Error enumerating devices:", error);
      }
    };

    if (open) {
      getDevices();
    }
  }, [open, checkPermissions]);

  // Cleanup preview stream when dialog closes
  useEffect(() => {
    if (!open) {
      if (previewStream) {
        for (const track of previewStream.getTracks()) {
          track.stop();
        }
        setPreviewStream(null);
      }
      // Reset camera enabled state when dialog closes
      setCameraEnabled(false);
    }
  }, [open, previewStream]);

  // Create and attach preview stream when dialog opens or camera state changes
  useEffect(() => {
    if (
      open &&
      selectedDevices.videoInput &&
      selectedDevices.videoInput !== "no-device"
    ) {
      createPreviewStream();
    }
  }, [open, selectedDevices.videoInput, createPreviewStream]);

  // Attach preview stream to video element
  useEffect(() => {
    if (previewStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = previewStream;
    }

    return () => {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [previewStream]);

  const handleVideoDeviceChange = (deviceId: string) => {
    setSelectedDevices((prev) => ({ ...prev, videoInput: deviceId }));
  };

  const toggleCameraPreview = () => {
    setCameraEnabled((prev) => {
      const newState = !prev;
      // If disabling, the createPreviewStream callback will handle cleanup
      // If enabling, the useEffect will trigger createPreviewStream
      return newState;
    });
  };

  const handleApplySettings = async () => {
    try {
      // Persist device selections to sessionStorage (only if valid devices)
      if (
        selectedDevices.audioInput &&
        selectedDevices.audioInput !== "no-device"
      ) {
        sessionStorage.setItem(
          "prejoin-audio-device",
          selectedDevices.audioInput,
        );
      }
      if (
        selectedDevices.videoInput &&
        selectedDevices.videoInput !== "no-device"
      ) {
        sessionStorage.setItem(
          "prejoin-video-device",
          selectedDevices.videoInput,
        );
      }

      // Store settings in session storage
      sessionStorage.setItem(
        "streaming-settings",
        JSON.stringify(streamingSettings),
      );

      setOpen(false);
    } catch (error) {
      console.error("Error applying settings:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className={`h-9 w-full rounded-md transition-all hover:scale-105 ${className}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Settings</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your devices and streaming quality
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          <div className="space-y-6">
            {/* Camera Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                <Label>Camera</Label>
              </div>

              {permissions.camera === "denied" ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Camera access denied. Please check your browser settings to
                    grant camera permissions.
                  </AlertDescription>
                </Alert>
              ) : permissions.camera === "prompt" ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Camera permission not yet granted. Please allow camera
                    access when prompted by your browser.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="relative bg-muted rounded-lg overflow-hidden aspect-video w-full shadow-sm">
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ display: cameraEnabled ? "block" : "none" }}
                    />
                    {(!previewStream || !cameraEnabled) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                        {cameraEnabled ? (
                          <>
                            <Camera className="h-10 w-10 mb-2 opacity-50" />
                            <span className="text-sm font-medium">
                              Loading preview...
                            </span>
                          </>
                        ) : (
                          <>
                            <CameraOff className="h-10 w-10 mb-2 opacity-50" />
                            <span className="text-sm font-medium">
                              Preview disabled
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Toggle button overlay */}
                    <div className="absolute top-3 right-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={cameraEnabled ? "default" : "secondary"}
                        onClick={toggleCameraPreview}
                        className="shadow-md"
                      >
                        {cameraEnabled ? (
                          <Camera className="h-4 w-4" />
                        ) : (
                          <CameraOff className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Device selection */}
                  <Select
                    value={selectedDevices.videoInput || "no-device"}
                    onValueChange={handleVideoDeviceChange}
                  >
                    <SelectTrigger id="camera-select" className="w-full">
                      <SelectValue placeholder="Select a camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.videoInputs.length === 0 && (
                        <SelectItem value="no-device">
                          No camera available
                        </SelectItem>
                      )}
                      {devices.videoInputs.map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label ||
                            `Camera ${device.deviceId.slice(0, 8)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Microphone Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <Label htmlFor="mic-select">Microphone</Label>
              </div>
              {permissions.microphone === "denied" ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Microphone access denied. Please check your browser settings
                    to grant microphone permissions.
                  </AlertDescription>
                </Alert>
              ) : permissions.microphone === "prompt" ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Microphone permission not yet granted. Please allow
                    microphone access when prompted by your browser.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={selectedDevices.audioInput || "no-device"}
                  onValueChange={(value) =>
                    setSelectedDevices((prev) => ({
                      ...prev,
                      audioInput: value,
                    }))
                  }
                >
                  <SelectTrigger id="mic-select" className="w-full">
                    <SelectValue placeholder="Select a microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.audioInputs.length === 0 && (
                      <SelectItem value="no-device">
                        No microphone available
                      </SelectItem>
                    )}
                    {devices.audioInputs.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Microphone ${device.deviceId.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Streaming Quality Settings */}
          <div className="space-y-6 lg:border-l lg:pl-6">
            <h3 className="font-medium">Streaming Quality</h3>
            <div className="space-y-4">
              {/* Camera Quality */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" />
                  <span>Camera</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={streamingSettings.videoResolution}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        videoResolution: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h720">720p</SelectItem>
                      <SelectItem value="h1080">1080p</SelectItem>
                      <SelectItem value="h1440">1440p</SelectItem>
                      <SelectItem value="h2160">2160p</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={streamingSettings.videoFramerate.toString()}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        videoFramerate: Number.parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 FPS</SelectItem>
                      <SelectItem value="60">60 FPS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={streamingSettings.videoBitrate.toString()}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        videoBitrate: Number.parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000000">2 Mbps</SelectItem>
                      <SelectItem value="5000000">5 Mbps</SelectItem>
                      <SelectItem value="10000000">10 Mbps</SelectItem>
                      <SelectItem value="15000000">15 Mbps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Screen Share Quality */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Monitor className="h-3.5 w-3.5" />
                  <span>Screen Share</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={streamingSettings.screenShareResolution}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        screenShareResolution: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="h720">720p</SelectItem>
                      <SelectItem value="h1080">1080p</SelectItem>
                      <SelectItem value="h1440">1440p</SelectItem>
                      <SelectItem value="h2160">2160p</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={streamingSettings.screenShareFramerate.toString()}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        screenShareFramerate: Number.parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 FPS</SelectItem>
                      <SelectItem value="30">30 FPS</SelectItem>
                      <SelectItem value="60">60 FPS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={streamingSettings.screenShareBitrate.toString()}
                    onValueChange={(value) =>
                      setStreamingSettings((prev) => ({
                        ...prev,
                        screenShareBitrate: Number.parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000000">2 Mbps</SelectItem>
                      <SelectItem value="3000000">3 Mbps</SelectItem>
                      <SelectItem value="5000000">5 Mbps</SelectItem>
                      <SelectItem value="10000000">10 Mbps</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Additional info */}
              <div className="mt-6 space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-sm">About these settings:</p>
                <ul className="space-y-1 ml-4">
                  <li>
                    • Resolution affects video clarity - 1080p is recommended
                    for most streams
                  </li>
                  <li>
                    • Higher frame rates (60 FPS) provide smoother motion but
                    use more bandwidth
                  </li>
                  <li>
                    • Bitrate determines overall quality - higher values need
                    faster internet
                  </li>
                  <li>
                    • Screen share can use lower FPS (15-30) since content is
                    mostly static
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button onClick={handleApplySettings} className="flex-1">
            Apply Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
