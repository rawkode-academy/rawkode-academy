/*
  LocalRecorder uses MediaRecorder to capture high-quality video+audio with 4K constraints when available.
  It streams chunks to R2 via R2MultipartUploader during recording and completes the upload on stop.
*/

import { R2MultipartUploader } from "./R2MultipartUploader";
import { MediabunnyRecorder } from "./MediabunnyRecorder";

export type RecorderStatus = "idle" | "recording" | "paused" | "stopping" | "stopped" | "error";

export interface RecorderOptions {
  sessionId: string;
  trackId: string; // e.g., "host" or participant id
  backendBaseUrl?: string; // default: ''
  preferredFps?: number; // default 30
}

export class LocalRecorder {
  private status: RecorderStatus = "idle";
  private mediaStream?: MediaStream;
  private recorder?: MediaRecorder;
  private uploader: R2MultipartUploader;
  private previewEl?: HTMLVideoElement;
  private wcRecorder?: MediabunnyRecorder;

  constructor(private opts: RecorderOptions) {
    const base = opts.backendBaseUrl || "";
    this.uploader = new R2MultipartUploader(base, opts.sessionId, opts.trackId, { capKbps: 500 });
  }

  getStatus() {
    return this.status;
  }

  async start(preview?: HTMLVideoElement) {
    if (this.status === "recording") return;
    this.status = "recording";
    this.previewEl = preview;

    // Prefer MediaRecorder MP4 when supported (Safari, some Chromium variants)
    const supportsMp4 = pickBestMimeType() !== "" && (MediaRecorder as any).isTypeSupported?.("video/mp4");
    if (!supportsMp4) {
      // Use Mediabunny (WebCodecs) path for Chrome/Edge
      this.wcRecorder = new MediabunnyRecorder({
        sessionId: this.opts.sessionId,
        trackId: this.opts.trackId,
        backendBaseUrl: this.opts.backendBaseUrl,
        width: 3840,
        height: 2160,
        fps: this.opts.preferredFps ?? 30,
        videoBitrate: 25_000_000,
        audioBitrate: 192_000,
        uploadCapKbps: 500,
      });
      await this.wcRecorder.start(preview);
      return;
    }

    // Fallback: MediaRecorder (MP4 if supported, else browser default)
    const fps = this.opts.preferredFps ?? 30;
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 2,
        sampleRate: 48000,
        noiseSuppression: false,
        echoCancellation: false,
      },
      video: {
        width: { ideal: 3840, max: 3840 },
        height: { ideal: 2160, max: 2160 },
        frameRate: { ideal: fps, max: Math.min(60, fps) },
      },
    } as MediaStreamConstraints;
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (this.previewEl) {
      this.previewEl.srcObject = this.mediaStream;
      this.previewEl.muted = true;
      await this.previewEl.play().catch(() => {});
    }
    const mimeType = pickBestMimeType();
    const recorder = new MediaRecorder(this.mediaStream, {
      mimeType,
      videoBitsPerSecond: 25_000_000,
      audioBitsPerSecond: 256_000,
    });
    this.recorder = recorder;

    recorder.addEventListener("dataavailable", async (ev) => {
      if (!ev.data || ev.data.size === 0) return;
      const buf = new Uint8Array(await ev.data.arrayBuffer());
      try {
        await this.uploader.pushChunk(buf);
      } catch (e) {
        console.error("upload chunk failed", e);
      }
    });
    recorder.addEventListener("stop", async () => {
      try {
        await this.uploader.complete();
      } catch (e) {
        console.error("complete failed", e);
      }
      this.status = "stopped";
    });
    recorder.addEventListener("error", (e) => {
      console.error("recorder error", e);
      this.status = "error";
    });
    recorder.start(4000);
  }

  pause() {
    if (this.wcRecorder && (this.status === "recording" || this.status === "paused")) return this.wcRecorder.pause();
    if (this.recorder && this.status === "recording") {
      this.recorder.pause();
      this.status = "paused";
    }
  }

  resume() {
    if (this.wcRecorder && this.status === "paused") return this.wcRecorder.resume();
    if (this.recorder && this.status === "paused") {
      this.recorder.resume();
      this.status = "recording";
    }
  }

  async stop() {
    if (this.wcRecorder && (this.status === "recording" || this.status === "paused")) {
      this.status = "stopping";
      await this.wcRecorder.stop();
      this.status = "stopped";
      return;
    }
    if (this.recorder && (this.status === "recording" || this.status === "paused")) {
      this.status = "stopping";
      this.recorder.stop();
      // Give some time for final dataavailable
      await new Promise((r) => setTimeout(r, 100));
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = undefined;
    }
  }
}

function pickBestMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    // @ts-ignore MediaRecorder exists in browser
    if ((globalThis as any).MediaRecorder && (MediaRecorder as any).isTypeSupported?.(c)) return c;
  }
  // Let browser decide a default
  return "";
}
