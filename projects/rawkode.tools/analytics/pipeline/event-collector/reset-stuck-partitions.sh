#!/bin/bash

# Reset all stuck partitions
echo "Resetting stuck partitions..."

partitions=(
    "analytics.video.seek/2025-06-23-07"
    "page.view/2024-01-15-14"
    "analytics.video.play/2025-06-23-12"
    "analytics.video.pause/2025-06-23-12"
    "analytics.web.pageview/2025-06-23-12"
)

for partition in "${partitions[@]}"; do
    encoded=$(echo -n "$partition" | sed 's/\//%2F/g')
    echo "Resetting: $partition"
    curl -X DELETE "https://analytics-event-collector.rawkodeacademy.workers.dev/do/${encoded}/reset-table-creation"
    echo ""
done