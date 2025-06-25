import type { LocalUserChoices } from "@livekit/components-core";
import {
  AlertCircle,
  Camera,
  CameraOff,
  LogIn,
  Mic,
  MicOff,
  User,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ModernBackground } from "@/components/common/ModernBackground";
import { ModeToggle } from "@/components/common/ModeToggle";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { Separator } from "@/components/shadcn/separator";
import { generateGuestName } from "@/lib/guest";
import { cn } from "@/lib/utils";

interface PrejoinScreenProps {
  roomDisplayName: string;
  roomExists: boolean;
  isDirector: boolean;
  username?: string;
  isAuthenticated: boolean;
  onJoin: (choices: LocalUserChoices) => void;
}

export function PrejoinScreen({
  roomDisplayName,
  roomExists,
  isDirector,
  username: providedUsername,
  isAuthenticated,
  onJoin,
}: PrejoinScreenProps) {
  // State
  const [username, setUsername] = useState(providedUsername || "");
  const [guestNamePlaceholder] = useState(() => generateGuestName());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioDeviceId, setAudioDeviceId] = useState<string>("");
  const usernameInputId1 = useId();
  const usernameInputId2 = useId();
  const [videoDeviceId, setVideoDeviceId] = useState<string>("");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissions, setPermissions] = useState({
    camera: "prompt" as PermissionState,
    microphone: "prompt" as PermissionState,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

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

  // Load media devices
  useEffect(() => {
    if (!isDirector) return;

    const loadDevices = async () => {
      try {
        // Check permissions first
        await checkPermissions();

        // Get devices
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

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

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
        setAudioDeviceId(
          validStoredAudioDevice ||
            (audioInputs[0]?.deviceId && audioInputs[0].deviceId !== ""
              ? audioInputs[0].deviceId
              : "") ||
            "",
        );
        setVideoDeviceId(
          validStoredVideoDevice ||
            (videoInputs[0]?.deviceId && videoInputs[0].deviceId !== ""
              ? videoInputs[0].deviceId
              : "") ||
            "",
        );

        // Camera preview is disabled by default, user must click to enable
      } catch (err) {
        console.error("Error loading devices:", err);
      }
    };

    loadDevices();
  }, [isDirector, checkPermissions]);

  // Create preview stream using native WebRTC
  const createPreviewStream = useCallback(async () => {
    if (!videoEnabled || !videoDeviceId) {
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
          deviceId: videoDeviceId,
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
      setError("Failed to access camera");
    }
  }, [videoEnabled, videoDeviceId]);

  // Create and attach preview stream when video is enabled or device changes
  useEffect(() => {
    if (isDirector && videoDeviceId) {
      createPreviewStream();
    }
  }, [isDirector, videoDeviceId, createPreviewStream]);

  // Attach preview stream to video element
  useEffect(() => {
    if (previewStream && videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [previewStream]);

  // Cleanup preview stream when component unmounts
  useEffect(() => {
    return () => {
      if (previewStream) {
        for (const track of previewStream.getTracks()) {
          track.stop();
        }
        setPreviewStream(null);
      }
    };
  }, [previewStream]);

  const handleVideoDeviceChange = (deviceId: string) => {
    setVideoDeviceId(deviceId);
  };

  const toggleCameraPreview = () => {
    setVideoEnabled((prev) => {
      const newState = !prev;
      // If disabling, the createPreviewStream callback will handle cleanup
      // If enabling, the useEffect will trigger createPreviewStream
      return newState;
    });
  };

  // Create audio stream for level monitoring
  const createAudioStream = useCallback(async () => {
    // Cleanup previous resources first
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      for (const track of audioStreamRef.current.getTracks()) {
        track.stop();
      }
      audioStreamRef.current = null;
    }

    if (!audioEnabled || !audioDeviceId) {
      audioStreamRef.current = null;
      setAudioLevel(0);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: audioDeviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      audioStreamRef.current = stream;

      // Set up audio level monitoring
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();

      // Resume audio context if it's suspended (required for some browsers)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);

      // Create inline AudioWorklet processor
      const processorCode = `
				class AudioLevelProcessor extends AudioWorkletProcessor {
					constructor() {
						super();
						this.frameCount = 0;
					}
					
					process(inputs, outputs, parameters) {
						const input = inputs[0];
						
						if (input && input.length > 0) {
							const samples = input[0];
							
							// Calculate RMS and peak
							let sum = 0;
							let max = 0;
							
							for (let i = 0; i < samples.length; i++) {
								sum += samples[i] * samples[i];
								max = Math.max(max, Math.abs(samples[i]));
							}
							
							const rms = Math.sqrt(sum / samples.length);
							
							// Send levels to main thread
							if (this.frameCount % 5 === 0) {
								this.port.postMessage({
									rms: rms,
									peak: max
								});
							}
							
							this.frameCount++;
						}
						
						return true; // Keep processor alive
					}
				}
				
				registerProcessor('audio-level-processor', AudioLevelProcessor);
			`;

      // Create blob URL for the processor
      const blob = new Blob([processorCode], {
        type: "application/javascript",
      });
      const processorUrl = URL.createObjectURL(blob);

      // Load and create the AudioWorklet
      await audioContext.audioWorklet.addModule(processorUrl);
      const levelNode = new AudioWorkletNode(
        audioContext,
        "audio-level-processor",
      );

      // Handle messages from the processor
      levelNode.port.onmessage = (event) => {
        const { rms, peak } = event.data;

        // Scale the level with doubled sensitivity
        const scaledLevel = Math.min(Math.max(rms * 40, peak * 10), 1);

        setAudioLevel(scaledLevel);
      };

      // Connect the audio nodes
      source.connect(levelNode);

      // Store references for cleanup
      audioContextRef.current = audioContext;
      analyserRef.current = levelNode as unknown as AnalyserNode; // Store level node for cleanup

      // Clean up blob URL
      URL.revokeObjectURL(processorUrl);
    } catch (error) {
      console.error("Error creating audio stream:", error);
      setError("Failed to access microphone");
    }
  }, [audioEnabled, audioDeviceId]);

  // Create audio stream when audio is enabled or device changes
  useEffect(() => {
    if (isDirector) {
      createAudioStream();
    }
  }, [isDirector, createAudioStream]);

  // Cleanup audio resources
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        for (const track of audioStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate display name
    const finalUsername =
      username.trim() ||
      (!isAuthenticated ? guestNamePlaceholder : providedUsername || "");
    if (!finalUsername) {
      setError("Please enter a display name");
      setIsLoading(false);
      return;
    }

    try {
      // Stop preview stream before joining
      if (previewStream) {
        for (const track of previewStream.getTracks()) {
          track.stop();
        }
      }

      // Stop audio stream
      if (audioStreamRef.current) {
        for (const track of audioStreamRef.current.getTracks()) {
          track.stop();
        }
      }

      // Stop audio monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      // Persist device selections to sessionStorage (only if valid devices)
      if (audioDeviceId && audioDeviceId !== "") {
        sessionStorage.setItem("prejoin-audio-device", audioDeviceId);
      }
      if (videoDeviceId && videoDeviceId !== "") {
        sessionStorage.setItem("prejoin-video-device", videoDeviceId);
      }

      const choices: LocalUserChoices = {
        username: finalUsername,
        audioEnabled,
        videoEnabled,
        audioDeviceId,
        videoDeviceId,
      };

      onJoin(choices);
    } catch (_err) {
      setError("Failed to join the stream. Please try again.");
      setIsLoading(false);
    }
  };

  if (!roomExists) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <ModernBackground />

        {/* Theme toggle in top right corner of screen */}
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-background/80 backdrop-blur-sm border border-foreground/20 rounded-md">
            <ModeToggle />
          </div>
        </div>

        <Card className="w-full max-w-sm backdrop-blur-md bg-background/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertCircle className="size-6 text-destructive" />
              Room Not Available
            </CardTitle>
            <CardDescription>
              The livestream "{roomDisplayName}" may have ended or doesn't
              exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <ModernBackground />

      {/* Theme toggle in top right corner of screen */}
      <div className="absolute top-2 right-2 z-10">
        <div className="bg-background/80 backdrop-blur-sm border border-foreground/20 rounded-md">
          <ModeToggle />
        </div>
      </div>

      <Card className="w-full max-w-md backdrop-blur-md bg-background/80 border-border/50">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Video className="size-5 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">Join {roomDisplayName}</CardTitle>
          <CardDescription className="text-sm">
            {isDirector
              ? "Configure your camera and microphone"
              : "Enter your display name to join"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <CardContent className="flex flex-col gap-4 pt-0 pb-4">
            {/* Name input for all non-director users */}
            {!isDirector && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={usernameInputId1}>Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id={usernameInputId1}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        isAuthenticated
                          ? providedUsername || "Enter your display name"
                          : guestNamePlaceholder
                      }
                      className="pl-10"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isAuthenticated
                      ? "Choose how your name appears to others"
                      : "Leave blank to use the suggested guest name"}
                  </p>
                </div>

                {/* Submit button for all non-director users */}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Joining..." : "Join Livestream"}
                </Button>
              </>
            )}

            {/* Login option for guests only */}
            {!isDirector && !isAuthenticated && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Store the current room URL to redirect back after login
                    const returnUrl =
                      window.location.pathname + window.location.search;
                    sessionStorage.setItem("login-return-url", returnUrl);
                    window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnUrl)}`;
                  }}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in for better experience
                </Button>
              </>
            )}

            {/* Director name input */}
            {isDirector && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={usernameInputId2}>Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id={usernameInputId2}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={providedUsername || "Enter your display name"}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Choose how your name appears to others
                </p>
              </div>
            )}

            {/* Media settings for directors */}
            {isDirector && (
              <div className="flex flex-col gap-4">
                <Separator />

                {/* Video preview */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <Label>Camera</Label>
                  </div>

                  {permissions.camera === "denied" ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Camera access denied. Please check your browser settings
                        to grant camera permissions.
                      </AlertDescription>
                    </Alert>
                  ) : permissions.camera === "prompt" &&
                    videoDevices.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Camera permission not yet granted. Please allow camera
                        access when prompted by your browser.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {/* Preview */}
                      <div className="relative bg-muted rounded-lg overflow-hidden aspect-video w-full shadow-sm">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ display: videoEnabled ? "block" : "none" }}
                        />
                        {(!previewStream || !videoEnabled) && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                            {videoEnabled ? (
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
                            variant={videoEnabled ? "default" : "secondary"}
                            onClick={toggleCameraPreview}
                            className="shadow-md"
                          >
                            {videoEnabled ? (
                              <Camera className="h-4 w-4" />
                            ) : (
                              <CameraOff className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {videoDevices.length > 0 && (
                        <Select
                          value={videoDeviceId || ""}
                          onValueChange={handleVideoDeviceChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {videoDevices.map((device) => (
                              <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label ||
                                  `Camera ${device.deviceId.slice(0, 5)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>

                <Separator />

                {/* Audio settings */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    <Label className="text-sm font-medium">Microphone</Label>
                  </div>

                  {permissions.microphone === "denied" ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Microphone access denied. Please check your browser
                        settings to grant microphone permissions.
                      </AlertDescription>
                    </Alert>
                  ) : permissions.microphone === "prompt" &&
                    audioDevices.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Microphone permission not yet granted. Please allow
                        microphone access when prompted by your browser.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant={audioEnabled ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setAudioEnabled(!audioEnabled)}
                          className="gap-2"
                        >
                          {audioEnabled ? (
                            <>
                              <Mic className="size-4" /> Mic On
                            </>
                          ) : (
                            <>
                              <MicOff className="size-4" /> Mic Off
                            </>
                          )}
                        </Button>

                        {/* Audio level indicator */}
                        <div className="flex-1">
                          <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border">
                            <div
                              className={cn(
                                "h-full transition-all duration-100",
                                audioEnabled
                                  ? "bg-gradient-to-r from-green-500 to-green-400"
                                  : "bg-muted-foreground/20",
                              )}
                              style={{
                                width: audioEnabled
                                  ? `${Math.max(2, Math.min(audioLevel * 100, 100))}%`
                                  : "0%",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {audioDevices.length > 0 && (
                        <Select
                          value={audioDeviceId || ""}
                          onValueChange={setAudioDeviceId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select microphone" />
                          </SelectTrigger>
                          <SelectContent>
                            {audioDevices.map((device) => (
                              <SelectItem
                                key={device.deviceId}
                                value={device.deviceId}
                              >
                                {device.label ||
                                  `Microphone ${device.deviceId.slice(0, 5)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>

                {/* Submit button for directors */}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Joining..." : "Join Livestream"}
                </Button>
              </div>
            )}

            {/* Error message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Terms text */}
            <p className="text-xs text-center text-muted-foreground">
              By joining, you agree to our terms of service and community
              guidelines
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
