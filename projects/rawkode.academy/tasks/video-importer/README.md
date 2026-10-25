# YouTube to R2 Migration Tools

This directory contains tools for migrating YouTube videos to Cloudflare R2 storage and managing the uploaded content.

## Features

- Downloads YouTube videos in highest quality (MKV format)
- Extracts audio as MP3 (192k bitrate)
- Downloads highest resolution thumbnail
- Generates unique CUID2 for each video
- Uploads to multiple R2 buckets with specific paths
- Triggers Google Cloud Run transcoding job
- Creates the video row in the `platform-videos` D1 database (description as plain text plus a TipTap `description_doc`)
- Invalidates the website cache for the video (`POST https://rawkode.academy/api/cache/invalidate`)
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

**Cloudflare D1 and the website cache:**
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account (set in `env.cue`)
- `CLOUDFLARE_API_TOKEN`: API token with D1 edit on `platform-videos` (1Password, `production` environment)
- `VIDEOS_D1_DATABASE_ID` (optional): overrides the `platform-videos` database id
- `CACHE_INVALIDATION_TOKEN` (optional): the website's invalidation token. Without it the importer warns and skips invalidation; the website's hourly change detection picks the row up, or run `just invalidate-content '{"tags":["videos:<cuid>"]}'` in `projects/rawkode.academy/website`.
- `CACHE_INVALIDATION_URL` (optional): defaults to `https://rawkode.academy/api/cache/invalidate`

Pass `--skip-d1` to leave D1 (and the cache) alone and only print the SQL.

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
# Secrets from 1Password via env.cue
cuenv exec -e production -- uv run python youtube_to_r2.py YOUTUBE_VIDEO_ID

# Upload only; print the SQL instead of writing D1
cuenv exec -e production -- uv run python youtube_to_r2.py YOUTUBE_VIDEO_ID --skip-d1

# Unit tests (standard library only)
python -I -m unittest discover -s . -p 'test_*.py'
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
7. Insert the video into `platform-videos` (an existing row is left unchanged)
8. Invalidate the website cache tag `videos:{cuid}`
9. Print the SQL insert statement

## Output Structure

The script organizes files using CUID2 identifiers:
- Each video gets a unique CUID
- All related files (video, audio, thumbnail) are grouped by this CUID
- Thumbnails are duplicated to the VIDEOS bucket for quick access

## D1 Row

The script inserts (and prints) a row in the `platform-videos` `videos` table with:
- `id`: The generated CUID
- `title`: Video title from YouTube
- `subtitle`: First 200 characters of the description
- `slug`: URL-friendly version of the title
- `description`: Full video description (plain text)
- `description_doc`: The description as a TipTap document (`content_api.text_to_doc`: one paragraph per blank-line block, hard breaks for single newlines, bare URLs as links)
- `duration`: Video length in seconds
- `publishedAt`: Unix timestamp of the upload date (UTC)
- `youtube_id`: The YouTube video ID
- `updated_at`: Write time in milliseconds

Shows/episodes, guests, technologies, chapters and transcription terms are rows in their own services (`platform-episodes`, `platform-video-guests`, `platform-video-technologies`, `platform-chapters`, `platform-transcription-terms`); see `.agents/skills/rawkode-academy-video-importer/SKILL.md`.

## Scripts

### youtube_to_r2.py
Downloads YouTube videos, extracts audio, and uploads to Cloudflare R2 buckets.

### descript_to_r2.py
Downloads Descript videos, extracts audio, subtitles, and uploads to Cloudflare R2 buckets.

Like `youtube_to_r2.py`, it then inserts the `platform-videos` row and invalidates the website cache (`--skip-d1` only prints the SQL). Update mode never overwrites the row; it invalidates the cache again.

Usage:
```bash
# Process a new Descript video
python descript_to_r2.py <descript_id> <thumbnail_path>

# Process with a local video file (skip Descript download)
python descript_to_r2.py <descript_id> <thumbnail_path> --local-video <video_path>

# Update an existing video after edits on Descript
python descript_to_r2.py <descript_id> <thumbnail_path> --update
```

#### Update Mode
When you've made edits to a video on Descript and need to re-process it:

```bash
python descript_to_r2.py <descript_id> <thumbnail_path> --update
```

The `--update` flag will:
- Keep the existing CUID (preserving the video ID in your system)
- Re-download the updated video from Descript
- Re-extract audio and process subtitles
- Re-upload all files to R2 (replacing existing files)
- Retrigger the Cloud Run encoding job

**Note:** Update mode requires an existing state file with a CUID. You must process the video normally first before using update mode.

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