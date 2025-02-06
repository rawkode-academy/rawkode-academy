import { useEffect, useRef } from "react";
import Hls from "hls.js";

interface VideoPlayerProps {
	videoId: string;
	width?: number;
	height?: number;
	autoPlay?: boolean;
	thumbnailUrl: string;
	onError?: (error: Error) => void;
	onReady?: () => void;
}

type VideoAnalyticsEvent =
	| VideoStartedEvent
	| VideoPausedEvent
	| VideoSeekedEvent
	| VideoCompletedEvent
	| VideoProgressedEvent;

interface VideoStartedEvent {
	action: "video_started";
	videoId: string;
	seconds: number;
}

interface VideoPausedEvent {
	action: "video_paused";
	videoId: string;
	seconds: number;
}

interface VideoSeekedEvent {
	action: "video_seeked";
	videoId: string;
	seconds: number;
}

interface VideoCompletedEvent {
	action: "video_completed";
	videoId: string;
}

interface VideoProgressedEvent {
	action: "video_progressed";
	videoId: string;
	percent: number;
}

declare global {
	interface Window {
		faro?: {
			api: {
				pushEvent: (name: string, attributes: Record<string, unknown>) => void;
			};
		};
	}
}

function trackVideoEvent(event: VideoAnalyticsEvent) {
	if (!window.faro) {
		console.warn("Faro not initialized, skipping video event tracking");
		return;
	}

	const action = event.action;

	window.faro.api.pushEvent(action, {
		...Object.fromEntries(
			Object.entries(event).filter(([key, _]) => key !== "action").map((
				[key, value],
			) => [key, String(value)]),
		),
	});
}

export default function VideoPlayer({
	videoId,
	thumbnailUrl,
	autoPlay = false,
	onError,
	onReady,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const progressMilestonesRef = useRef<Set<number>>(new Set());
	const src = `https://videos.rawkode.academy/${videoId}/stream.m3u8`;

	useEffect(() => {
		if (!videoRef.current) return;

		if (Hls.isSupported()) {
			hlsRef.current = new Hls({
				enableWorker: true,
				lowLatencyMode: true,
			});

			hlsRef.current.loadSource(src);
			hlsRef.current.attachMedia(videoRef.current);

			hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
				onReady?.();
				if (autoPlay) {
					videoRef.current?.play();
				}
			});

			hlsRef.current.on(Hls.Events.ERROR, (_, data) => {
				if (data.fatal) {
					onError?.(new Error(data.details));
				}
			});
		} else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
			// Native HLS support (Safari)
			videoRef.current.src = src;
			videoRef.current.addEventListener("loadedmetadata", () => {
				onReady?.();
			});
		} else {
			onError?.(new Error("HLS not supported"));
		}

		return () => {
			if (hlsRef.current) {
				hlsRef.current.destroy();
			}
		};
	}, [src, autoPlay]);

	return (
		<video
			ref={videoRef}
			width="100%"
			controls
			playsInline
			poster={thumbnailUrl}
			onPlay={() => {
				const event: VideoStartedEvent = {
					action: "video_started",
					videoId,
					seconds: videoRef.current?.currentTime || 0,
				};
				trackVideoEvent(event);
			}}
			onPause={() => {
				const event: VideoPausedEvent = {
					action: "video_paused",
					videoId,
					seconds: videoRef.current?.currentTime || 0,
				};
				trackVideoEvent(event);
			}}
			onSeeked={() => {
				const event: VideoSeekedEvent = {
					action: "video_seeked",
					videoId,
					seconds: videoRef.current?.currentTime || 0,
				};
				trackVideoEvent(event);
			}}
			onTimeUpdate={() => {
				if (!videoRef.current) return;
				const progress = Math.floor(
					(videoRef.current.currentTime / videoRef.current.duration) * 100,
				);

				// Check for specific milestones (5%, 10%, 25%, 50%, 75%, 95%)
				const milestones = [5, 10, 25, 50, 75, 95];
				for (const milestone of milestones) {
					if (
						progress >= milestone &&
						!progressMilestonesRef.current.has(milestone)
					) {
						progressMilestonesRef.current.add(milestone);
						const event: VideoProgressedEvent = {
							action: "video_progressed",
							videoId,
							percent: milestone,
						};
						trackVideoEvent(event);
					}
				}
			}}
			onEnded={() => {
				const event: VideoCompletedEvent = {
					action: "video_completed",
					videoId,
				};
				trackVideoEvent(event);
			}}
		/>
	);
}
