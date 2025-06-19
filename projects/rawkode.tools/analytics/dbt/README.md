# Analytics dbt Project

This is the base dbt project for the Rawkode Analytics Platform. It provides macros and utilities that individual projects can use to build their own analytics models.

## For Platform Users

If you're building analytics for your project, you don't need to modify this base dbt project. Instead:

1. **Create your own dbt models in your project**:
   ```
   your-project/
   ├── analytics/
   │   ├── models/
   │   │   ├── staging/
   │   │   │   └── stg_your_events.sql
   │   │   └── marts/
   │   │       └── your_metrics.sql
   │   └── dbt_project.yml
   ```

2. **Use the provided macros** in your models:

   ```sql
   -- your-project/analytics/models/staging/stg_page_views.sql
   {{ config(materialized='view') }}

   WITH source AS (
       {{ read_cloudevents('com.yourproject.pageview', start_date='2024-01-01') }}
   )

   SELECT
       {{ cloudevents_base_schema() }},
       
       -- Your event-specific fields
       data_page_url AS page_url,
       data_page_title AS page_title,
       data_referrer AS referrer
       
   FROM source
   ```

3. **Define your event schemas** in your project's documentation.

## Available Macros

### `read_cloudevents(event_type, start_date=none, end_date=none)`
Reads CloudEvents from R2 storage for a specific event type.

**Parameters:**
- `event_type`: The CloudEvent type (e.g., 'com.example.pageview')
- `start_date`: Optional start date filter
- `end_date`: Optional end date filter

**Example:**
```sql
{{ read_cloudevents('com.example.pageview', start_date='2024-01-01') }}
```

### `cloudevents_base_schema()`
Returns the standard CloudEvents fields with consistent naming.

**Example:**
```sql
SELECT
    {{ cloudevents_base_schema() }},
    -- Your additional fields here
FROM source
```

### `flatten_cloudevent_data(prefix='data_')`
Extracts and renames data fields from flattened CloudEvents.

**Example:**
```sql
SELECT
    event_id,
    event_time,
    {{ flatten_cloudevent_data() }}
FROM source
```

## Platform Architecture

The analytics platform handles:
- **Event ingestion** via CloudEvents
- **Storage** in Parquet format on R2
- **Cataloging** of available data
- **Compaction** of small files

Your project only needs to:
1. Send CloudEvents to the collector
2. Define dbt models for your specific analytics needs
3. Query the results

## Best Practices

1. **Use views for staging models** - The raw data is already stored efficiently in Parquet
2. **Materialize only aggregated data** - Create tables only for frequently-queried aggregations
3. **Partition by date** - Use date filters in your queries for better performance
4. **Document your events** - Use dbt's documentation features to describe your event schemas

## Running dbt

To run dbt models that use this platform:

```bash
# Set up your R2 credentials
export R2_ACCESS_KEY_ID=your_key
export R2_SECRET_ACCESS_KEY=your_secret

# Run your models
cd your-project/analytics
dbt run --profiles-dir .