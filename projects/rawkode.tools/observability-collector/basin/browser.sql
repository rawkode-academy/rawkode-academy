INSERT INTO analytics_browser_events_v1
SELECT
	json_get_str(value, 'id') AS event_id,
	json_get_str(value, 'source') AS event_source,
	json_get_str(value, 'type') AS event_type,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_int(value, 'schemaversion') AS schema_version,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'user_id') AS user_id,
	json_get_str(value, 'data', 'distinct_id') AS distinct_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_str(value, 'data', 'referrer_host') AS referrer_host,
	json_get_str(value, 'country') AS country,
	json_get_str(value, 'continent') AS continent,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_str(value, 'data', 'utm_source') AS utm_source,
	json_get_str(value, 'data', 'utm_medium') AS utm_medium,
	json_get_str(value, 'data', 'utm_campaign') AS utm_campaign,
	json_get_str(value, 'data', 'utm_term') AS utm_term,
	json_get_str(value, 'data', 'utm_content') AS utm_content,
	json_get_str(value, 'data', 'properties', 'first_touch_utm_source') AS first_touch_utm_source,
	json_get_str(value, 'data', 'properties', 'first_touch_utm_medium') AS first_touch_utm_medium,
	json_get_str(value, 'data', 'properties', 'first_touch_utm_campaign') AS first_touch_utm_campaign,
	json_get_str(value, 'data', 'properties', 'first_touch_utm_term') AS first_touch_utm_term,
	json_get_str(value, 'data', 'properties', 'first_touch_utm_content') AS first_touch_utm_content,
	json_get_str(value, 'data', 'properties', 'first_touch_landing_page') AS first_touch_landing_page,
	json_get_str(value, 'data', 'properties', 'first_touch_initial_referrer') AS first_touch_initial_referrer,
	json_get_str(value, 'data', 'properties', 'first_touch_captured_at') AS first_touch_captured_at,
	json_get_str(value, 'data', 'properties', 'last_touch_utm_source') AS last_touch_utm_source,
	json_get_str(value, 'data', 'properties', 'last_touch_utm_medium') AS last_touch_utm_medium,
	json_get_str(value, 'data', 'properties', 'last_touch_utm_campaign') AS last_touch_utm_campaign,
	json_get_str(value, 'data', 'properties', 'last_touch_utm_term') AS last_touch_utm_term,
	json_get_str(value, 'data', 'properties', 'last_touch_utm_content') AS last_touch_utm_content,
	json_get_str(value, 'data', 'properties', 'last_touch_landing_page') AS last_touch_landing_page,
	json_get_str(value, 'data', 'properties', 'last_touch_initial_referrer') AS last_touch_initial_referrer,
	json_get_str(value, 'data', 'properties', 'last_touch_captured_at') AS last_touch_captured_at
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') LIKE 'web.%'
	AND json_get_int(value, 'schemaversion') = 1
	AND json_get_int(value, 'data', 'schema_version') = 1
