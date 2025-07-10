#!/usr/bin/env python3
"""
Create a resume state file for a video that was partially processed.
"""

import json
from pathlib import Path
from datetime import datetime
import sys

if len(sys.argv) != 3:
    print("Usage: python create_resume_state.py <youtube_id> <cuid>")
    sys.exit(1)

youtube_id = sys.argv[1]
cuid = sys.argv[2]

# Create state directory
state_dir = Path.home() / '.youtube_to_r2_state'
state_dir.mkdir(exist_ok=True)

# Create state file with completed steps based on your output
state = {
    'youtube_id': youtube_id,
    'cuid': cuid,
    'video_info': {},
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

print(f"Created resume state for {youtube_id} (CUID: {cuid})")
print(f"State file: {state_file}")
print("\nMarked as completed:")
for step in state['completed_steps']:
    print(f"  ✓ {step}")
print("\nRemaining steps:")
print("  ○ cloud_run_triggered")
print("  ○ completed")