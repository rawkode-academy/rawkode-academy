# YouTube to R2 Migration Tools

This directory contains tools for migrating YouTube videos to Cloudflare R2 storage and managing the uploaded content.

## Features

- Downloads YouTube videos in highest quality (MKV format)
- Extracts audio as MP3 (192k bitrate)
- Downloads highest resolution thumbnail
- Generates unique CUID2 for each video
- Uploads to multiple R2 buckets with specific paths
- Triggers Google Cloud Run transcoding job
- Generates SQL insert statement for video metadata
- Comprehensive error handling and logging

## Requirements

- Python 3.9+
- FFmpeg (for audio extraction)
- uv package manager

## Setup

1. Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Install FFmpeg:
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

3. Create virtual environment and install dependencies:
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e .
```

## Configuration

1. Copy the environment template:
```bash
cp .envrc.example .envrc
```

2. Edit `.envrc` with your credentials:

**Cloudflare R2 - VIDEOS Bucket:**
- `VIDEOS_ENDPOINT`: R2 endpoint URL for videos bucket
- `VIDEOS_ACCESS_KEY`: Access key for videos bucket
- `VIDEOS_SECRET_KEY`: Secret key for videos bucket
- `VIDEOS_BUCKET`: Bucket name for thumbnails

**Cloudflare R2 - CONTENT Bucket:**
- `CONTENT_ENDPOINT`: R2 endpoint URL for content bucket
- `CONTENT_ACCESS_KEY`: Access key for content bucket
- `CONTENT_SECRET_KEY`: Secret key for content bucket
- `CONTENT_BUCKET`: Bucket name for video/audio content

**Google Cloud (optional overrides):**
- `GCP_PROJECT`: Google Cloud project ID (default: `rawkode-academy-production`)
- `GCP_LOCATION`: Cloud Run job location (default: `europe-west2`)
- `GCP_JOB_NAME`: Cloud Run job name (default: `transcoding-job`)
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key JSON

For Google Cloud authentication, either:
- Set `GOOGLE_APPLICATION_CREDENTIALS` to your service account key path, or
- Use `gcloud auth application-default login`

3. Load the environment variables:
```bash
source .envrc
# Or if using direnv:
direnv allow
```

## Usage

```bash
# With 1Password for secrets
op run -- python youtube_to_r2.py YOUTUBE_VIDEO_ID

# Without 1Password (secrets directly in .envrc)
python youtube_to_r2.py YOUTUBE_VIDEO_ID
```

## Example

```bash
# Load environment variables
source .envrc

# Download and process video
python youtube_to_r2.py dQw4w9WgXcQ
```

This will:
1. Generate a unique CUID (e.g., `clq2x3y4z000008l6czsg5bkp`)
2. Download the video in MKV format
3. Extract audio as MP3
4. Download the thumbnail
5. Upload to R2:
   - **CONTENT bucket:**
     - Video: `videos/{cuid}/original.mkv`
     - Audio: `videos/{cuid}/original.mp3`
     - Thumbnail: `videos/{cuid}/thumbnail.jpg`
   - **VIDEOS bucket:**
     - Thumbnail: `{cuid}/thumbnail.jpg`
6. Trigger Google Cloud Run transcoding job with `VIDEO_ID={cuid}`
7. Generate SQL insert statement with all video metadata

## Output Structure

The script organizes files using CUID2 identifiers:
- Each video gets a unique CUID
- All related files (video, audio, thumbnail) are grouped by this CUID
- Thumbnails are duplicated to the VIDEOS bucket for quick access

## SQL Output

The script generates a SQL INSERT statement for the `videos` table with:
- `id`: The generated CUID
- `title`: Video title from YouTube
- `subtitle`: First 200 characters of the description
- `slug`: URL-friendly version of the title
- `description`: Full video description
- `duration`: Video length in seconds
- `publishedAt`: Unix timestamp of the upload date

## Scripts

### youtube_to_r2.py
Downloads YouTube videos, extracts audio, and uploads to Cloudflare R2 buckets.

### migrate_thumbnails.py
Migrates thumbnails from rawkode-academy-videos bucket to rawkode-academy-content bucket.

Usage:
```bash
# Dry run to see what would be migrated
./migrate_thumbnails.py --dry-run

# Perform actual migration
./migrate_thumbnails.py

# Show migration status
./migrate_thumbnails.py --show-state

# Reset migration state
./migrate_thumbnails.py --reset-state
```

The script:
- Lists all thumbnails in the videos bucket (format: `{video_id}/thumbnail.jpg`)
- Copies them to the content bucket (format: `videos/{video_id}/thumbnail.jpg`)
- Tracks progress in a state file to allow resuming
- Skips thumbnails that already exist in the destination
- Provides detailed logging and migration summary