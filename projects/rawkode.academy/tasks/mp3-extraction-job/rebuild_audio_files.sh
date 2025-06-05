#!/bin/bash

# Configuration
PROJECT_ID="rawkode-academy-production"
REGION="europe-west2"
JOB_NAME="mp3-extraction-job"
BATCH_SIZE=5
DELAY_BETWEEN_BATCHES=5

# Read video IDs
VIDEO_IDS=($(<"/tmp/video-ids.txt"))
TOTAL_VIDEOS=${#VIDEO_IDS[@]}

echo "Starting MP3 extraction for $TOTAL_VIDEOS videos"
echo "Processing in batches of $BATCH_SIZE with ${DELAY_BETWEEN_BATCHES}s delay between batches"

# Counter for successful and failed jobs
SUCCESS_COUNT=0
FAILED_COUNT=0

# Process videos in batches
for ((i=0; i<$TOTAL_VIDEOS; i+=$BATCH_SIZE)); do
    BATCH_NUM=$((i/$BATCH_SIZE + 1))
    TOTAL_BATCHES=$(((TOTAL_VIDEOS + BATCH_SIZE - 1) / BATCH_SIZE))
    
    echo ""
    echo "Processing batch $BATCH_NUM of $TOTAL_BATCHES (videos $((i+1)) to $((i+BATCH_SIZE > TOTAL_VIDEOS ? TOTAL_VIDEOS : i+BATCH_SIZE)))"
    
    # Process videos in this batch in parallel
    for ((j=i; j<i+BATCH_SIZE && j<TOTAL_VIDEOS; j++)); do
        VIDEO_ID="${VIDEO_IDS[j]}"
        echo "Scheduling job for video: $VIDEO_ID"
        
        # Execute the job in background
        (
            if gcloud run jobs execute $JOB_NAME \
                --region=$REGION \
                --project=$PROJECT_ID \
                --update-env-vars="VIDEO_ID=$VIDEO_ID" \
                --async \
                2>&1 | grep -q "is being started asynchronously"; then
                echo "✓ Successfully scheduled job for video: $VIDEO_ID"
            else
                echo "✗ Failed to schedule job for video: $VIDEO_ID"
            fi
        ) &
    done
    
    # Wait for all background jobs in this batch to complete
    wait
    
    # Add delay between batches (except for the last batch)
    if [ $((i + BATCH_SIZE)) -lt $TOTAL_VIDEOS ]; then
        echo "Waiting ${DELAY_BETWEEN_BATCHES}s before next batch..."
        sleep $DELAY_BETWEEN_BATCHES
    fi
done

echo ""
echo "All jobs have been scheduled!"
echo "Monitor progress at: https://console.cloud.google.com/run/jobs/details/europe-west2/mp3-extraction-job?project=$PROJECT_ID"