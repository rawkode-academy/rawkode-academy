#!/usr/bin/env python3
"""
Download Descript videos, extract audio, transcripts, and upload to Cloudflare R2.
"""

import argparse
import os
import sys
import logging
import tempfile
from pathlib import Path
import subprocess
import re
from datetime import datetime
import requests
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from cuid2 import Cuid
import json
import time
from urllib.parse import urlparse
import shutil

# Create a cuid generator instance
cuid_generator = Cuid()
from google.cloud import run_v2

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ProcessingState:
    """Manages the state of video processing to allow resumption."""
    
    STEPS = [
        'metadata_fetched',
        'video_downloaded',
        'audio_extracted',
        'subtitles_downloaded',
        'thumbnail_copied',
        'video_uploaded_content',
        'audio_uploaded_content',
        'subtitles_uploaded_content',
        'thumbnail_uploaded_content',
        'thumbnail_uploaded_videos',
        'cloud_run_triggered',
        'completed'
    ]
    
    def __init__(self, descript_id, state_dir=None):
        self.descript_id = descript_id
        self.state_dir = state_dir or Path.home() / '.descript_to_r2_state'
        self.state_dir = Path(self.state_dir)
        self.state_dir.mkdir(exist_ok=True)
        self.state_file = self.state_dir / f"{descript_id}.json"
        self.state = self._load_state()
    
    def _load_state(self):
        """Load existing state or create new one."""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    logger.info(f"Loaded existing state for {self.descript_id}")
                    return state
            except Exception as e:
                logger.warning(f"Failed to load state file: {e}. Starting fresh.")
        
        return {
            'descript_id': self.descript_id,
            'cuid': None,
            'video_info': {},
            'completed_steps': [],
            'artifacts': {},
            'started_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat()
        }
    
    def save(self):
        """Save current state to disk."""
        self.state['last_updated'] = datetime.now().isoformat()
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.state, f, indent=2)
            logger.debug(f"State saved to {self.state_file}")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")
    
    def is_step_completed(self, step):
        """Check if a processing step is already completed."""
        return step in self.state['completed_steps']
    
    def mark_step_completed(self, step):
        """Mark a processing step as completed."""
        if step not in self.state['completed_steps']:
            self.state['completed_steps'].append(step)
            self.save()
            logger.info(f"Marked step '{step}' as completed")
    
    def set_cuid(self, cuid):
        """Set the CUID for this video."""
        self.state['cuid'] = cuid
        self.save()
    
    def set_video_info(self, info):
        """Store video metadata."""
        self.state['video_info'] = info
        self.save()
    
    def set_artifact(self, key, value):
        """Store artifact information."""
        self.state['artifacts'][key] = value
        self.save()
    
    def get_artifact(self, key, default=None):
        """Get artifact information."""
        return self.state['artifacts'].get(key, default)
    
    def cleanup(self):
        """Remove state file after successful completion."""
        if self.state_file.exists():
            self.state_file.unlink()
            logger.info(f"Cleaned up state file for {self.descript_id}")


