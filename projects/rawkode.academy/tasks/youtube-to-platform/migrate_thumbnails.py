#!/usr/bin/env python3
"""
Migrate thumbnails from rawkode-academy-videos bucket to rawkode-academy-content bucket.
"""

import os
import sys
import logging
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
import json
from pathlib import Path
from datetime import datetime

# Set up logging with DEBUG level if DEBUG env var is set
log_level = logging.DEBUG if os.environ.get('DEBUG') else logging.INFO
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ThumbnailMigrator:
    def __init__(self, videos_endpoint, videos_access_key, videos_secret_key, videos_bucket,
                 content_endpoint, content_access_key, content_secret_key, content_bucket):
        self.videos_bucket = videos_bucket
        self.content_bucket = content_bucket
        
        logger.info(f"Initializing migrator...")
        logger.info(f"Videos bucket: {videos_bucket}")
        logger.info(f"Content bucket: {content_bucket}")
        logger.info(f"Videos endpoint: {videos_endpoint}")
        logger.info(f"Content endpoint: {content_endpoint}")
        
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
        logger.info(f"State file location: {self.state_file}")
        self.state = self._load_state()
    
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
        self.state['last_updated'] = datetime.now().isoformat()
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def list_thumbnails(self):
        """List all thumbnails in the videos bucket."""
        thumbnails = []
        paginator = self.videos_client.get_paginator('list_objects_v2')
        
        logger.info(f"Listing objects in bucket: {self.videos_bucket}")
        
        try:
            # List all objects in the bucket
            page_count = 0
            object_count = 0
            for page in paginator.paginate(Bucket=self.videos_bucket):
                page_count += 1
                logger.debug(f"Processing page {page_count}...")
                
                if 'Contents' in page:
                    objects_in_page = len(page['Contents'])
                    object_count += objects_in_page
                    logger.info(f"Page {page_count}: Found {objects_in_page} objects")
                    
                    for obj in page['Contents']:
                        # Check if it's a thumbnail
                        if obj['Key'].endswith('/thumbnail.jpg'):
                            video_id = obj['Key'].split('/')[0]
                            thumbnails.append({
                                'video_id': video_id,
                                'key': obj['Key'],
                                'size': obj['Size'],
                                'last_modified': obj['LastModified'].isoformat()
                            })
                            logger.debug(f"Found thumbnail: {obj['Key']} (size: {obj['Size']} bytes)")
                else:
                    logger.info(f"Page {page_count}: No objects found")
            
            logger.info(f"Listing complete. Total objects scanned: {object_count}")
            logger.info(f"Found {len(thumbnails)} thumbnails in videos bucket")
            
            if len(thumbnails) == 0:
                logger.warning("No thumbnails found! Check if the bucket is correct and contains files ending with '/thumbnail.jpg'")
            
            return thumbnails
            
        except ClientError as e:
            logger.error(f"Error listing objects: {e}")
            raise
    
    def check_existing_thumbnail(self, video_id):
        """Check if thumbnail already exists in content bucket."""
        content_key = f"videos/{video_id}/thumbnail.jpg"
        
        logger.debug(f"Checking if thumbnail exists in content bucket: {content_key}")
        
        try:
            self.content_client.head_object(
                Bucket=self.content_bucket,
                Key=content_key
            )
            logger.debug(f"Thumbnail already exists: {content_key}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                logger.debug(f"Thumbnail does not exist: {content_key}")
                return False
            else:
                logger.error(f"Error checking thumbnail existence for {content_key}: {e}")
                raise
    
    def copy_thumbnail(self, video_id, source_key):
        """Copy thumbnail from videos bucket to content bucket."""
        content_key = f"videos/{video_id}/thumbnail.jpg"
        
        try:
            # Download from videos bucket
            logger.info(f"Downloading thumbnail from {self.videos_bucket}/{source_key}")
            response = self.videos_client.get_object(
                Bucket=self.videos_bucket,
                Key=source_key
            )
            thumbnail_data = response['Body'].read()
            thumbnail_size = len(thumbnail_data)
            logger.info(f"Downloaded {thumbnail_size} bytes for {video_id}")
            
            # Upload to content bucket
            logger.info(f"Uploading to {self.content_bucket}/{content_key}")
            self.content_client.put_object(
                Bucket=self.content_bucket,
                Key=content_key,
                Body=thumbnail_data,
                ContentType='image/jpeg'
            )
            logger.info(f"Successfully uploaded thumbnail for {video_id}")
            
            return True
            
        except ClientError as e:
            logger.error(f"Error copying thumbnail for {video_id}: {e}")
            return False
    
    def migrate_thumbnails(self, dry_run=False):
        """Migrate all thumbnails from videos to content bucket."""
        logger.info("="*60)
        logger.info("Starting thumbnail migration...")
        logger.info(f"From bucket: {self.videos_bucket}")
        logger.info(f"To bucket: {self.content_bucket}")
        logger.info("="*60)
        
        if dry_run:
            logger.info("DRY RUN MODE - No actual copying will be performed")
        
        # Get all thumbnails
        logger.info("Fetching list of thumbnails...")
        thumbnails = self.list_thumbnails()
        
        # Statistics
        total = len(thumbnails)
        migrated = 0
        skipped = 0
        failed = 0
        
        for i, thumbnail in enumerate(thumbnails, 1):
            video_id = thumbnail['video_id']
            source_key = thumbnail['key']
            
            # Check if already processed
            if any(item['video_id'] == video_id for item in self.state['migrated']):
                logger.info(f"[{i}/{total}] Skipping {video_id} - already migrated")
                skipped += 1
                continue
            
            if any(item['video_id'] == video_id for item in self.state['failed']):
                logger.info(f"[{i}/{total}] Skipping {video_id} - previously failed")
                skipped += 1
                continue
            
            # Check if already exists in content bucket
            if self.check_existing_thumbnail(video_id):
                logger.info(f"[{i}/{total}] Skipping {video_id} - already exists in content bucket")
                self.state['skipped'].append({
                    'video_id': video_id,
                    'reason': 'already_exists',
                    'timestamp': datetime.now().isoformat()
                })
                skipped += 1
                continue
            
            # Perform migration
            if dry_run:
                logger.info(f"[{i}/{total}] Would copy: {source_key} -> videos/{video_id}/thumbnail.jpg")
                migrated += 1
            else:
                logger.info(f"[{i}/{total}] Migrating thumbnail for {video_id}")
                if self.copy_thumbnail(video_id, source_key):
                    self.state['migrated'].append({
                        'video_id': video_id,
                        'source_key': source_key,
                        'timestamp': datetime.now().isoformat()
                    })
                    migrated += 1
                    logger.info(f"[{i}/{total}] Successfully migrated {video_id}")
                else:
                    self.state['failed'].append({
                        'video_id': video_id,
                        'source_key': source_key,
                        'timestamp': datetime.now().isoformat()
                    })
                    failed += 1
                    logger.error(f"[{i}/{total}] Failed to migrate {video_id}")
                
                # Save state after each operation
                self._save_state()
        
        # Summary
        logger.info("\n" + "="*50)
        logger.info("Migration Summary:")
        logger.info(f"Total thumbnails: {total}")
        logger.info(f"Migrated: {migrated}")
        logger.info(f"Skipped: {skipped}")
        logger.info(f"Failed: {failed}")
        logger.info("="*50)
        
        return {
            'total': total,
            'migrated': migrated,
            'skipped': skipped,
            'failed': failed
        }
    
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
            for item in self.state['failed']:
                print(f"  - {item['video_id']} at {item['timestamp']}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate thumbnails between R2 buckets')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without actually doing it')
    parser.add_argument('--reset-state', action='store_true', help='Reset migration state and start fresh')
    parser.add_argument('--show-state', action='store_true', help='Show current migration state and exit')
    
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
    
    logger.info(f"Creating ThumbnailMigrator instance...")
    
    try:
        migrator = ThumbnailMigrator(
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
        results = migrator.migrate_thumbnails(dry_run=args.dry_run)
        
        if results['failed'] > 0:
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()