/*
  MediabunnyRecorder
  - Uses Mediabunny Output + MediaStream sources to encode H.264 video and AAC/FLAC audio
  - Writes fragmented MP4 via StreamTarget in append-only mode, streaming to R2MultipartUploader
  - Targets 4K 30fps when available
*/

import { R2MultipartUploader } from "./R2MultipartUploader";
import { Output, StreamTarget, Mp4OutputFormat, MediaStreamVideoTrackSource, MediaStreamAudioTrackSource, type StreamTargetChunk } from "mediabunny";
import { getFirstEncodableAudioCodec } from "mediabunny";

export type MBRecorderStatus = "idle" | "recording" | "paused" | "stopping" | "stopped" | "error";

export interface MBRecorderOptions {
  sessionId: string;
  trackId: string; // e.g., "host"
  backendBaseUrl?: string;
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: number; // bps
  audioBitrate?: number; // bps
  uploadCapKbps?: number;
}

export class MediabunnyRecorder {
  private status: MBRecorderStatus = "idle";
  private output?: Output;
  private mediaStream?: MediaStream;
  private uploader: R2MultipartUploader;
  private previewEl?: HTMLVideoElement;

  constructor(private opts: MBRecorderOptions) {
    const base = opts.backendBaseUrl || "";
    this.uploader = new R2MultipartUploader(base, opts.sessionId, opts.trackId, {
      capKbps: opts.uploadCapKbps ?? 500,
    });
  }

  getStatus() {
    return this.status;
  }

  async start(preview?: HTMLVideoElement) {
    if (this.status === "recording") return;
    this.status = "recording";
    this.previewEl = preview;

    const width = this.opts.width ?? 3840;
    const height = this.opts.height ?? 2160;
    const fps = this.opts.fps ?? 30;

    // Acquire media
    const constraints: MediaStreamConstraints = {
      audio: {
        channelCount: 2,
        sampleRate: 48000,
        noiseSuppression: false,
        echoCancellation: false,
      },
      video: {
        width: { ideal: width, max: width },
        height: { ideal: height, max: height },
        frameRate: { ideal: fps, max: Math.min(60, fps) },
      },
    } as MediaStreamConstraints;
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (this.previewEl) {
      this.previewEl.srcObject = this.mediaStream;
      this.previewEl.muted = true;
      await this.previewEl.play().catch(() => {});
    }

    // StreamTarget that writes data chunks to R2 uploader
    const target = new StreamTarget(
      new WritableStream<StreamTargetChunk>({
        write: async (chunk) => {
          // Append sequential bytes to R2 multipart uploader
          await this.uploader.pushChunk(chunk.data);
        },
      }),
      { chunked: true, chunkSize: 6 * 1024 * 1024 },
    );

    // Configure MP4 output with append-only fragmented mode
    const format = new Mp4OutputFormat({
      fastStart: "fragmented",
      minimumFragmentDuration: 2,
    });
    const output = new Output({ target, format });
    this.output = output;

    // Video source (H.264)
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    const videoSource = new MediaStreamVideoTrackSource(
      videoTrack as MediaStreamVideoTrack,
      {
        codec: "avc",
        bitrate: this.opts.videoBitrate ?? 25_000_000,
      },
    );
    output.addVideoTrack(videoSource, { frameRate: fps });

    // Audio source: prefer AAC, else FLAC, else PCM16
    const audioTrack = this.mediaStream.getAudioTracks()[0];
    if (audioTrack) {
      const audioCodec = await getFirstEncodableAudioCodec(["aac", "flac", "pcm-s16"], {
        sampleRate: 48000,
        numberOfChannels: 2,
      });
      const audioSource = new MediaStreamAudioTrackSource(
        audioTrack as MediaStreamAudioTrack,
        {
          codec: audioCodec ?? "pcm-s16",
          bitrate: this.opts.audioBitrate ?? 192_000,
        },
      );
      output.addAudioTrack(audioSource);
    }

    // Start muxing/encoding
    await output.start();
  }

  pause() {
    // Mediabunny currently doesn’t expose a pause on Output; we can stop feeding frames by disabling tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => (t.enabled = false));
    }
    this.status = "paused";
  }

  resume() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => (t.enabled = true));
    }
    this.status = "recording";
  }

  async stop() {
    if (this.status !== "recording" && this.status !== "paused") return;
    this.status = "stopping";
    try {
      await this.output?.finalize();
    } catch (e) {
      console.warn("finalize error", e);
    }
    try {
      await this.uploader.complete();
    } catch (e) {
      console.warn("uploader complete error", e);
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.status = "stopped";
  }
}
