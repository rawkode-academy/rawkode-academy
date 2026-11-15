INSERT INTO short_links
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'data', 'domain') AS domain,
	json_get_str(value, 'data', 'path') AS path,
	json_get_bool(value, 'data', 'matched') AS matched,
	json_get_str(value, 'data', 'destination') AS destination,
	json_get_str(value, 'referrer') AS referrer,
	json_get_str(value, 'country') AS country,
	json_get_str(value, 'continent') AS continent,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser
FROM analytics_events
WHERE json_get_str(value, 'type') = 'shortLink'
