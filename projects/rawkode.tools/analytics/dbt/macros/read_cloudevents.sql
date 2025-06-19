{% macro read_cloudevents(event_type, start_date=none, end_date=none) %}
  {%- set bucket_path = 's3://analytics-source/events/' ~ event_type.replace('.', '_').lower() ~ '/**/*.parquet' -%}

  SELECT * FROM read_parquet('{{ bucket_path }}')
  {%- if start_date or end_date %}
  WHERE 1=1
    {%- if start_date %}
    AND time::TIMESTAMP >= '{{ start_date }}'::TIMESTAMP
    {%- endif %}
    {%- if end_date %}
    AND time::TIMESTAMP <= '{{ end_date }}'::TIMESTAMP
    {%- endif %}
  {%- endif %}
{% endmacro %}

{% macro flatten_cloudevent_data(prefix='data_') %}
  -- Extract all columns that start with the data prefix
  {%- set data_columns = [] -%}
  {%- for column in adapter.get_columns_in_relation(this) -%}
    {%- if column.name.startswith(prefix) -%}
      {%- do data_columns.append(column) -%}
    {%- endif -%}
  {%- endfor -%}

  -- Return the columns with cleaner names
  {%- for column in data_columns %}
    {{ column.name }} AS {{ column.name.replace(prefix, '') }},
  {%- endfor %}
{% endmacro %}

{% macro get_event_types(schema='analytics-source') %}
  -- This macro would query the catalog to get all available event types
  -- For now, returning a placeholder
  {{ return(['tools.rawkode.analytics.pageview', 'tools.rawkode.analytics.video']) }}
{% endmacro %}
