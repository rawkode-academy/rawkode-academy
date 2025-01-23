import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  width?: number;
  height?: number;
	autoPlay?: boolean;
	thumbnailUrl: string;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

export default function VideoPlayer({
	src,
	thumbnailUrl,
  autoPlay = false,
  onError,
  onReady
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: true
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
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = src;
      videoRef.current.addEventListener('loadedmetadata', () => {
        onReady?.();
      });
    } else {
      onError?.(new Error('HLS not supported'));
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
    />
  );
}