class DescriptDownloader:
    def __init__(self):
        # Initialize R2 clients for both buckets
        self.videos_client = boto3.client(
            's3',
            endpoint_url=os.environ.get('VIDEOS_ENDPOINT'),
            aws_access_key_id=os.environ.get('VIDEOS_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('VIDEOS_SECRET_KEY'),
            region_name='auto'
        )
        
        self.content_client = boto3.client(
            's3',
            endpoint_url=os.environ.get('CONTENT_ENDPOINT'),
            aws_access_key_id=os.environ.get('CONTENT_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('CONTENT_SECRET_KEY'),
            region_name='auto'
        )
        
        self.videos_bucket = os.environ.get('VIDEOS_BUCKET')
        self.content_bucket = os.environ.get('CONTENT_BUCKET')
        
        # Initialize Google Cloud Run Jobs client
        self.jobs_client = run_v2.JobsClient()
        self.gcp_project = os.environ.get('GCP_PROJECT', 'rawkode-academy-production')
        self.gcp_location = os.environ.get('GCP_LOCATION', 'europe-west2')
        self.gcp_job_name = os.environ.get('GCP_JOB_NAME', 'transcoding-job')

    def extract_descript_id(self, url_or_id):
        """Extract Descript ID from share URL or use ID directly."""
        # If it looks like just an ID (alphanumeric, no slashes or dots)
        if re.match(r'^[a-zA-Z0-9]+$', url_or_id):
            return url_or_id
        
        # Handle URLs like https://share.descript.com/view/OsxdwbYAhvG
        match = re.search(r'/view/([a-zA-Z0-9]+)(?:\?|$|#)', url_or_id)
        if match:
            return match.group(1)
        
        # Try to extract from the end of the path
        parsed = urlparse(url_or_id)
        path_parts = parsed.path.rstrip('/').split('/')
        if path_parts and path_parts[-1]:
            return path_parts[-1]
        
        raise ValueError(f"Could not extract Descript ID from: {url_or_id}")

    def fetch_descript_metadata(self, descript_url_or_id):
        """Fetch metadata from Descript share page."""
        try:
            # Extract ID and construct full URL if needed
            descript_id = self.extract_descript_id(descript_url_or_id)
            descript_url = f"https://share.descript.com/view/{descript_id}"
            
            logger.info(f"Fetching metadata from: {descript_url}")
            response = requests.get(descript_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            html = response.text
            
            # Extract metadata from the HTML
            metadata = {}
            
            # Extract from meta tags
            title_match = re.search(r'<meta property="og:title" content="([^"]+)"', html)
            if title_match:
                metadata['title'] = title_match.group(1).replace(' - Descript', '')
            
            desc_match = re.search(r'<meta property="og:description" content="([^"]+)"', html)
            if desc_match:
                metadata['description'] = desc_match.group(1)
            
            # Extract URLs from meta tags
            video_match = re.search(r'<meta property="descript:video" content="([^"]+)"', html)
            if video_match:
                metadata['video_url'] = video_match.group(1)
            
            transcript_match = re.search(r'<meta property="descript:transcript" content="([^"]+)"', html)
            if transcript_match:
                metadata['transcript_url'] = transcript_match.group(1)
            
            subtitles_match = re.search(r'<meta property="descript:subtitles" content="([^"]+)"', html)
            if subtitles_match:
                metadata['subtitles_url'] = subtitles_match.group(1)
            
            # Extract metadata JSON
            metadata_match = re.search(r'<script[^>]*id="metadata"[^>]*>([^<]+)</script>', html)
            if metadata_match:
                try:
                    metadata_json = json.loads(metadata_match.group(1))
                    metadata['raw_metadata'] = metadata_json
                    
                    # Extract additional info
                    if 'created_at' in metadata_json:
                        metadata['created_at'] = metadata_json['created_at']
                    if 'published_by' in metadata_json:
                        author = metadata_json['published_by']
                        metadata['author'] = f"{author.get('first_name', '')} {author.get('last_name', '')}".strip()
                    
                except json.JSONDecodeError:
                    logger.warning("Failed to parse metadata JSON")
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error fetching Descript metadata: {str(e)}")
            raise

    def download_file(self, url, output_path, description="file"):
        """Download a file from URL."""
        try:
            logger.info(f"Downloading {description}: {url}")
            response = requests.get(url, stream=True)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"{description.capitalize()} saved to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error downloading {description}: {str(e)}")
            raise

    def convert_to_mkv(self, input_path, output_path):
        """Convert video to MKV format using ffmpeg."""
        try:
            logger.info(f"Converting video to MKV format")
            
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-c', 'copy',  # Copy streams without re-encoding
                '-f', 'matroska',
                '-y',  # Overwrite output
                output_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                raise Exception(f"Video conversion failed: {result.stderr}")
            
            logger.info(f"Video converted to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error converting video: {str(e)}")
            raise

    def extract_audio(self, video_path, output_dir):
        """Extract audio from video as MP3."""
        try:
            output_path = os.path.join(output_dir, 'audio.mp3')
            logger.info(f"Extracting audio to MP3")

            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-vn',  # No video
                '-acodec', 'mp3',
                '-ab', '192k',  # Audio bitrate
                '-y',  # Overwrite output
                output_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                raise Exception(f"Audio extraction failed: {result.stderr}")

            logger.info(f"Audio extracted to: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error extracting audio: {str(e)}")
            raise

    def copy_thumbnail(self, thumbnail_path, output_dir):
        """Copy the provided thumbnail to the working directory."""
        try:
            if not os.path.exists(thumbnail_path):
                raise FileNotFoundError(f"Thumbnail file not found: {thumbnail_path}")
            
            output_path = os.path.join(output_dir, 'thumbnail.jpg')
            logger.info(f"Copying thumbnail from {thumbnail_path}")
            
            shutil.copy2(thumbnail_path, output_path)
            
            logger.info(f"Thumbnail copied to: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error copying thumbnail: {str(e)}")
            raise

    def upload_to_r2(self, local_path, bucket, r2_key, content_type='application/octet-stream', use_videos_client=False):
        """Upload file to Cloudflare R2."""
        try:
            logger.info(f"Uploading to R2 bucket '{bucket}': {r2_key}")
            
            # Choose the appropriate client
            client = self.videos_client if use_videos_client else self.content_client

            with open(local_path, 'rb') as file:
                client.upload_fileobj(
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

    def trigger_cloud_run_job(self, video_cuid):
        """Trigger Google Cloud Run job with VIDEO_ID environment variable."""
        try:
            # Construct the full job name
            job_name = f"projects/{self.gcp_project}/locations/{self.gcp_location}/jobs/{self.gcp_job_name}"

            logger.info(f"Triggering Cloud Run job: {job_name}")

            # Create execution request with environment override
            request = run_v2.RunJobRequest(
                name=job_name,
                overrides=run_v2.types.RunJobRequest.Overrides(
                    container_overrides=[
                        run_v2.types.RunJobRequest.Overrides.ContainerOverride(
                            env=[
                                run_v2.types.EnvVar(
                                    name="VIDEO_ID",
                                    value=video_cuid
                                )
                            ]
                        )
                    ]
                )
            )

            # Execute the job
            operation = self.jobs_client.run_job(request=request)

            # Get the operation name from the response
            if hasattr(operation, 'name'):
                operation_name = operation.name
            else:
                # For long-running operations, extract the name differently
                operation_name = str(operation)
                logger.info(f"Cloud Run job triggered successfully. Operation: {operation_name}")
            
            return operation_name

        except Exception as e:
            logger.error(f"Error triggering Cloud Run job: {str(e)}")
            raise

    def generate_slug(self, title):
        """Generate a URL-friendly slug from the video title."""
        # Convert to lowercase
        slug = title.lower()
        # Replace special characters with spaces
        slug = re.sub(r'[^\w\s-]', ' ', slug)
        # Replace multiple spaces with single space
        slug = re.sub(r'\s+', ' ', slug)
        # Replace spaces with hyphens
        slug = slug.strip().replace(' ', '-')
        # Remove multiple hyphens
        slug = re.sub(r'-+', '-', slug)
        return slug

    def parse_transcript_duration(self, transcript_data):
        """Parse duration from transcript JSON."""
        try:
            if isinstance(transcript_data, dict):
                # Look for duration in various possible locations
                if 'duration' in transcript_data:
                    return int(transcript_data['duration'])
                
                # Try to calculate from the last word's end time
                if 'words' in transcript_data and transcript_data['words']:
                    last_word = transcript_data['words'][-1]
                    if 'end' in last_word:
                        return int(last_word['end'] / 1000)  # Convert ms to seconds
                
                # Check in segments
                if 'segments' in transcript_data and transcript_data['segments']:
                    last_segment = transcript_data['segments'][-1]
                    if 'end' in last_segment:
                        return int(last_segment['end'] / 1000)
            
            return 0
        except Exception as e:
            logger.warning(f"Failed to parse duration from transcript: {e}")
            return 0

    def generate_sql_insert(self, cuid, metadata, transcript_data=None):
        """Generate SQL insert statement for the videos table."""
        # Escape function for SQL strings
        def escape_sql(text):
            if not text:
                return ''
            # Replace single quotes with double single quotes
            text = text.replace("'", "''")
            # Replace newlines with escaped newlines
            text = text.replace('\n', '\\n')
            # Replace carriage returns
            text = text.replace('\r', '\\r')
            # Replace tabs
            text = text.replace('\t', '\\t')
            return text
        
        title = escape_sql(metadata.get('title', ''))
        description = escape_sql(metadata.get('description', ''))
        
        # Try to get duration from transcript
        duration = 0
        if transcript_data:
            duration = self.parse_transcript_duration(transcript_data)
        
        slug = self.generate_slug(metadata.get('title', ''))

        # Parse created date to Unix timestamp
        created_at = metadata.get('created_at', '')
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                published_at = int(dt.timestamp())
            except:
                published_at = int(datetime.now().timestamp())
        else:
            published_at = int(datetime.now().timestamp())

        # For subtitle, use the first line of description or a truncated version
        subtitle_raw = metadata.get('description', '').split('\n')[0][:200] if metadata.get('description') else ''
        subtitle = escape_sql(subtitle_raw)

        sql = f"""INSERT INTO videos (id, title, subtitle, slug, description, duration, publishedAt)
VALUES ('{cuid}', '{title}', '{subtitle}', '{slug}', '{description}', {duration}, {published_at});"""

        return sql

    def process_descript_url(self, descript_url_or_id, thumbnail_path, state, local_video_path=None):
        """Process a single Descript URL or ID."""
        # Generate or retrieve CUID
        if state.state['cuid']:
            cuid = state.state['cuid']
            logger.info(f"Using existing CUID: {cuid}")
        else:
            cuid = cuid_generator.generate()
            state.set_cuid(cuid)
            logger.info(f"Generated new CUID: {cuid}")

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Step 1: Fetch metadata
                if not state.is_step_completed('metadata_fetched'):
                    metadata = self.fetch_descript_metadata(descript_url_or_id)
                    state.set_video_info(metadata)
                    state.mark_step_completed('metadata_fetched')
                else:
                    metadata = state.state['video_info']
                    logger.info("Skipping metadata fetch (already completed)")

                # Step 2: Download or use local video
                video_path = None
                if not state.is_step_completed('video_downloaded'):
                    if local_video_path:
                        # Use local video file
                        logger.info(f"Using local video file: {local_video_path}")
                        if not os.path.exists(local_video_path):
                            raise FileNotFoundError(f"Local video file not found: {local_video_path}")
                        
                        # Check if it's already MKV
                        if local_video_path.lower().endswith('.mkv'):
                            video_path = local_video_path
                        else:
                            # Convert to MKV
                            video_path = os.path.join(temp_dir, 'video.mkv')
                            self.convert_to_mkv(local_video_path, video_path)
                    else:
                        # Download from Descript
                        if 'video_url' not in metadata:
                            raise ValueError("No video URL found in metadata")
                        
                        # Download as MP4 first
                        temp_video_path = os.path.join(temp_dir, 'video_temp.mp4')
                        self.download_file(metadata['video_url'], temp_video_path, "video")
                        
                        # Convert to MKV
                        video_path = os.path.join(temp_dir, 'video.mkv')
                        self.convert_to_mkv(temp_video_path, video_path)
                        
                        # Remove temp MP4
                        os.remove(temp_video_path)
                    
                    state.set_artifact('video_path', video_path)
                    state.mark_step_completed('video_downloaded')
                else:
                    logger.info("Skipping video download (already completed)")
                    video_path = state.get_artifact('video_path')
                    if video_path and not os.path.exists(video_path):
                        # Re-download if file doesn't exist
                        if local_video_path and os.path.exists(local_video_path):
                            if local_video_path.lower().endswith('.mkv'):
                                video_path = local_video_path
                            else:
                                video_path = os.path.join(temp_dir, 'video.mkv')
                                self.convert_to_mkv(local_video_path, video_path)
                        else:
                            temp_video_path = os.path.join(temp_dir, 'video_temp.mp4')
                            self.download_file(metadata['video_url'], temp_video_path, "video")
                            video_path = os.path.join(temp_dir, 'video.mkv')
                            self.convert_to_mkv(temp_video_path, video_path)
                            os.remove(temp_video_path)

                # Step 3: Extract audio
                audio_path = None
                if not state.is_step_completed('audio_extracted'):
                    audio_path = self.extract_audio(video_path, temp_dir)
                    state.set_artifact('audio_path', audio_path)
                    state.mark_step_completed('audio_extracted')
                else:
                    logger.info("Skipping audio extraction (already completed)")
                    # Re-extract audio if needed for upload
                    if not state.is_step_completed('audio_uploaded_content'):
                        audio_path = self.extract_audio(video_path, temp_dir)
                    else:
                        audio_path = os.path.join(temp_dir, 'audio.mp3')

                # Step 4: Download subtitles (VTT)
                subtitles_path = None
                if not state.is_step_completed('subtitles_downloaded'):
                    if 'subtitles_url' in metadata:
                        subtitles_path = os.path.join(temp_dir, 'subtitles.vtt')
                        self.download_file(metadata['subtitles_url'], subtitles_path, "subtitles")
                        state.set_artifact('subtitles_path', subtitles_path)
                        state.mark_step_completed('subtitles_downloaded')
                    else:
                        logger.warning("No subtitles URL found in metadata")
                        state.mark_step_completed('subtitles_downloaded')
                else:
                    logger.info("Skipping subtitles download (already completed)")
                    # Re-download subtitles if needed for upload
                    if not state.is_step_completed('subtitles_uploaded_content') and 'subtitles_url' in metadata:
                        subtitles_path = os.path.join(temp_dir, 'subtitles.vtt')
                        self.download_file(metadata['subtitles_url'], subtitles_path, "subtitles")
                
                # Also download transcript for duration extraction if needed
                transcript_data = None
                if 'transcript_url' in metadata:
                    try:
                        transcript_path = os.path.join(temp_dir, 'transcript.json')
                        self.download_file(metadata['transcript_url'], transcript_path, "transcript")
                        with open(transcript_path, 'r') as f:
                            transcript_data = json.load(f)
                    except Exception as e:
                        logger.warning(f"Failed to download/parse transcript: {e}")

                # Step 5: Copy thumbnail
                thumb_path = None
                if not state.is_step_completed('thumbnail_copied'):
                    thumb_path = self.copy_thumbnail(thumbnail_path, temp_dir)
                    state.set_artifact('thumbnail_path', thumb_path)
                    state.mark_step_completed('thumbnail_copied')
                else:
                    logger.info("Skipping thumbnail copy (already completed)")
                    # Re-copy thumbnail if needed for upload
                    if (not state.is_step_completed('thumbnail_uploaded_content') or 
                        not state.is_step_completed('thumbnail_uploaded_videos')):
                        thumb_path = self.copy_thumbnail(thumbnail_path, temp_dir)
                    else:
                        thumb_path = os.path.join(temp_dir, 'thumbnail.jpg')

                # Upload to R2 buckets
                # Content bucket uploads
                if not state.is_step_completed('video_uploaded_content'):
                    self.upload_to_r2(
                        video_path or state.get_artifact('video_path') or os.path.join(temp_dir, 'video.mkv'),
                        self.content_bucket,
                        f"videos/{cuid}/original.mkv",
                        'video/x-matroska'
                    )
                    state.mark_step_completed('video_uploaded_content')

                if not state.is_step_completed('audio_uploaded_content'):
                    self.upload_to_r2(
                        audio_path or state.get_artifact('audio_path') or os.path.join(temp_dir, 'audio.mp3'),
                        self.content_bucket,
                        f"videos/{cuid}/original.mp3",
                        'audio/mpeg'
                    )
                    state.mark_step_completed('audio_uploaded_content')

                if not state.is_step_completed('subtitles_uploaded_content') and subtitles_path:
                    self.upload_to_r2(
                        subtitles_path or state.get_artifact('subtitles_path') or os.path.join(temp_dir, 'subtitles.vtt'),
                        self.content_bucket,
                        f"videos/{cuid}/captions/en.vtt",
                        'text/vtt'
                    )
                    state.mark_step_completed('subtitles_uploaded_content')

                if not state.is_step_completed('thumbnail_uploaded_content'):
                    self.upload_to_r2(
                        thumb_path or state.get_artifact('thumbnail_path') or os.path.join(temp_dir, 'thumbnail.jpg'),
                        self.content_bucket,
                        f"videos/{cuid}/thumbnail.jpg",
                        'image/jpeg'
                    )
                    state.mark_step_completed('thumbnail_uploaded_content')

                # Videos bucket upload
                if not state.is_step_completed('thumbnail_uploaded_videos'):
                    self.upload_to_r2(
                        thumb_path or state.get_artifact('thumbnail_path') or os.path.join(temp_dir, 'thumbnail.jpg'),
                        self.videos_bucket,
                        f"{cuid}/thumbnail.jpg",
                        'image/jpeg',
                        use_videos_client=True
                    )
                    state.mark_step_completed('thumbnail_uploaded_videos')

                # Trigger Cloud Run job
                if not state.is_step_completed('cloud_run_triggered'):
                    operation_name = self.trigger_cloud_run_job(cuid)
                    state.set_artifact('cloud_run_operation', operation_name)
                    state.mark_step_completed('cloud_run_triggered')

                # Generate SQL
                sql = self.generate_sql_insert(cuid, metadata, transcript_data)
                print("\n" + "="*80)
                print("SQL INSERT STATEMENT:")
                print("="*80)
                print(sql)
                print("="*80 + "\n")

                # Mark as completed
                state.mark_step_completed('completed')
                
                # Clean up state file on success
                state.cleanup()

                logger.info(f"Successfully processed Descript video: {cuid}")
                return cuid

            except Exception as e:
                logger.error(f"Error processing Descript URL: {str(e)}")
                raise


def main():
    parser = argparse.ArgumentParser(description='Download Descript videos and upload to R2')
    parser.add_argument('descript', help='Descript share URL or ID (e.g., OsxdwbYAhvG)')
    parser.add_argument('thumbnail', help='Path to thumbnail image file')
    parser.add_argument('--local-video', help='Path to local video file (skip download)', 
                        default=None)
    parser.add_argument('--state-dir', help='Directory to store processing state', 
                        default=None)
    
    args = parser.parse_args()

    # Validate thumbnail exists
    if not os.path.exists(args.thumbnail):
        logger.error(f"Thumbnail file not found: {args.thumbnail}")
        sys.exit(1)

    try:
        downloader = DescriptDownloader()
        
        # Extract Descript ID from URL or use directly
        descript_id = downloader.extract_descript_id(args.descript)
        logger.info(f"Processing Descript ID: {descript_id}")
        
        # Initialize state
        state = ProcessingState(descript_id, args.state_dir)
        
        # Process the video
        downloader.process_descript_url(args.descript, args.thumbnail, state, args.local_video)
        
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to process Descript video: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()