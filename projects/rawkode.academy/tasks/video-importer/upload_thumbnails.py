#!/usr/bin/env python3
"""
Upload thumbnails to Cloudflare R2.
"""

import argparse
import os
import sys
import logging
import subprocess
import tempfile
from pathlib import Path
import boto3
from botocore.exceptions import NoCredentialsError, ClientError

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ThumbnailUploader:
    def __init__(self):
        # Initialize R2 client for content bucket
        self.content_client = boto3.client(
            's3',
            endpoint_url=os.environ.get('CONTENT_ENDPOINT'),
            aws_access_key_id=os.environ.get('CONTENT_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('CONTENT_SECRET_KEY'),
            region_name='auto'
        )
        
        self.content_bucket = os.environ.get('CONTENT_BUCKET')

    def convert_to_jpeg(self, input_path, output_path):
        """Convert image to JPEG format using ffmpeg."""
        try:
            logger.info(f"Converting {input_path} to JPEG")
            
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-vf', 'format=yuv420p',  # Ensure compatibility
                '-q:v', '2',  # High quality JPEG (1-31, lower is better)
                '-y',  # Overwrite output
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                raise Exception(f"Image conversion failed: {result.stderr}")
            
            logger.info(f"Image converted to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error converting image: {str(e)}")
            raise

    def upload_to_r2(self, local_path, bucket, r2_key, content_type='image/jpeg'):
        """Upload file to Cloudflare R2."""
        try:
            logger.info(f"Uploading to R2 bucket '{bucket}': {r2_key}")

            with open(local_path, 'rb') as file:
                self.content_client.upload_fileobj(
                    file,
                    bucket,
                    r2_key,
                    ExtraArgs={'ContentType': content_type}
                )

            logger.info(f"Successfully uploaded to {bucket}: {r2_key}")
            return True

        except NoCredentialsError:
            logger.error("R2 credentials not available")
            raise
        except ClientError as e:
            logger.error(f"Client error uploading to R2: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error uploading to R2: {str(e)}")
            raise

    def process_thumbnail(self, thumbnail_path, cuid):
        """Process and upload a single thumbnail to R2 content bucket."""
        if not os.path.exists(thumbnail_path):
            raise FileNotFoundError(f"Thumbnail file not found: {thumbnail_path}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Convert to JPEG if needed
                if thumbnail_path.lower().endswith('.png'):
                    jpeg_path = os.path.join(temp_dir, 'thumbnail.jpg')
                    self.convert_to_jpeg(thumbnail_path, jpeg_path)
                else:
                    # Already JPEG or other format, use as is
                    jpeg_path = thumbnail_path
                    logger.info(f"Using thumbnail as-is: {thumbnail_path}")
                
                # Upload to content bucket
                self.upload_to_r2(
                    jpeg_path,
                    self.content_bucket,
                    f"videos/{cuid}/thumbnail.jpg",
                    'image/jpeg'
                )
                
                logger.info(f"Successfully uploaded thumbnail for CUID: {cuid}")
                return True
                
            except Exception as e:
                logger.error(f"Error processing thumbnail: {str(e)}")
                raise


def main():
    parser = argparse.ArgumentParser(description='Upload thumbnails to R2')
    parser.add_argument('thumbnail', help='Path to thumbnail image file or directory (in batch mode)')
    parser.add_argument('cuid', nargs='?', help='CUID for the video (not needed in batch mode)')
    parser.add_argument('--batch', action='store_true', 
                        help='Batch mode: thumbnail is a directory, filenames are CUIDs')
    
    args = parser.parse_args()
    
    # Check arguments
    if not args.batch and not args.cuid:
        parser.error("CUID is required when not in batch mode")
        sys.exit(1)

    try:
        uploader = ThumbnailUploader()
        
        if args.batch:
            # Batch mode: process all images in directory
            if not os.path.isdir(args.thumbnail):
                logger.error(f"In batch mode, thumbnail must be a directory: {args.thumbnail}")
                sys.exit(1)
            
            thumbnail_dir = Path(args.thumbnail)
            success_count = 0
            error_count = 0
            
            for img_file in thumbnail_dir.glob('*'):
                if img_file.is_file() and img_file.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                    # Use filename (without extension) as CUID
                    cuid = img_file.stem
                    logger.info(f"\nProcessing {img_file.name} with CUID: {cuid}")
                    
                    try:
                        uploader.process_thumbnail(str(img_file), cuid)
                        success_count += 1
                    except Exception as e:
                        logger.error(f"Failed to process {img_file.name}: {str(e)}")
                        error_count += 1
            
            logger.info(f"\nBatch processing complete: {success_count} succeeded, {error_count} failed")
            if error_count > 0:
                sys.exit(1)
        
        else:
            # Single file mode
            uploader.process_thumbnail(args.thumbnail, args.cuid)
        
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to upload thumbnail: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()