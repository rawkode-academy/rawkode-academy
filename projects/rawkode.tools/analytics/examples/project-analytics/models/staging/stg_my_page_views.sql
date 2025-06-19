-- Example of how a project would use the analytics platform
{{ config(materialized='view') }}

WITH source AS (
    {{ read_cloudevents('com.myproject.pageview', start_date='2024-01-01') }}
)

SELECT
    {{ cloudevents_base_schema() }},
    
    -- Project-specific event data
    data_page_url AS page_url,
    data_page_title AS page_title,
    data_referrer AS referrer,
    data_utm_source AS utm_source,
    data_utm_medium AS utm_medium,
    data_utm_campaign AS utm_campaign,
    data_time_on_page::INTEGER AS time_on_page
    
FROM source

WHERE 
    event_id IS NOT NULL
    AND event_type = 'com.myproject.pageview'