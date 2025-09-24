#!/usr/bin/env python3
"""
Download YouTube videos, extract audio, and upload to Cloudflare R2.
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
import yt_dlp
from cuid2 import Cuid
import json
import time

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
        'video_downloaded',
        'audio_extracted',
        'thumbnail_downloaded',
        'video_uploaded_content',
        'audio_uploaded_content',
        'thumbnail_uploaded_content',
        'thumbnail_uploaded_videos',
        'cloud_run_triggered',
        'completed'
    ]
    
    def __init__(self, youtube_id, state_dir=None):
        self.youtube_id = youtube_id
        self.state_dir = state_dir or Path.home() / '.youtube_to_r2_state'
        self.state_dir = Path(self.state_dir)
        self.state_dir.mkdir(exist_ok=True)
        self.state_file = self.state_dir / f"{youtube_id}.json"
        self.state = self._load_state()
    
    def _load_state(self):
        """Load existing state or create new one."""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    logger.info(f"Loaded existing state for {self.youtube_id}")
                    return state
            except Exception as e:
                logger.warning(f"Failed to load state file: {e}. Starting fresh.")
        
        return {
            'youtube_id': self.youtube_id,
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
    
    def get_cuid(self):
        """Get the CUID for this video."""
        return self.state['cuid']
    
    def set_artifact(self, key, value):
        """Store an artifact path or info."""
        self.state['artifacts'][key] = value
        self.save()
    
    def get_artifact(self, key):
        """Retrieve an artifact path or info."""
        return self.state['artifacts'].get(key)
    
    def set_video_info(self, info):
        """Store video metadata."""
        # Extract only serializable fields from yt-dlp info
        clean_info = {
            'title': info.get('title', ''),
            'description': info.get('description', ''),
            'duration': info.get('duration', 0),
            'upload_date': info.get('upload_date', ''),
            'uploader': info.get('uploader', ''),
            'view_count': info.get('view_count', 0),
            'like_count': info.get('like_count', 0),
            'thumbnails': info.get('thumbnails', []),
            'webpage_url': info.get('webpage_url', ''),
            'channel_id': info.get('channel_id', ''),
            'tags': info.get('tags', []),
            'categories': info.get('categories', []),
            'chapters': info.get('chapters', [])
        }
        self.state['video_info'] = clean_info
        self.save()
    
    def get_video_info(self):
        """Get video metadata."""
        return self.state['video_info']
    
    def cleanup(self):
        """Remove state file after successful completion."""
        if self.state_file.exists():
            self.state_file.unlink()
            logger.info(f"Cleaned up state file for {self.youtube_id}")
    
    def get_resume_info(self):
        """Get information about what will be resumed."""
        completed = self.state['completed_steps']
        remaining = [s for s in self.STEPS if s not in completed and s != 'completed']
        return {
            'completed_steps': completed,
            'remaining_steps': remaining,
            'cuid': self.state['cuid'],
            'started_at': self.state['started_at'],
            'last_updated': self.state['last_updated']
        }


class YouTubeToR2:
    def __init__(self, videos_endpoint, videos_access_key, videos_secret_key, videos_bucket,
                 content_endpoint, content_access_key, content_secret_key, content_bucket,
                 gcp_project, gcp_location, gcp_job_name):
        self.content_bucket = content_bucket
        self.videos_bucket = videos_bucket
        self.gcp_project = gcp_project
        self.gcp_location = gcp_location
        self.gcp_job_name = gcp_job_name

        # Separate S3 clients for each bucket
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

        # Cloud Run Jobs client
        self.jobs_client = run_v2.JobsClient()

    def download_video(self, youtube_id, output_dir, max_retries=3):
        """Download YouTube video in highest quality with retry logic."""
        url = f"https://www.youtube.com/watch?v={youtube_id}"

        ydl_opts = {
            'format': 'bestvideo+bestaudio/best',  # Let yt-dlp choose best format and merge to mkv
            'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
            'merge_output_format': 'mkv',  # Use mkv as expected by Cloud Run job
            'quiet': False,
            'no_warnings': False,
            'verbose': True,  # Enable verbose mode for debugging
            'logger': logger,
            'progress_hooks': [self._download_hook],  # Add progress hook
            'retries': 10,  # Number of retries for network errors
            'fragment_retries': 10,  # Retry failed fragments
            'skip_unavailable_fragments': False,  # Don't skip fragments
            'http_chunk_size': 10485760,  # 10MB chunks
            'continuedl': True,  # Continue partial downloads
            # Add headers to bypass 403 errors
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Sec-Fetch-Mode': 'navigate',
            },
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],  # Use Android client which often works better
                    'player_skip': ['webpage', 'configs'],  # Skip some checks that might trigger 403
                }
            },
            'nocheckcertificate': True,  # Skip certificate verification if needed
            'prefer_insecure': True,  # Use HTTP if HTTPS fails
        }

        for attempt in range(max_retries):
            try:
                logger.info(f"Download attempt {attempt + 1} of {max_retries}")

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    logger.info(f"Downloading video: {youtube_id}")
                    logger.info(f"URL: {url}")
                    logger.info(f"Output directory: {output_dir}")

                    # First extract info without downloading to check availability
                    logger.info("Extracting video info...")
                    info = ydl.extract_info(url, download=False)
                    logger.info(f"Video title: {info.get('title', 'Unknown')}")
                    logger.info(f"Video duration: {info.get('duration', 0)} seconds")
                    logger.info(f"Available formats: {len(info.get('formats', []))}")

                    # Now download
                    logger.info("Starting actual download...")
                    info = ydl.extract_info(url, download=True)

                    # Get the actual filename
                    filename = ydl.prepare_filename(info)
                    base_filename = filename.rsplit('.', 1)[0]

                    # Check what file was actually created (mkv if merged, mp4 if single stream)
                    if os.path.exists(base_filename + '.mkv'):
                        filename = base_filename + '.mkv'
                    elif os.path.exists(base_filename + '.mp4'):
                        filename = base_filename + '.mp4'
                    elif os.path.exists(filename):
                        # Use the prepared filename as-is
                        pass
                    else:
                        raise Exception(f"No output file found matching pattern: {base_filename}.*")

                    # Verify file exists and has content
                    if os.path.exists(filename):
                        file_size = os.path.getsize(filename)
                        logger.info(f"Downloaded file: {filename} (size: {file_size} bytes)")
                        if file_size == 0:
                            raise Exception("Downloaded file is empty")
                    else:
                        raise Exception(f"Downloaded file not found: {filename}")

                    # Convert to mkv if we got mp4 (Cloud Run expects mkv)
                    if filename.endswith('.mp4'):
                        mkv_filename = base_filename + '.mkv'
                        logger.info(f"Converting MP4 to MKV for Cloud Run compatibility...")

                        cmd = [
                            'ffmpeg',
                            '-i', filename,
                            '-c', 'copy',  # Copy streams without re-encoding
                            '-y',  # Overwrite output
                            mkv_filename
                        ]

                        result = subprocess.run(cmd, capture_output=True, text=True)
                        if result.returncode != 0:
                            logger.error(f"FFmpeg conversion error: {result.stderr}")
                            raise Exception(f"Failed to convert MP4 to MKV: {result.stderr}")

                        logger.info(f"Successfully converted to MKV: {mkv_filename}")

                        # Remove the original mp4 to save space
                        os.remove(filename)
                        filename = mkv_filename

                    return filename, info

            except Exception as e:
                logger.error(f"Error on attempt {attempt + 1}: {str(e)}")

                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 5  # Exponential backoff
                    logger.info(f"Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)

                    # Clean up any partial downloads
                    for file in os.listdir(output_dir):
                        if file.startswith(youtube_id) and file.endswith('.part'):
                            partial_file = os.path.join(output_dir, file)
                            logger.info(f"Removing partial file: {partial_file}")
                            os.remove(partial_file)
                else:
                    logger.error(f"Failed after {max_retries} attempts")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    raise

    def _download_hook(self, d):
        """Hook to monitor download progress."""
        if d['status'] == 'downloading':
            percent = d.get('_percent_str', 'N/A')
            speed = d.get('_speed_str', 'N/A')
            logger.debug(f"Downloading: {percent} at {speed}")
        elif d['status'] == 'finished':
            logger.info(f"Download finished: {d.get('filename', 'unknown')}")

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

    def download_thumbnail(self, video_info, output_dir):
        """Download the best quality thumbnail."""
        thumbnails = video_info.get('thumbnails', [])
        if not thumbnails:
            logger.warning("No thumbnails found")
            return None

        # Sort by quality (prefer higher resolution)
        thumbnails.sort(key=lambda x: x.get('width', 0) * x.get('height', 0), reverse=True)
        best_thumbnail = thumbnails[0]

        thumbnail_url = best_thumbnail['url']
        thumbnail_path = os.path.join(output_dir, 'thumbnail.jpg')

        try:
            logger.info(f"Downloading thumbnail: {thumbnail_url}")
            response = requests.get(thumbnail_url, stream=True)
            response.raise_for_status()

            with open(thumbnail_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f"Thumbnail saved to: {thumbnail_path}")
            return thumbnail_path

        except Exception as e:
            logger.error(f"Error downloading thumbnail: {str(e)}")
            return None

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

    def generate_sql_insert(self, cuid, video_info):
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
        
        title = escape_sql(video_info.get('title', ''))
        description = escape_sql(video_info.get('description', ''))
        duration = video_info.get('duration', 0)  # Duration in seconds
        slug = self.generate_slug(video_info.get('title', ''))

        # Parse upload date to Unix timestamp
        upload_date = video_info.get('upload_date', '')  # Format: YYYYMMDD
        if upload_date:
            try:
                dt = datetime.strptime(upload_date, '%Y%m%d')
                published_at = int(dt.timestamp())
            except:
                published_at = int(datetime.now().timestamp())
        else:
            published_at = int(datetime.now().timestamp())

        # For subtitle, we'll use the first line of description or a truncated version
        subtitle_raw = video_info.get('description', '').split('\n')[0][:200] if video_info.get('description') else ''
        subtitle = escape_sql(subtitle_raw)

        sql = f"""INSERT INTO videos (id, title, subtitle, slug, description, duration, publishedAt)
