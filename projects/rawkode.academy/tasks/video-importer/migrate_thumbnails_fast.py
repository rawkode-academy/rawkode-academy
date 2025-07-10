#!/usr/bin/env python3
"""
Optimized thumbnail migrator using parallel operations and smarter listing.
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


class FastThumbnailMigrator:
    def __init__(self, videos_endpoint, videos_access_key, videos_secret_key, videos_bucket,
                 content_endpoint, content_access_key, content_secret_key, content_bucket):
        self.videos_bucket = videos_bucket
        self.content_bucket = content_bucket
        
        logger.info(f"Initializing FastThumbnailMigrator...")
        logger.info(f"Videos bucket: {videos_bucket}")
        logger.info(f"Content bucket: {content_bucket}")
        
        # S3 client for videos bucket
        self.videos_client = boto3.client(
            's3',
            endpoint_url=videos_endpoint,
            aws_access_key_id=videos_access_key,
            aws_secret_access_key=videos_secret_key,
            region_name='auto'
        )
        
        # S3 client for content bucket
        self.content_client = boto3.client(
            's3',
            endpoint_url=content_endpoint,
            aws_access_key_id=content_access_key,
            aws_secret_access_key=content_secret_key,
            region_name='auto'
        )
        
        # State file for tracking progress
        self.state_file = Path.home() / '.thumbnail_migration_state.json'
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
            'migrated': [],
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
        paginator = self.videos_client.get_paginator('list_objects_v2')
        
        logger.info("Discovering video IDs in bucket...")
        
        try:
            # Use delimiter to get "directories"
            for page in paginator.paginate(Bucket=self.videos_bucket, Delimiter='/'):
                if 'CommonPrefixes' in page:
                    for prefix in page['CommonPrefixes']:
                        video_id = prefix['Prefix'].rstrip('/')
                        video_ids.add(video_id)
            
            logger.info(f"Found {len(video_ids)} video IDs")
            return list(video_ids)
            
        except ClientError as e:
            logger.error(f"Error listing video IDs: {e}")
            raise
    
    def check_thumbnail_exists(self, video_id, bucket_client, bucket_name, key):
        """Check if a specific thumbnail exists."""
        try:
            bucket_client.head_object(Bucket=bucket_name, Key=key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            else:
                logger.error(f"Error checking {key}: {e}")
                raise
    
    def process_video_thumbnail(self, video_id):
        """Process a single video's thumbnail."""
        source_key = f"{video_id}/thumbnail.jpg"
        dest_key = f"videos/{video_id}/thumbnail.jpg"
        
        # Check if already processed
        with self.state_lock:
            if any(item['video_id'] == video_id for item in self.state['migrated']):
                return {'status': 'skipped', 'reason': 'already_migrated', 'video_id': video_id}
            
            if any(item['video_id'] == video_id for item in self.state['failed']):
                return {'status': 'skipped', 'reason': 'previously_failed', 'video_id': video_id}
        
        # Check if thumbnail exists in source
        if not self.check_thumbnail_exists(video_id, self.videos_client, self.videos_bucket, source_key):
            logger.debug(f"No thumbnail for {video_id}")
            return {'status': 'skipped', 'reason': 'no_thumbnail', 'video_id': video_id}
        
        # Check if already exists in destination
        if self.check_thumbnail_exists(video_id, self.content_client, self.content_bucket, dest_key):
            with self.state_lock:
                self.state['skipped'].append({
                    'video_id': video_id,
                    'reason': 'already_exists',
                    'timestamp': datetime.now().isoformat()
                })
            return {'status': 'skipped', 'reason': 'already_exists', 'video_id': video_id}
        
        # Copy thumbnail
        try:
            # Download
            response = self.videos_client.get_object(
                Bucket=self.videos_bucket,
                Key=source_key
            )
            thumbnail_data = response['Body'].read()
            
            # Upload
            self.content_client.put_object(
                Bucket=self.content_bucket,
                Key=dest_key,
                Body=thumbnail_data,
                ContentType='image/jpeg'
            )
            
            with self.state_lock:
                self.state['migrated'].append({
                    'video_id': video_id,
                    'source_key': source_key,
                    'timestamp': datetime.now().isoformat()
                })
            
            return {'status': 'migrated', 'video_id': video_id, 'size': len(thumbnail_data)}
            
        except Exception as e:
            logger.error(f"Error migrating {video_id}: {e}")
            with self.state_lock:
                self.state['failed'].append({
                    'video_id': video_id,
                    'source_key': source_key,
                    'timestamp': datetime.now().isoformat(),
                    'error': str(e)
                })
            return {'status': 'failed', 'video_id': video_id, 'error': str(e)}
    
    def migrate_thumbnails(self, dry_run=False, max_workers=10):
        """Migrate all thumbnails using parallel processing."""
        logger.info("="*60)
        logger.info("Starting FAST thumbnail migration...")
        logger.info(f"Max parallel workers: {max_workers}")
        logger.info("="*60)
        
        if dry_run:
            logger.info("DRY RUN MODE - No actual copying will be performed")
        
        # Get all video IDs
        video_ids = self.list_video_ids()
        total = len(video_ids)
        
        if total == 0:
            logger.warning("No video IDs found in bucket!")
            return
        
        # Statistics
        stats = {
            'migrated': 0,
            'skipped': 0,
            'failed': 0,
            'no_thumbnail': 0
        }
        
        logger.info(f"\nProcessing {total} video IDs with up to {max_workers} parallel workers...\n")
        
        if dry_run:
            # In dry run, just check what would be done
            for i, video_id in enumerate(video_ids, 1):
                source_key = f"{video_id}/thumbnail.jpg"
                if self.check_thumbnail_exists(video_id, self.videos_client, self.videos_bucket, source_key):
                    logger.info(f"[{i}/{total}] Would process: {video_id}")
                    stats['migrated'] += 1
                else:
                    stats['no_thumbnail'] += 1
                
                if i % 100 == 0:
                    logger.info(f"Progress: {i}/{total} checked")
        else:
            # Process in parallel
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all tasks
                future_to_video = {executor.submit(self.process_video_thumbnail, vid): vid 
                                   for vid in video_ids}
                
                # Process completed tasks
                for i, future in enumerate(as_completed(future_to_video), 1):
                    video_id = future_to_video[future]
                    try:
                        result = future.result()
                        
                        if result['status'] == 'migrated':
                            stats['migrated'] += 1
                            logger.info(f"[{i}/{total}] ✓ Migrated: {video_id} ({result['size']:,} bytes)")
                        elif result['status'] == 'skipped':
                            stats['skipped'] += 1
                            if result['reason'] == 'no_thumbnail':
                                stats['no_thumbnail'] += 1
                            else:
                                logger.info(f"[{i}/{total}] ⚠ Skipped: {video_id} ({result['reason']})")
                        elif result['status'] == 'failed':
                            stats['failed'] += 1
                            logger.error(f"[{i}/{total}] ✗ Failed: {video_id}")
                        
                        # Progress update
                        if i % 10 == 0:
                            logger.info(f"\nProgress: {i}/{total} - Migrated: {stats['migrated']}, "
                                       f"Skipped: {stats['skipped']}, Failed: {stats['failed']}\n")
                        
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
        logger.info("MIGRATION COMPLETE")
        logger.info("="*60)
        logger.info(f"Total video IDs processed: {total}")
        logger.info(f"✓ Migrated: {stats['migrated']}")
        logger.info(f"⚠ Skipped: {stats['skipped']} (includes {stats['no_thumbnail']} without thumbnails)")
        logger.info(f"✗ Failed: {stats['failed']}")
        logger.info("="*60)
        
        return stats
    
    def reset_state(self):
        """Reset the migration state."""
        if self.state_file.exists():
            self.state_file.unlink()
            logger.info("State file removed")
        self.state = self._load_state()
    
    def show_state(self):
        """Display current migration state."""
        print(f"\nMigration State:")
        print(f"Started: {self.state['started_at']}")
        print(f"Last Updated: {self.state['last_updated']}")
        print(f"\nMigrated: {len(self.state['migrated'])}")
        print(f"Failed: {len(self.state['failed'])}")
        print(f"Skipped: {len(self.state['skipped'])}")
        
        if self.state['failed']:
            print("\nFailed migrations:")
            for item in self.state['failed'][:10]:  # Show first 10
                print(f"  - {item['video_id']} at {item['timestamp']}")
            if len(self.state['failed']) > 10:
                print(f"  ... and {len(self.state['failed']) - 10} more")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Fast parallel thumbnail migration between R2 buckets')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without actually doing it')
    parser.add_argument('--reset-state', action='store_true', help='Reset migration state and start fresh')
    parser.add_argument('--show-state', action='store_true', help='Show current migration state and exit')
    parser.add_argument('--workers', type=int, default=10, help='Number of parallel workers (default: 10)')
    
    args = parser.parse_args()
    
    # Get required environment variables
    videos_endpoint = os.environ.get('VIDEOS_ENDPOINT')
    videos_access_key = os.environ.get('VIDEOS_ACCESS_KEY')
    videos_secret_key = os.environ.get('VIDEOS_SECRET_KEY')
    videos_bucket = os.environ.get('VIDEOS_BUCKET', 'rawkode-academy-videos')
    
    content_endpoint = os.environ.get('CONTENT_ENDPOINT')
    content_access_key = os.environ.get('CONTENT_ACCESS_KEY')
    content_secret_key = os.environ.get('CONTENT_SECRET_KEY')
    content_bucket = os.environ.get('CONTENT_BUCKET', 'rawkode-academy-content')
    
    # Validate required environment variables
    missing_vars = []
    if not videos_endpoint:
        missing_vars.append('VIDEOS_ENDPOINT')
    if not videos_access_key:
        missing_vars.append('VIDEOS_ACCESS_KEY')
    if not videos_secret_key:
        missing_vars.append('VIDEOS_SECRET_KEY')
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
    
    logger.info(f"Creating FastThumbnailMigrator instance...")
    
    try:
        migrator = FastThumbnailMigrator(
            videos_endpoint,
            videos_access_key,
            videos_secret_key,
            videos_bucket,
            content_endpoint,
            content_access_key,
            content_secret_key,
            content_bucket
        )
        
        if args.show_state:
            migrator.show_state()
            sys.exit(0)
        
        if args.reset_state:
            migrator.reset_state()
            logger.info("Migration state reset")
            if not args.dry_run:
                sys.exit(0)
        
        # Perform migration
        results = migrator.migrate_thumbnails(dry_run=args.dry_run, max_workers=args.workers)
        
        if results and results.get('failed', 0) > 0:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()