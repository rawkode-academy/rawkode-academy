-- YouTube metrics in the Academy analytics lake (rawkode-analytics bucket).
-- Rows arrive as CloudEvents from source `rawkode-academy-youtube`. YouTube
-- revises recent days, so each daily sync re-sends the last 28 days: keep the
-- latest fetchedAt per day (and per traffic source).

-- Channel views and watch time per day.
SELECT day, views, minutes_watched, subscribers_gained, subscribers_lost
FROM (
	SELECT
		json_get_str(value, 'data', 'day') AS day,
		json_get_int(value, 'data', 'views') AS views,
		json_get_int(value, 'data', 'estimatedMinutesWatched') AS minutes_watched,
		json_get_int(value, 'data', 'subscribersGained') AS subscribers_gained,
		json_get_int(value, 'data', 'subscribersLost') AS subscribers_lost,
		ROW_NUMBER() OVER (
			PARTITION BY json_get_str(value, 'data', 'day')
			ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC
		) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily'
) WHERE rn = 1
ORDER BY day;

-- Views per day per traffic source.
SELECT day, source, views, minutes_watched
FROM (
	SELECT
		json_get_str(value, 'data', 'day') AS day,
		json_get_str(value, 'data', 'insightTrafficSourceType') AS source,
		json_get_int(value, 'data', 'views') AS views,
		json_get_int(value, 'data', 'estimatedMinutesWatched') AS minutes_watched,
		ROW_NUMBER() OVER (
			PARTITION BY json_get_str(value, 'data', 'day'), json_get_str(value, 'data', 'insightTrafficSourceType')
			ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC
		) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.daily_traffic'
) WHERE rn = 1
ORDER BY day, views DESC;
