#!/usr/bin/env python3
"""
Create a state file with a specific CUID for descript_to_r2.
"""

import json
import sys
from pathlib import Path
import argparse
from datetime import datetime

def create_state_with_cuid(descript_id, cuid, state_dir):
    """Create a state file with a specific CUID."""
    state_dir = Path(state_dir)
    state_dir.mkdir(exist_ok=True)
    
    state_file = state_dir / f"{descript_id}.json"
    
    state = {
        'descript_id': descript_id,
        'cuid': cuid,
        'video_info': {},
        'completed_steps': [],
        'artifacts': {},
        'started_at': datetime.now().isoformat(),
        'last_updated': datetime.now().isoformat()
    }
    
    with open(state_file, 'w') as f:
        json.dump(state, f, indent=2)
    
    print(f"Created state file: {state_file}")
    print(f"Descript ID: {descript_id}")
    print(f"CUID: {cuid}")

def main():
    parser = argparse.ArgumentParser(description='Create state file with specific CUID')
    parser.add_argument('descript_id', help='Descript ID (e.g., OsxdwbYAhvG)')
    parser.add_argument('cuid', help='CUID to use for this video')
    parser.add_argument('--state-dir', help='State directory (default: ~/.descript_to_r2_state)',
                        default=Path.home() / '.descript_to_r2_state')
    
    args = parser.parse_args()
    
    create_state_with_cuid(args.descript_id, args.cuid, args.state_dir)

if __name__ == '__main__':
    main()