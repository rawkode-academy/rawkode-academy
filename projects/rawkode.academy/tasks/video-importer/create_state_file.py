#!/usr/bin/env python3
"""
Create a state file for a YouTube video with all metadata needed for SQL generation.
This is useful for testing or recovering from incomplete processing.
"""

import argparse
import json
import logging
from pathlib import Path
from datetime import datetime
import yt_dlp
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def download_video_info(youtube_id):
    """Download video metadata from YouTube."""
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
            return info
    except Exception as e:
        logger.error(f"Error fetching video metadata: {str(e)}")
        raise


def create_state_file(youtube_id, cuid, state_dir=None, completed_steps=None):
    """Create a state file with specified CUID and metadata."""
    state_dir = state_dir or Path.home() / '.youtube_to_r2_state'
    state_dir = Path(state_dir)
    state_dir.mkdir(exist_ok=True)
    
    state_file = state_dir / f"{youtube_id}.json"
    
    # Fetch video metadata
    video_info = download_video_info(youtube_id)
    
    # Default completed steps if not specified
    if completed_steps is None:
        completed_steps = [
            'video_downloaded',
            'audio_extracted',
            'thumbnail_downloaded',
            'video_uploaded_content',
            'audio_uploaded_content',
            'thumbnail_uploaded_content',
            'thumbnail_uploaded_videos',
            'cloud_run_triggered'
        ]
    
    # Create state structure
    state = {
        'youtube_id': youtube_id,
        'cuid': cuid,
        'video_info': video_info,
        'completed_steps': completed_steps,
        'artifacts': {
            'video_path': f'/tmp/{youtube_id}.mkv',
            'audio_path': f'/tmp/audio.mp3',
            'thumbnail_path': f'/tmp/thumbnail.jpg',
            'cloud_run_operation': 'projects/rawkode-academy-production/locations/europe-west2/operations/mock-operation'
        },
        'started_at': datetime.now().isoformat(),
        'last_updated': datetime.now().isoformat()
    }
    
    # Write state file
    with open(state_file, 'w') as f:
        json.dump(state, f, indent=2)
    
    logger.info(f"State file created: {state_file}")
    
    # Display key information
    print(f"\nState file created for YouTube ID: {youtube_id}")
    print(f"CUID: {cuid}")
    print(f"Title: {video_info.get('title', 'Unknown')}")
    print(f"Duration: {video_info.get('duration', 0)} seconds")
    print(f"Upload Date: {video_info.get('upload_date', 'Unknown')}")
    print(f"\nCompleted Steps:")
    for step in completed_steps:
        print(f"  ✓ {step}")
    
    return state_file


def main():
    parser = argparse.ArgumentParser(description='Create a state file for YouTube video processing')
    parser.add_argument('youtube_id', help='YouTube video ID')
    parser.add_argument('cuid', help='CUID to use for this video')
    parser.add_argument('--state-dir', help='Directory to store state files')
    parser.add_argument('--steps', nargs='+', help='List of completed steps (default: all except completed)',
                       choices=[
                           'video_downloaded',
                           'audio_extracted', 
                           'thumbnail_downloaded',
                           'video_uploaded_content',
                           'audio_uploaded_content',
                           'thumbnail_uploaded_content',
                           'thumbnail_uploaded_videos',
                           'cloud_run_triggered',
                           'completed'
                       ])
    
    args = parser.parse_args()
    
    try:
        state_file = create_state_file(
            args.youtube_id,
            args.cuid,
            state_dir=args.state_dir,
            completed_steps=args.steps
        )
        print(f"\nState file location: {state_file}")
        
    except Exception as e:
        logger.error(f"Failed to create state file: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()