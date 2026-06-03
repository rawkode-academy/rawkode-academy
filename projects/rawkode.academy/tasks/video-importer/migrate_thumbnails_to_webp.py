#!/usr/bin/env python3
"""
Convert all video thumbnails in the content bucket from JPEG to WebP.

For each `videos/<cuid>/thumbnail.jpg` in the content bucket:
  1. download the JPEG
  2. convert to WebP via `cwebp -q 85`
  3. upload as `videos/<cuid>/thumbnail.webp` with ContentType image/webp
  4. verify the new object exists
  5. optionally delete the original `.jpg`

Idempotent: a CUID whose `.webp` already exists is skipped. By default the
leftover `.jpg`, if still present, is deleted; pass `--keep-jpg` to preserve it.
"""

import argparse
import logging
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import requests
from botocore.exceptions import ClientError

logging.basicConfig(
    level=logging.DEBUG if os.environ.get("DEBUG") else logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://api.rawkode.academy/"
KEY_TEMPLATE_JPG = "videos/{id}/thumbnail.jpg"
KEY_TEMPLATE_WEBP = "videos/{id}/thumbnail.webp"
WEBP_QUALITY = "85"


def fetch_video_ids():
    resp = requests.post(
        GRAPHQL_URL,
        json={"query": "query { getAllVideos { id } }"},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return [v["id"] for v in data["data"]["getAllVideos"]]


class ThumbnailWebpMigrator:
    def __init__(self, endpoint, access_key, secret_key, bucket):
        self.bucket = bucket
        logger.info(f"Bucket: {bucket}")
        logger.info(f"Endpoint: {endpoint}")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )

    def object_exists(self, key):
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            raise

    def convert_to_webp(self, jpg_bytes):
        with tempfile.TemporaryDirectory() as tmp:
            in_path = Path(tmp) / "in.jpg"
            out_path = Path(tmp) / "out.webp"
            in_path.write_bytes(jpg_bytes)
            result = subprocess.run(
                ["cwebp", "-q", WEBP_QUALITY, str(in_path), "-o", str(out_path)],
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise RuntimeError(f"cwebp failed: {result.stderr.strip()}")
            return out_path.read_bytes()

    def migrate_one(self, video_id, dry_run=False, delete_jpg=True):
        jpg_key = KEY_TEMPLATE_JPG.format(id=video_id)
        webp_key = KEY_TEMPLATE_WEBP.format(id=video_id)

        if self.object_exists(webp_key):
            if dry_run:
                logger.info(f"[skip] {webp_key} already exists")
                return "skipped"
            if delete_jpg:
                try:
                    self.client.delete_object(Bucket=self.bucket, Key=jpg_key)
                except ClientError:
                    pass
            logger.info(f"[skip] {webp_key} already exists")
            return "skipped"

        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=jpg_key)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
                logger.info(f"[skip] {jpg_key} not present (nothing to migrate)")
                return "skipped"
            raise

        if dry_run:
            logger.info(f"[dry-run] {jpg_key} -> {webp_key}")
            return "converted"

        jpg_bytes = obj["Body"].read()
        webp_bytes = self.convert_to_webp(jpg_bytes)

        self.client.put_object(
            Bucket=self.bucket,
            Key=webp_key,
            Body=webp_bytes,
            ContentType="image/webp",
        )

        if not self.object_exists(webp_key):
            raise RuntimeError(f"verification failed: {webp_key} not found after PUT")

        if delete_jpg:
            self.client.delete_object(Bucket=self.bucket, Key=jpg_key)
        logger.info(
            f"[ok] {jpg_key} ({len(jpg_bytes)}B) -> {webp_key} ({len(webp_bytes)}B)"
        )
        return "converted"

    def run(self, video_ids, dry_run=False, workers=8, delete_jpg=True):
        stats = {"converted": 0, "skipped": 0, "failed": 0}

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(self.migrate_one, vid, dry_run, delete_jpg): vid for vid in video_ids
            }
            for fut in as_completed(futures):
                vid = futures[fut]
                try:
                    stats[fut.result()] += 1
                except Exception as e:
                    stats["failed"] += 1
                    logger.error(f"[fail] {vid}: {e}")

        logger.info("=" * 50)
        logger.info(
            f"Done. converted={stats['converted']} "
            f"skipped={stats['skipped']} failed={stats['failed']}"
        )
        return stats


def main():
    parser = argparse.ArgumentParser(
        description="Convert thumbnails in the content R2 bucket from JPEG to WebP"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List the work without uploading or deleting",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Concurrent worker threads (default: 8)",
    )
    parser.add_argument(
        "--video-id",
        action="append",
        default=[],
        help="Only migrate this video ID. Can be repeated.",
    )
    parser.add_argument(
        "--keep-jpg",
        action="store_true",
        help="Keep the original thumbnail.jpg after creating thumbnail.webp",
    )
    args = parser.parse_args()

    endpoint = os.environ.get("CONTENT_ENDPOINT")
    access_key = os.environ.get("CONTENT_ACCESS_KEY")
    secret_key = os.environ.get("CONTENT_SECRET_KEY")
    bucket = os.environ.get("CONTENT_BUCKET")

    missing = [
        name
        for name, val in [
            ("CONTENT_ENDPOINT", endpoint),
            ("CONTENT_ACCESS_KEY", access_key),
            ("CONTENT_SECRET_KEY", secret_key),
            ("CONTENT_BUCKET", bucket),
        ]
        if not val
    ]
    if missing:
        logger.error(f"Missing env vars: {', '.join(missing)}")
        sys.exit(1)

    try:
        subprocess.run(["cwebp", "-version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        logger.error("cwebp not found on PATH (install libwebp: `brew install webp`)")
        sys.exit(1)

    if args.video_id:
        video_ids = args.video_id
        logger.info(f"Using {len(video_ids)} explicit video ID(s)")
    else:
        logger.info(f"Fetching video IDs from {GRAPHQL_URL}...")
        video_ids = fetch_video_ids()
        logger.info(f"Got {len(video_ids)} video IDs")

    migrator = ThumbnailWebpMigrator(endpoint, access_key, secret_key, bucket)
    stats = migrator.run(
        video_ids,
        dry_run=args.dry_run,
        workers=args.workers,
        delete_jpg=not args.keep_jpg,
    )
    if stats["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
