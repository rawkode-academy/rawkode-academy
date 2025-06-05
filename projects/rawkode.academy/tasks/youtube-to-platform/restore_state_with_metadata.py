#!/usr/bin/env python3
"""
Restore state file with full metadata from YouTube.
"""

import json
from pathlib import Path
from datetime import datetime
import sys
import yt_dlp
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if len(sys.argv) != 3:
    print("Usage: python restore_state_with_metadata.py <youtube_id> <cuid>")
    sys.exit(1)

youtube_id = sys.argv[1]
cuid = sys.argv[2]

# Download video info without actually downloading the video
url = f"https://www.youtube.com/watch?v={youtube_id}"
ydl_opts = {
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,  # Get full metadata
    'skip_download': True,  # Don't download the video
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        logger.info(f"Fetching metadata for video: {youtube_id}")
        info = ydl.extract_info(url, download=False)
        
        # Extract key information
        video_info = {
            'title': info.get('title', ''),
            'description': info.get('description', ''),
            'duration': info.get('duration', 0),
            'upload_date': info.get('upload_date', ''),
            'uploader': info.get('uploader', ''),
            'view_count': info.get('view_count', 0),
            'like_count': info.get('like_count', 0),
            'thumbnails': info.get('thumbnails', [])
        }
        
        logger.info(f"Found video: {video_info['title']}")
        logger.info(f"Duration: {video_info['duration']} seconds")
        logger.info(f"Upload date: {video_info['upload_date']}")

except Exception as e:
    logger.error(f"Error fetching video info: {str(e)}")
    sys.exit(1)

# Create state directory
state_dir = Path.home() / '.youtube_to_r2_state'
state_dir.mkdir(exist_ok=True)

# Create state file with completed steps and full metadata
state = {
    'youtube_id': youtube_id,
    'cuid': cuid,
    'video_info': video_info,
    'completed_steps': [
        'video_downloaded',
        'audio_extracted',
        'thumbnail_downloaded',
        'video_uploaded_content',
        'audio_uploaded_content',
        'thumbnail_uploaded_content',
        'thumbnail_uploaded_videos'
    ],
    'artifacts': {},
    'started_at': datetime.now().isoformat(),
    'last_updated': datetime.now().isoformat()
}

state_file = state_dir / f"{youtube_id}.json"
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)

print(f"\nRestored state for {youtube_id} (CUID: {cuid})")
print(f"Title: {video_info['title']}")
print(f"Duration: {video_info['duration']} seconds")
print(f"State file: {state_file}")
print("\nMarked as completed:")
for step in state['completed_steps']:
    print(f"  ✓ {step}")
print("\nRemaining steps:")
print("  ○ cloud_run_triggered")
print("  ○ completed")