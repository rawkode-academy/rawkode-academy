INSERT INTO analytics_events_iceberg
SELECT
	schema_version,
	event_id,
	to_timestamp_millis(ts_ms) AS ts,
	event,
	source,
	distinct_id,
	anonymous_id,
	user_id,
	session_id,
	url_host,
	url_path,
	referrer_host,
	lower(utm_source) AS utm_source,
	lower(utm_medium) AS utm_medium,
	utm_campaign,
	utm_term,
	utm_content,
	country,
	continent,
	device,
	browser,
	is_bot,
	properties_json
FROM analytics_events
WHERE ts_ms > 1704067200000
