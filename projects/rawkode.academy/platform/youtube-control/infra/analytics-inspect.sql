-- Pipelines delivery is asynchronous. Acknowledgement is not table visibility.
-- Replay can add identical events. Select snapshots before analyzing metrics.
SELECT event_id, query_key, channel_id, report_type, video_id,
       start_date, end_date, observed_at, row_count, raw_key
FROM default.youtube_reports
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY query_key
  ORDER BY observed_at DESC, event_id DESC
) = 1
ORDER BY observed_at DESC
LIMIT 100;
