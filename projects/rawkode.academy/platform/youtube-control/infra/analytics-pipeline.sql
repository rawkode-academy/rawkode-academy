INSERT INTO youtube_reports_sink
SELECT event_id, query_key, channel_id, report_type, video_id,
       start_date, end_date, observed_at, raw_key, row_count, report_json
FROM youtube_reports_stream;
