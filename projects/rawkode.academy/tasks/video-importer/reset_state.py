#!/usr/bin/env python3
"""
Reset descript_to_r2 state files to allow re-import while preserving CUIDs.
"""

import json
import sys
from pathlib import Path
import argparse

def reset_state_file(state_file_path):
    """Reset a state file while preserving the CUID."""
    try:
        with open(state_file_path, 'r') as f:
            state = json.load(f)
        
        # Preserve CUID and descript_id
        cuid = state.get('cuid')
        descript_id = state.get('descript_id')
        
        if not cuid:
            print(f"Warning: No CUID found in {state_file_path}")
            return False
        
        # Create a fresh state with only the CUID preserved
        reset_state = {
            'descript_id': descript_id,
            'cuid': cuid,
            'video_info': {},
            'completed_steps': [],  # This is the key - empty list means all steps will be re-done
            'artifacts': {},
            'started_at': state.get('started_at'),
            'last_updated': state.get('last_updated')
        }
        
        # Write the reset state back
        with open(state_file_path, 'w') as f:
            json.dump(reset_state, f, indent=2)
        
        print(f"Reset state for {descript_id} (CUID: {cuid})")
        return True
        
    except Exception as e:
        print(f"Error resetting {state_file_path}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Reset descript_to_r2 state files')
    parser.add_argument('--state-dir', help='State directory (default: ~/.descript_to_r2_state)',
                        default=Path.home() / '.descript_to_r2_state')
    parser.add_argument('--descript-id', help='Reset specific Descript ID only')
    
    args = parser.parse_args()
    
    state_dir = Path(args.state_dir)
    if not state_dir.exists():
        print(f"State directory not found: {state_dir}")
        sys.exit(1)
    
    if args.descript_id:
        # Reset specific file
        state_file = state_dir / f"{args.descript_id}.json"
        if not state_file.exists():
            print(f"State file not found: {state_file}")
            sys.exit(1)
        
        if reset_state_file(state_file):
            print("State reset successfully!")
        else:
            sys.exit(1)
    else:
        # Reset all state files
        state_files = list(state_dir.glob("*.json"))
        if not state_files:
            print(f"No state files found in {state_dir}")
            sys.exit(0)
        
        print(f"Found {len(state_files)} state file(s)")
        success_count = 0
        
        for state_file in state_files:
            if reset_state_file(state_file):
                success_count += 1
        
        print(f"\nReset {success_count}/{len(state_files)} state files successfully")

if __name__ == '__main__':
    main()