VALUES ('{cuid}', '{title}', '{subtitle}', '{slug}', '{description}', {duration}, {published_at});"""

        return sql

    def process_video(self, youtube_id, resume=True, skip_cloud_run=False, force_cloud_run=False):
        """Download video, extract audio, and upload all assets."""
        # Initialize state management
        state = ProcessingState(youtube_id)
        
        # Check if we're resuming
        if resume and state.get_cuid():
            video_cuid = state.get_cuid()
            resume_info = state.get_resume_info()
            logger.info(f"Resuming processing for {youtube_id} (CUID: {video_cuid})")
            logger.info(f"Completed steps: {', '.join(resume_info['completed_steps'])}")
            logger.info(f"Remaining steps: {', '.join(resume_info['remaining_steps'])}")
        else:
            # Generate new CUID for this video
            video_cuid = str(cuid_generator.generate())
            logger.info(f"Generated CUID: {video_cuid}")
            state.set_cuid(video_cuid)

        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Download video
                if not state.is_step_completed('video_downloaded'):
                    video_path, video_info = self.download_video(youtube_id, temp_dir)
                    state.set_artifact('video_path', video_path)
                    state.set_video_info(video_info)  # This now extracts only serializable data
                    state.mark_step_completed('video_downloaded')
                else:
                    logger.info("Skipping video download - already completed")
                    video_info = state.get_video_info()
                    # Re-download to temp dir for processing if needed
                    if not state.is_step_completed('audio_extracted') or not state.is_step_completed('video_uploaded_content'):
                        video_path, _ = self.download_video(youtube_id, temp_dir)

                # Extract audio
                if not state.is_step_completed('audio_extracted'):
                    audio_path = self.extract_audio(video_path, temp_dir)
                    state.set_artifact('audio_path', audio_path)
                    state.mark_step_completed('audio_extracted')
                else:
                    logger.info("Skipping audio extraction - already completed")
                    audio_path = os.path.join(temp_dir, 'audio.mp3')
                    # Re-extract if needed for upload
                    if not state.is_step_completed('audio_uploaded_content') and state.is_step_completed('video_downloaded'):
                        audio_path = self.extract_audio(video_path, temp_dir)

                # Download thumbnail
                if not state.is_step_completed('thumbnail_downloaded'):
                    thumbnail_path = self.download_thumbnail(video_info, temp_dir)
                    if thumbnail_path:
                        state.set_artifact('thumbnail_path', thumbnail_path)
                        state.mark_step_completed('thumbnail_downloaded')
                else:
                    logger.info("Skipping thumbnail download - already completed")
                    thumbnail_path = None
                    # Re-download if needed for upload
                    if (not state.is_step_completed('thumbnail_uploaded_content') or 
                        not state.is_step_completed('thumbnail_uploaded_videos')):
                        thumbnail_path = self.download_thumbnail(video_info, temp_dir)

                # Upload video to CONTENT bucket
                if not state.is_step_completed('video_uploaded_content'):
                    # Video should always be mkv at this point (converted if necessary)
                    self.upload_to_r2(
                        video_path,
                        self.content_bucket,
                        f"videos/{video_cuid}/original.mkv",
                        'video/x-matroska'
                    )
                    state.mark_step_completed('video_uploaded_content')
                else:
                    logger.info("Skipping video upload to content bucket - already completed")

                # Upload audio to CONTENT bucket
                if not state.is_step_completed('audio_uploaded_content'):
                    self.upload_to_r2(
                        audio_path,
                        self.content_bucket,
                        f"videos/{video_cuid}/original.mp3",
                        'audio/mpeg'
                    )
                    state.mark_step_completed('audio_uploaded_content')
                else:
                    logger.info("Skipping audio upload to content bucket - already completed")

                # Upload thumbnail to both buckets if it exists
                if thumbnail_path:
                    # Upload to CONTENT bucket
                    if not state.is_step_completed('thumbnail_uploaded_content'):
                        self.upload_to_r2(
                            thumbnail_path,
                            self.content_bucket,
                            f"videos/{video_cuid}/thumbnail.jpg",
                            'image/jpeg'
                        )
                        state.mark_step_completed('thumbnail_uploaded_content')
                    else:
                        logger.info("Skipping thumbnail upload to content bucket - already completed")

                    # Upload to VIDEOS bucket
                    if not state.is_step_completed('thumbnail_uploaded_videos'):
                        self.upload_to_r2(
                            thumbnail_path,
                            self.videos_bucket,
                            f"{video_cuid}/thumbnail.jpg",
                            'image/jpeg',
                            use_videos_client=True
                        )
                        state.mark_step_completed('thumbnail_uploaded_videos')
                    else:
                        logger.info("Skipping thumbnail upload to videos bucket - already completed")

                # Trigger Cloud Run job
                if not state.is_step_completed('cloud_run_triggered') or force_cloud_run:
                    if state.is_step_completed('cloud_run_triggered') and force_cloud_run:
                        logger.info("Forcing Cloud Run job trigger (already completed previously)")
                    operation_name = self.trigger_cloud_run_job(video_cuid)
                    state.set_artifact('cloud_run_operation', operation_name)
                    state.set_artifact('cloud_run_triggered_at', datetime.now().isoformat())
                    state.mark_step_completed('cloud_run_triggered')
                elif skip_cloud_run:
                    logger.info("Skipping Cloud Run job trigger as requested")
                    operation_name = None
                else:
                    previous_trigger = state.get_artifact('cloud_run_triggered_at')
                    logger.info(f"Cloud Run job already triggered at {previous_trigger}")
                    logger.info("Use --force-cloud-run to trigger again or --skip-cloud-run to skip")
                    operation_name = state.get_artifact('cloud_run_operation')

                # Generate SQL insert statement
                sql_insert = self.generate_sql_insert(video_cuid, video_info)
                
                # Mark as completed
                state.mark_step_completed('completed')

                logger.info(f"Successfully processed video {youtube_id}")

                return {
                    'youtube_id': youtube_id,
                    'cuid': video_cuid,
                    'title': video_info.get('title', 'Unknown'),
                    'content_paths': {
                        'video': f"videos/{video_cuid}/original.mkv",
                        'audio': f"videos/{video_cuid}/original.mp3",
                        'thumbnail': f"videos/{video_cuid}/thumbnail.jpg"
                    },
                    'videos_bucket_thumbnail': f"{video_cuid}/thumbnail.jpg",
                    'cloud_run_operation': operation_name if not skip_cloud_run else None,
                    'sql_insert': sql_insert,
                    'video_info': {
                        'duration': video_info.get('duration', 0),
                        'upload_date': video_info.get('upload_date', ''),
                        'description': video_info.get('description', '')
                    }
                }

            except Exception as e:
                logger.error(f"Failed to process video {youtube_id}: {str(e)}")
                raise


def main():
    parser = argparse.ArgumentParser(description='Download YouTube video and upload to Cloudflare R2')
    parser.add_argument('youtube_id', help='YouTube video ID', nargs='?')
    parser.add_argument('--no-resume', action='store_true', help='Start fresh, ignoring any saved state')
    parser.add_argument('--cleanup-state', action='store_true', help='Remove saved state for this video')
    parser.add_argument('--show-state', action='store_true', help='Show current state and exit')
    parser.add_argument('--skip-cloud-run', action='store_true', help='Skip Cloud Run job trigger even if not completed')
    parser.add_argument('--force-cloud-run', action='store_true', help='Force Cloud Run job trigger even if already completed')

    # Handle the special case where YouTube ID starts with hyphen
    args, remaining = parser.parse_known_args()
    
    # If youtube_id is None and we have remaining args, it's likely a YouTube ID starting with hyphen
    if args.youtube_id is None and remaining:
        args.youtube_id = remaining[0]
    elif args.youtube_id is None:
        parser.error("the following arguments are required: youtube_id")
    
    # Handle state management commands
    if args.show_state:
        state = ProcessingState(args.youtube_id)
        if state.get_cuid():
            resume_info = state.get_resume_info()
            print(f"\nState for YouTube ID: {args.youtube_id}")
            print(f"CUID: {resume_info['cuid']}")
            print(f"Started: {resume_info['started_at']}")
            print(f"Last Updated: {resume_info['last_updated']}")
            print(f"\nCompleted Steps:")
            for step in resume_info['completed_steps']:
                print(f"  ✓ {step}")
                if step == 'cloud_run_triggered':
                    triggered_at = state.get_artifact('cloud_run_triggered_at')
                    if triggered_at:
                        print(f"     (triggered at: {triggered_at})")
            print(f"\nRemaining Steps:")
            for step in resume_info['remaining_steps']:
                print(f"  ○ {step}")
            
            # Show Cloud Run artifacts if available
            operation = state.get_artifact('cloud_run_operation')
            if operation:
                print(f"\nCloud Run Operation: {operation}")
        else:
            print(f"No saved state found for YouTube ID: {args.youtube_id}")
        sys.exit(0)
    
    if args.cleanup_state:
        state = ProcessingState(args.youtube_id)
        state.cleanup()
        print(f"Cleaned up state for YouTube ID: {args.youtube_id}")
        sys.exit(0)

    # Get required environment variables
    videos_endpoint = os.environ.get('VIDEOS_ENDPOINT')
    videos_access_key = os.environ.get('VIDEOS_ACCESS_KEY')
    videos_secret_key = os.environ.get('VIDEOS_SECRET_KEY')
    videos_bucket = os.environ.get('VIDEOS_BUCKET')
    
    content_endpoint = os.environ.get('CONTENT_ENDPOINT')
    content_access_key = os.environ.get('CONTENT_ACCESS_KEY')
    content_secret_key = os.environ.get('CONTENT_SECRET_KEY')
    content_bucket = os.environ.get('CONTENT_BUCKET')

    # GCP configuration
    gcp_project = os.environ.get('GCP_PROJECT', 'rawkode-academy-production')
    gcp_location = os.environ.get('GCP_LOCATION', 'europe-west2')
    gcp_job_name = os.environ.get('GCP_JOB_NAME', 'transcoding-job')

    # Validate required environment variables
    missing_vars = []
    if not videos_endpoint:
        missing_vars.append('VIDEOS_ENDPOINT')
    if not videos_access_key:
        missing_vars.append('VIDEOS_ACCESS_KEY')
    if not videos_secret_key:
        missing_vars.append('VIDEOS_SECRET_KEY')
    if not videos_bucket:
        missing_vars.append('VIDEOS_BUCKET')
    if not content_endpoint:
        missing_vars.append('CONTENT_ENDPOINT')
    if not content_access_key:
        missing_vars.append('CONTENT_ACCESS_KEY')
    if not content_secret_key:
        missing_vars.append('CONTENT_SECRET_KEY')
    if not content_bucket:
        missing_vars.append('CONTENT_BUCKET')

    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please set these in your .envrc file (see .envrc.example)")
        sys.exit(1)

    try:
        processor = YouTubeToR2(
            videos_endpoint,
            videos_access_key,
            videos_secret_key,
            videos_bucket,
            content_endpoint,
            content_access_key,
            content_secret_key,
            content_bucket,
            gcp_project,
            gcp_location,
            gcp_job_name
        )

        result = processor.process_video(
            args.youtube_id, 
            resume=not args.no_resume,
            skip_cloud_run=args.skip_cloud_run,
            force_cloud_run=args.force_cloud_run
        )

        print(f"\nSuccess!")
        print(f"Video: {result['title']}")
        print(f"CUID: {result['cuid']}")
        print(f"Duration: {result['video_info']['duration']} seconds")
        print(f"\nContent Bucket Uploads:")
        print(f"  Video: {result['content_paths']['video']}")
        print(f"  Audio: {result['content_paths']['audio']}")
        print(f"  Thumbnail: {result['content_paths']['thumbnail']}")
        print(f"\nVideos Bucket Upload:")
        print(f"  Thumbnail: {result['videos_bucket_thumbnail']}")
        if result.get('cloud_run_operation'):
            print(f"\nCloud Run Job:")
            print(f"  Operation: {result['cloud_run_operation']}")
            state = ProcessingState(args.youtube_id)
            triggered_at = state.get_artifact('cloud_run_triggered_at')
            if triggered_at:
                print(f"  Triggered at: {triggered_at}")
        print(f"\n{'='*80}")
        print("SQL INSERT STATEMENT:")
        print("="*80)
        print(result['sql_insert'])
        print("="*80)
        
        # State file is now preserved after completion for reference

    except Exception as e:
        logger.error(f"Failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
