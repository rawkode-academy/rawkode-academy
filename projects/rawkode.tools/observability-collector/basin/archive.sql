INSERT INTO analytics_events_archive
SELECT
	json_get_str(value, 'id') AS event_id,
	json_get_str(value, 'type') AS event_type,
	json_get_str(value, 'source') AS event_source,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	value
FROM analytics_events
