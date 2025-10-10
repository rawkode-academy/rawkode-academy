import { useEffect, useMemo, useRef, useState } from "react";
import { LocalRecorder } from "@/lib/recording/LocalRecorder";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Circle, CirclePause, CirclePlay, CircleStop, Download, ExternalLink } from "lucide-react";

interface Props {
  meetingId: string;
  participantRole?: string; // e.g., "host"
}

export function LocalRecorderControls({ meetingId, participantRole = "host" }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused" | "stopping" | "stopped" | "error">("idle");
  const [recorder, setRecorder] = useState<LocalRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const baseUrl = ""; // same origin

  useEffect(() => {
    setRecorder(new LocalRecorder({ sessionId: meetingId, trackId: participantRole, backendBaseUrl: baseUrl, preferredFps: 30 }));
  }, [meetingId, participantRole]);

  const canStart = status === "idle" || status === "stopped";
  const canPause = status === "recording";
  const canResume = status === "paused";
  const canStop = status === "recording" || status === "paused";

  const handleStart = async () => {
    if (!recorder) return;
    setBusy(true);
    try {
      await recorder.start(videoRef.current || undefined);
      setStatus("recording");
    } catch (e) {
      console.error(e);
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  const handlePause = () => {
    recorder?.pause();
    setStatus("paused");
  };
  const handleResume = () => {
    recorder?.resume();
    setStatus("recording");
  };
  const handleStop = async () => {
    setBusy(true);
    await recorder?.stop();
    setBusy(false);
    setStatus("stopped");
  };

  const handleDescript = async () => {
    // Build R2 key(s) and request import URL
    const fileKeys = [`sessions/${meetingId}/${participantRole}/recording.mp4`];
    const res = await fetch("/api/descript/import-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: meetingId, fileKeys }) });
    if (!res.ok) {
      alert("Failed to create Descript import link");
      return;
    }
    const { url } = await res.json();
    window.open(url, "_blank");
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <Card className="bg-gray-900/80 backdrop-blur p-3 border border-gray-700 flex items-center gap-2">
        <video ref={videoRef} className="w-32 h-20 rounded bg-black" playsInline muted />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="default" disabled={!canStart || busy} onClick={handleStart} title="Start local 4K recording">
            <Circle className="h-4 w-4 mr-1" /> Start
          </Button>
          <Button size="sm" variant="secondary" disabled={!canPause || busy} onClick={handlePause} title="Pause">
            <CirclePause className="h-4 w-4 mr-1" />
          </Button>
          <Button size="sm" variant="secondary" disabled={!canResume || busy} onClick={handleResume} title="Resume">
            <CirclePlay className="h-4 w-4 mr-1" />
          </Button>
          <Button size="sm" variant="destructive" disabled={!canStop || busy} onClick={handleStop} title="Stop">
            <CircleStop className="h-4 w-4 mr-1" /> Stop
          </Button>
          <Button size="sm" variant="outline" disabled={status !== "stopped"} onClick={handleDescript} title="Edit in Descript">
            <ExternalLink className="h-4 w-4 mr-1" /> Edit in Descript
          </Button>
        </div>
      </Card>
    </div>
  );
}

