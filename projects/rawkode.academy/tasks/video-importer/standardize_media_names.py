#!/usr/bin/env python3
"""
Standardize media file names in R2 bucket:
- original.mkv -> video.mkv
- {videoId}.mkv -> video.mkv  
- {videoId}.mp3 -> audio.mp3
- original.mp3 -> audio.mp3
"""

import os
import sys
import logging
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import json
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

logging.basicConfig(
    level=logging.DEBUG if os.environ.get('DEBUG') else logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MediaNameStandardizer:
    def __init__(self, content_endpoint, content_access_key, content_secret_key, content_bucket):
        self.content_bucket = content_bucket
        
        logger.info(f"Initializing MediaNameStandardizer...")
        logger.info(f"Content bucket: {content_bucket}")
        
        # S3 client for content bucket
        self.client = boto3.client(
            's3',
            endpoint_url=content_endpoint,
            aws_access_key_id=content_access_key,
            aws_secret_access_key=content_secret_key,
            region_name='auto'
        )
        
        # State file for tracking progress
        self.state_file = Path.home() / '.media_standardization_state.json'
        self.state = self._load_state()
        self.state_lock = threading.Lock()
    
    def _load_state(self):
        """Load migration state from file."""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load state file: {e}. Starting fresh.")
        
        return {
            'renamed': [],
            'failed': [],
            'skipped': [],
            'started_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat()
        }
    
    def _save_state(self):
        """Save current state to disk."""
        with self.state_lock:
            self.state['last_updated'] = datetime.now().isoformat()
            try:
                with open(self.state_file, 'w') as f:
                    json.dump(self.state, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to save state: {e}")
    
    def list_video_ids(self):
        """List all unique video IDs (directories) in the bucket."""
        video_ids = set()
        paginator = self.client.get_paginator('list_objects_v2')
        
        logger.info("Discovering video IDs in bucket...")
        
        try:
            # Look for videos/ prefix
            for page in paginator.paginate(Bucket=self.content_bucket, Prefix='videos/', Delimiter='/'):
                if 'CommonPrefixes' in page:
                    for prefix in page['CommonPrefixes']:
                        # Extract video ID from videos/{id}/
                        parts = prefix['Prefix'].split('/')
                        if len(parts) >= 2 and parts[0] == 'videos':
                            video_ids.add(parts[1])
            
            logger.info(f"Found {len(video_ids)} video IDs")
            return list(video_ids)
            
        except ClientError as e:
            logger.error(f"Error listing video IDs: {e}")
            raise
    
    def check_file_exists(self, key):
        """Check if a file exists."""
        try:
            self.client.head_object(Bucket=self.content_bucket, Key=key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            else:
                logger.error(f"Error checking {key}: {e}")
                raise
    
    def copy_file(self, source_key, dest_key):
        """Copy a file within the same bucket."""
        try:
            # Use server-side copy
            copy_source = {'Bucket': self.content_bucket, 'Key': source_key}
            self.client.copy_object(
                CopySource=copy_source,
                Bucket=self.content_bucket,
                Key=dest_key
            )
            return True
        except Exception as e:
            logger.error(f"Error copying {source_key} to {dest_key}: {e}")
            return False
    
    def delete_file(self, key):
        """Delete a file."""
        try:
            self.client.delete_object(Bucket=self.content_bucket, Key=key)
            return True
        except Exception as e:
            logger.error(f"Error deleting {key}: {e}")
            return False
    
    def process_video_files(self, video_id):
        """Process and standardize files for a single video."""
        base_path = f"videos/{video_id}"
        changes = []
        
        # Check if already processed
        with self.state_lock:
            if any(item['video_id'] == video_id for item in self.state['renamed']):
                return {'status': 'skipped', 'reason': 'already_processed', 'video_id': video_id}
        
        # Define possible source files and their standard names
        file_mappings = [
            # Video files
            (f"{base_path}/original.mkv", f"{base_path}/video.mkv"),
            (f"{base_path}/{video_id}.mkv", f"{base_path}/video.mkv"),
            # Audio files
            (f"{base_path}/original.mp3", f"{base_path}/audio.mp3"),
            (f"{base_path}/{video_id}.mp3", f"{base_path}/audio.mp3"),
        ]
        
        for source, dest in file_mappings:
            # Skip if destination already exists
            if self.check_file_exists(dest):
                logger.debug(f"{dest} already exists")
                continue
            
            # Check if source exists
            if self.check_file_exists(source):
                logger.info(f"Found {source} -> will rename to {dest}")
                changes.append((source, dest))
        
        if not changes:
            return {'status': 'skipped', 'reason': 'no_changes_needed', 'video_id': video_id}
        
        # Perform the renames
        success = True
        renamed_files = []
        
        for source, dest in changes:
            logger.info(f"Renaming {source} -> {dest}")
            if self.copy_file(source, dest):
                renamed_files.append({'source': source, 'dest': dest})
                # Delete the original after successful copy
                if not self.delete_file(source):
                    logger.warning(f"Failed to delete original file: {source}")
            else:
                success = False
                break
        
        if success and renamed_files:
            with self.state_lock:
                self.state['renamed'].append({
                    'video_id': video_id,
                    'files': renamed_files,
                    'timestamp': datetime.now().isoformat()
                })
            return {'status': 'renamed', 'video_id': video_id, 'count': len(renamed_files)}
        elif not success:
            with self.state_lock:
                self.state['failed'].append({
                    'video_id': video_id,
                    'timestamp': datetime.now().isoformat()
                })
            return {'status': 'failed', 'video_id': video_id}
        else:
            return {'status': 'skipped', 'reason': 'no_files', 'video_id': video_id}
    
    def standardize_names(self, dry_run=False, max_workers=10):
        """Standardize all media file names."""
        logger.info("="*60)
        logger.info("Starting media name standardization...")
        logger.info(f"Max parallel workers: {max_workers}")
        logger.info("="*60)
        
        if dry_run:
            logger.info("DRY RUN MODE - No actual renaming will be performed")
        
        # Get all video IDs
        video_ids = self.list_video_ids()
        total = len(video_ids)
        
        if total == 0:
            logger.warning("No video IDs found in bucket!")
            return
        
        # Statistics
        stats = {
            'renamed': 0,
            'skipped': 0,
            'failed': 0,
            'files_renamed': 0
        }
        
        logger.info(f"\nProcessing {total} video IDs...\n")
        
        if dry_run:
            # In dry run, just check what would be done
            for i, video_id in enumerate(video_ids, 1):
                base_path = f"videos/{video_id}"
                changes_needed = []
                
                # Check what needs renaming
                mappings = [
                    (f"{base_path}/original.mkv", f"{base_path}/video.mkv"),
                    (f"{base_path}/{video_id}.mkv", f"{base_path}/video.mkv"),
                    (f"{base_path}/original.mp3", f"{base_path}/audio.mp3"),
                    (f"{base_path}/{video_id}.mp3", f"{base_path}/audio.mp3"),
                ]
                
                for source, dest in mappings:
                    if self.check_file_exists(source) and not self.check_file_exists(dest):
                        changes_needed.append((source, dest))
                
                if changes_needed:
                    logger.info(f"[{i}/{total}] {video_id}: Would rename {len(changes_needed)} files:")
                    for source, dest in changes_needed:
                        logger.info(f"  - {source} -> {dest}")
                    stats['renamed'] += 1
                    stats['files_renamed'] += len(changes_needed)
                else:
                    stats['skipped'] += 1
                
                if i % 100 == 0:
                    logger.info(f"Progress: {i}/{total} checked")
        else:
            # Process in parallel
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all tasks
                future_to_video = {executor.submit(self.process_video_files, vid): vid 
                                   for vid in video_ids}
                
                # Process completed tasks
                for i, future in enumerate(as_completed(future_to_video), 1):
                    video_id = future_to_video[future]
                    try:
                        result = future.result()
                        
                        if result['status'] == 'renamed':
                            stats['renamed'] += 1
                            stats['files_renamed'] += result['count']
                            logger.info(f"[{i}/{total}] ✓ Renamed {result['count']} files for {video_id}")
                        elif result['status'] == 'skipped':
                            stats['skipped'] += 1
                            if result['reason'] != 'no_changes_needed':
                                logger.debug(f"[{i}/{total}] ⚠ Skipped {video_id}: {result['reason']}")
                        elif result['status'] == 'failed':
                            stats['failed'] += 1
                            logger.error(f"[{i}/{total}] ✗ Failed: {video_id}")
                        
                        # Progress update
                        if i % 10 == 0:
                            logger.info(f"\nProgress: {i}/{total} - Renamed: {stats['renamed']} videos "
                                       f"({stats['files_renamed']} files), Skipped: {stats['skipped']}, "
                                       f"Failed: {stats['failed']}\n")
                        
                        # Save state periodically
                        if i % 50 == 0:
                            self._save_state()
                            
                    except Exception as e:
                        logger.error(f"Error processing {video_id}: {e}")
                        stats['failed'] += 1
            
            # Final state save
            self._save_state()
        
        # Summary
        logger.info("\n" + "="*60)
        logger.info("STANDARDIZATION COMPLETE")
        logger.info("="*60)
        logger.info(f"Total video IDs processed: {total}")
        logger.info(f"✓ Videos with renamed files: {stats['renamed']}")
        logger.info(f"✓ Total files renamed: {stats['files_renamed']}")
        logger.info(f"⚠ Skipped (no changes needed): {stats['skipped']}")
        logger.info(f"✗ Failed: {stats['failed']}")
        logger.info("="*60)
        
        return stats
    
    def reset_state(self):
        """Reset the state."""
        if self.state_file.exists():
            self.state_file.unlink()
            logger.info("State file removed")
        self.state = self._load_state()
    
    def show_state(self):
        """Display current state."""
        print(f"\nStandardization State:")
        print(f"Started: {self.state['started_at']}")
        print(f"Last Updated: {self.state['last_updated']}")
        print(f"\nRenamed: {len(self.state['renamed'])} videos")
        print(f"Failed: {len(self.state['failed'])}")
        print(f"Skipped: {len(self.state['skipped'])}")
        
        # Count total files renamed
        total_files = sum(len(item['files']) for item in self.state['renamed'])
        print(f"Total files renamed: {total_files}")
        
        if self.state['failed']:
            print("\nFailed videos:")
            for item in self.state['failed'][:10]:
                print(f"  - {item['video_id']} at {item['timestamp']}")
            if len(self.state['failed']) > 10:
                print(f"  ... and {len(self.state['failed']) - 10} more")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Standardize media file names in R2 bucket')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without actually doing it')
    parser.add_argument('--reset-state', action='store_true', help='Reset state and start fresh')
    parser.add_argument('--show-state', action='store_true', help='Show current state and exit')
    parser.add_argument('--workers', type=int, default=10, help='Number of parallel workers (default: 10)')
    
    args = parser.parse_args()
    
    # Get required environment variables
    content_endpoint = os.environ.get('CONTENT_ENDPOINT')
    content_access_key = os.environ.get('CONTENT_ACCESS_KEY')
    content_secret_key = os.environ.get('CONTENT_SECRET_KEY')
    content_bucket = os.environ.get('CONTENT_BUCKET', 'rawkode-academy-content')
    
    # Validate required environment variables
    missing_vars = []
    if not content_endpoint:
        missing_vars.append('CONTENT_ENDPOINT')
    if not content_access_key:
        missing_vars.append('CONTENT_ACCESS_KEY')
    if not content_secret_key:
        missing_vars.append('CONTENT_SECRET_KEY')
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set these in your .envrc file")
        sys.exit(1)
    
    logger.info(f"Creating MediaNameStandardizer instance...")
    
    try:
        standardizer = MediaNameStandardizer(
            content_endpoint,
            content_access_key,
            content_secret_key,
            content_bucket
        )
        
        if args.show_state:
            standardizer.show_state()
            sys.exit(0)
        
        if args.reset_state:
            standardizer.reset_state()
            logger.info("State reset")
            if not args.dry_run:
                sys.exit(0)
        
        # Perform standardization
        results = standardizer.standardize_names(dry_run=args.dry_run, max_workers=args.workers)
        
        if results and results.get('failed', 0) > 0:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Standardization failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()