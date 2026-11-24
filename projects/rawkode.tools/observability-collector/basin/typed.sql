INSERT INTO short_link_redirects
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
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'type') = 'shortLink';

INSERT INTO web_page_views
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'user_id') AS user_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_str(value, 'data', 'referrer_host') AS referrer_host,
	json_get_str(value, 'data', 'utm_source') AS utm_source,
	json_get_str(value, 'data', 'utm_medium') AS utm_medium,
	json_get_str(value, 'data', 'utm_campaign') AS utm_campaign,
	json_get_str(value, 'country') AS country,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') = 'web.page_view';

INSERT INTO web_clicks
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'type') AS kind,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'user_id') AS user_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_str(value, 'data', 'properties', 'tag') AS tag,
	json_get_str(value, 'data', 'properties', 'data_attr') AS data_attr,
	json_get_str(value, 'data', 'properties', 'href') AS href,
	json_get_str(value, 'data', 'properties', 'text') AS link_text,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') IN ('web.click', 'web.dead_click', 'web.rage_click');

INSERT INTO web_page_leaves
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'user_id') AS user_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_int(value, 'data', 'properties', 'time_on_page_ms') AS time_on_page_ms,
	json_get_int(value, 'data', 'properties', 'max_scroll_pct') AS max_scroll_pct,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') = 'web.page_leave';

INSERT INTO web_exceptions
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_str(value, 'data', 'properties', 'type') AS exception_type,
	json_get_str(value, 'data', 'properties', 'message') AS message,
	json_get_str(value, 'data', 'properties', 'stack') AS stack,
	json_get_str(value, 'data', 'properties', 'source') AS exception_source,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') = 'web.exception';

INSERT INTO web_vitals
SELECT
	json_get_str(value, 'id') AS event_id,
	to_timestamp_millis(json_get_str(value, 'time')) AS event_time,
	json_get_str(value, 'data', 'anonymous_id') AS anonymous_id,
	json_get_str(value, 'data', 'session_id') AS session_id,
	json_get_str(value, 'data', 'url_host') AS url_host,
	json_get_str(value, 'data', 'url_path') AS url_path,
	json_get_str(value, 'data', 'properties', 'name') AS metric,
	json_get_float(value, 'data', 'properties', 'value') AS metric_value,
	json_get_str(value, 'data', 'properties', 'rating') AS rating,
	json_get_str(value, 'data', 'properties', 'navigation_type') AS navigation_type,
	json_get_str(value, 'device') AS device,
	json_get_str(value, 'browser') AS browser,
	json_get_bool(value, 'bot') AS bot,
	json_get_str(value, 'botreason') AS bot_reason,
	json_get_int(value, 'asn') AS asn
FROM analytics_events
WHERE json_get_str(value, 'source') = 'rawkode-academy-browser'
	AND json_get_str(value, 'type') = 'web.web_vitals';
