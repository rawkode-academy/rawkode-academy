{% macro cloudevents_base_schema() %}
  -- CloudEvents standard attributes
  id AS event_id,
  specversion,
  type AS event_type,
  source AS event_source,
  time::TIMESTAMP AS event_time,
  datacontenttype,
  dataschema,
  subject,
  
  -- Analytics extensions
  sessionid AS session_id,
  userid AS user_id,
  environment,
  projectid AS project_id,
  country,
  city,
  continent,
  latitude::DOUBLE AS latitude,
  longitude::DOUBLE AS longitude,
  useragent AS user_agent,
  browser,
  os,
  devicetype AS device_type,
  
  -- Derived fields
  DATE_TRUNC('day', time::TIMESTAMP) AS event_date,
  DATE_TRUNC('hour', time::TIMESTAMP) AS event_hour,
  DATE_TRUNC('week', time::TIMESTAMP) AS event_week,
  DATE_TRUNC('month', time::TIMESTAMP) AS event_month,
  
  -- Metadata
  CURRENT_TIMESTAMP AS _dbt_loaded_at
{% endmacro %}

{% macro test_cloudevent_schema(model, event_type) %}
  -- Test that ensures CloudEvent has required fields
  SELECT COUNT(*)
  FROM {{ model }}
  WHERE 
    event_id IS NULL
    OR event_type != '{{ event_type }}'
    OR event_time IS NULL
    OR session_id IS NULL
{% endmacro %}