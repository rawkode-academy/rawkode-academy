#!/usr/bin/env python3
"""
Delete videos from Cloudflare R2 based on deletion list.
Removes all objects with the video ID prefix from both content and videos buckets.
"""

import os
import sys
import argparse
from pathlib import Path
import boto3
from botocore.exceptions import NoCredentialsError, ClientError


class R2VideoDeletion:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.deletions_file = Path("videos_to_delete.txt")

        # Initialize S3 clients for both buckets
        self.setup_clients()

    def setup_clients(self):
        """Setup S3 clients for both content and videos buckets"""
        # Get credentials from environment
        videos_endpoint = os.environ.get('VIDEOS_ENDPOINT')
        videos_access_key = os.environ.get('VIDEOS_ACCESS_KEY')
        videos_secret_key = os.environ.get('VIDEOS_SECRET_KEY')
        self.videos_bucket = os.environ.get('VIDEOS_BUCKET')

        content_endpoint = os.environ.get('CONTENT_ENDPOINT')
        content_access_key = os.environ.get('CONTENT_ACCESS_KEY')
        content_secret_key = os.environ.get('CONTENT_SECRET_KEY')
        self.content_bucket = os.environ.get('CONTENT_BUCKET')

        # Validate environment variables
        missing_vars = []
        if not videos_endpoint:
            missing_vars.append('VIDEOS_ENDPOINT')
        if not videos_access_key:
            missing_vars.append('VIDEOS_ACCESS_KEY')
        if not videos_secret_key:
            missing_vars.append('VIDEOS_SECRET_KEY')
        if not self.videos_bucket:
            missing_vars.append('VIDEOS_BUCKET')
        if not content_endpoint:
            missing_vars.append('CONTENT_ENDPOINT')
        if not content_access_key:
            missing_vars.append('CONTENT_ACCESS_KEY')
        if not content_secret_key:
            missing_vars.append('CONTENT_SECRET_KEY')
        if not self.content_bucket:
            missing_vars.append('CONTENT_BUCKET')

        if missing_vars:
            print(f"Missing required environment variables: {', '.join(missing_vars)}")
            print("Please set these in your .envrc file")
            sys.exit(1)

        # Create S3 clients
        self.videos_client = boto3.client(
            's3',
            endpoint_url=videos_endpoint,
            aws_access_key_id=videos_access_key,
            aws_secret_access_key=videos_secret_key,
            region_name='auto'
        )

        self.content_client = boto3.client(
            's3',
            endpoint_url=content_endpoint,
            aws_access_key_id=content_access_key,
            aws_secret_access_key=content_secret_key,
            region_name='auto'
        )

    def load_deletion_list(self):
        """Load video IDs from deletion file"""
        if not self.deletions_file.exists():
            print(f"Deletion file not found: {self.deletions_file}")
            return []

        video_ids = []
        with open(self.deletions_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    # Extract video ID (before the # comment if present)
                    video_id = line.split('#')[0].strip()
                    if video_id:
                        video_ids.append(video_id)

        return video_ids

    def list_objects_with_prefix(self, client, bucket, prefix):
        """List all objects in a bucket with a given prefix"""
        objects = []
        try:
            paginator = client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        objects.append(obj['Key'])
        except ClientError as e:
            print(f"Error listing objects in {bucket} with prefix {prefix}: {e}")

        return objects

    def delete_objects(self, client, bucket, keys):
        """Delete multiple objects from a bucket"""
        if not keys:
            return 0

        # S3 delete_objects has a limit of 1000 keys per request
        deleted_count = 0
        for i in range(0, len(keys), 1000):
            batch = keys[i:i+1000]
            delete_request = {
                'Objects': [{'Key': key} for key in batch]
            }

            try:
                if self.dry_run:
                    print(f"  [DRY RUN] Would delete {len(batch)} objects from {bucket}")
                    for key in batch[:5]:  # Show first 5 as examples
                        print(f"    - {key}")
                    if len(batch) > 5:
                        print(f"    ... and {len(batch) - 5} more")
                else:
                    response = client.delete_objects(
                        Bucket=bucket,
                        Delete=delete_request
                    )
                    deleted_count += len(response.get('Deleted', []))

                    # Check for errors
                    errors = response.get('Errors', [])
                    if errors:
                        for error in errors:
                            print(f"  Error deleting {error['Key']}: {error['Message']}")
            except ClientError as e:
                print(f"  Error deleting objects from {bucket}: {e}")

        return deleted_count

    def delete_video_from_r2(self, video_id):
        """Delete all objects related to a video ID from R2"""
        print(f"\nProcessing video: {video_id}")
        total_deleted = 0

        # Delete from content bucket
        # Expected pattern: videos/{video_id}/...
        content_prefix = f"videos/{video_id}/"
        content_objects = self.list_objects_with_prefix(
            self.content_client,
            self.content_bucket,
            content_prefix
        )

        if content_objects:
            print(f"  Found {len(content_objects)} objects in content bucket")
            deleted = self.delete_objects(
                self.content_client,
                self.content_bucket,
                content_objects
            )
            if not self.dry_run:
                print(f"  Deleted {deleted} objects from content bucket")
            total_deleted += deleted
        else:
            print(f"  No objects found in content bucket with prefix: {content_prefix}")

        # Delete from videos bucket
        # Expected pattern: {video_id}/...
        videos_prefix = f"{video_id}/"
        videos_objects = self.list_objects_with_prefix(
            self.videos_client,
            self.videos_bucket,
            videos_prefix
        )

        if videos_objects:
            print(f"  Found {len(videos_objects)} objects in videos bucket")
            deleted = self.delete_objects(
                self.videos_client,
                self.videos_bucket,
                videos_objects
            )
            if not self.dry_run:
                print(f"  Deleted {deleted} objects from videos bucket")
            total_deleted += deleted
        else:
            print(f"  No objects found in videos bucket with prefix: {videos_prefix}")

        return total_deleted

    def run(self):
        """Main execution"""
        if self.dry_run:
            print("=" * 80)
            print("DRY RUN MODE - No actual deletions will be performed")
            print("=" * 80)

        # Load video IDs to delete
        video_ids = self.load_deletion_list()

        if not video_ids:
            print("No videos to delete")
            return

        print(f"Found {len(video_ids)} videos to delete")

        # Confirm before proceeding (unless dry run)
        if not self.dry_run:
            print("\nWARNING: This will permanently delete the following videos from R2:")
            for vid in video_ids[:10]:
                print(f"  - {vid}")
            if len(video_ids) > 10:
                print(f"  ... and {len(video_ids) - 10} more")

            response = input("\nAre you sure you want to proceed? (yes/no): ")
            if response.lower() != 'yes':
                print("Aborted")
                return

        # Process each video
        total_deleted = 0
        for i, video_id in enumerate(video_ids, 1):
            print(f"\n[{i}/{len(video_ids)}]", end="")
            deleted = self.delete_video_from_r2(video_id)
            total_deleted += deleted

        # Summary
        print("\n" + "=" * 80)
        if self.dry_run:
            print("DRY RUN SUMMARY")
            print(f"Would delete objects from {len(video_ids)} videos")
        else:
            print("DELETION SUMMARY")
            print(f"Processed {len(video_ids)} videos")
            print(f"Total objects deleted: {total_deleted}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Delete videos from Cloudflare R2')
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    parser.add_argument(
        '--file',
        default='videos_to_delete.txt',
        help='Path to deletion list file (default: videos_to_delete.txt)'
    )
    args = parser.parse_args()

    tool = R2VideoDeletion(dry_run=args.dry_run)
    if args.file != 'videos_to_delete.txt':
        tool.deletions_file = Path(args.file)

    tool.run()