# MP3 Extraction Job

A Cloud Run job that extracts MP3 audio from video files stored in Cloudflare R2.

## Overview

This job:
1. Downloads a video file from R2 using the provided video ID
2. Extracts the audio track as MP3 using ffmpeg
3. Uploads the MP3 file back to R2

## Configuration

The job requires the following environment variable:

- `VIDEO_ID` - The ID of the video to process (required)

## Secrets

The service expects Cloudflare R2 credentials to be mounted at `/secrets/cloudflare-r2` with the following JSON structure:

```json
{
  "endpoint": "https://...",
  "bucket": "rawkode-academy-content",
  "accessKeyId": "...",
  "secretAccessKey": "..."
}
```

## Running Locally

```bash
# Install dependencies
deno install

# Run with video ID
VIDEO_ID=some-video-id deno run --allow-all main.ts
```

## Building

```bash
docker build -t mp3-extraction-job .
```

## Deployment

Deploy this as a Cloud Run job that can be triggered by:
- The mp3-extraction-scheduler service
- Cloud Scheduler for batch processing
- Manual execution for specific videos

## Audio Settings

The extracted MP3 uses:
- Codec: libmp3lame
- Bitrate: 192k
- Sample rate: 44100 Hz

These settings provide good quality while keeping file sizes reasonable.