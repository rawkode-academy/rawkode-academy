# Video Categorizer

This tool fetches all videos from the Rawkode Academy GraphQL API and helps categorize them into shows.

## Setup

```bash
# Install dependencies with uv
uv sync
```

## Usage

```bash
uv run categorize_videos.py
```

The script will:

1. Fetch all videos from the API (sorted by publication date)
2. Present each video with its title, publication date, and description
3. Prompt you to:
   - Assign to `rawkode-live`
   - Assign to `klustered`
   - Mark as `no show` (skip)
   - Mark for deletion
4. Save progress automatically (can resume if interrupted)

## Output Files

- `episodes.sql` - SQL INSERT statements for the episodes table (uses video ID as the code)
- `videos_to_delete.txt` - List of videos marked for deletion
- `categorization_state.json` - Progress state (allows resuming)

## Resume Feature

The script saves progress every 10 videos and when you quit (press 'q' or Ctrl+C).
Run the script again to continue from where you left off.

## SQL Schema

The generated SQL is for this schema:

```sql
CREATE TABLE episodes (
    videoId TEXT PRIMARY KEY,
    showId TEXT NOT NULL,
    code TEXT NOT NULL,
    UNIQUE(showId, code)
);
```

Note: The `code` field is set to the same value as `videoId` for now.

## Deleting Videos from R2

After categorizing videos, you can delete the marked videos from Cloudflare R2:

### Dry Run (see what would be deleted)
```bash
uv run delete_from_r2.py --dry-run
```

### Actual Deletion
```bash
uv run delete_from_r2.py
```

This script requires the same R2 environment variables as the video importer:
- `VIDEOS_ENDPOINT`, `VIDEOS_ACCESS_KEY`, `VIDEOS_SECRET_KEY`, `VIDEOS_BUCKET`
- `CONTENT_ENDPOINT`, `CONTENT_ACCESS_KEY`, `CONTENT_SECRET_KEY`, `CONTENT_BUCKET`

The script will:
- Read video IDs from `videos_to_delete.txt`
- List all objects with each video ID prefix in both buckets
- Delete all matching objects (after confirmation)
- Show a summary of deletions