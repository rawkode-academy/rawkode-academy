# Analytics Monitoring

This directory contains monitoring and health checking services for the analytics platform.

## Components

### Health Checker

A Cloudflare Worker that performs synthetic monitoring of the analytics pipeline by:

1. **Health Endpoint Checks**: Verifies all services are responding
2. **Synthetic Event Generation**: Sends test events through the pipeline
3. **End-to-End Validation**: Confirms events flow from ingestion to storage
4. **Alert Generation**: Notifies on failures via webhook/email

#### Configuration

Set these environment variables in `wrangler.toml`:

```toml
[vars]
ALERT_WEBHOOK_URL = "https://your-webhook-endpoint.com/alerts"
ALERT_EMAIL = "alerts@yourdomain.com"
CHECK_TIMEOUT_MS = "30000"
SYNTHETIC_EVENT_TYPE = "analytics.synthetic.health_check"
```

#### Deployment

```bash
cd health-checker
wrangler deploy
```

#### Health Checks Performed

1. **Event Collector Health** (`/health`)
   - Verifies the service is running
   - Expected: 200 OK

2. **Single Event Ingestion** (`/events`)
   - Sends a synthetic CloudEvent
   - Validates response structure
   - Expected: 200 OK with success=true

3. **Buffer Status Check** (`/debug/status/{event_type}`)
   - Checks Durable Object buffer state
   - Verifies synthetic events are buffered

4. **R2 Connectivity** (`/debug/test-r2`)
   - Tests R2 bucket read/write access
   - Verifies storage layer is functional

#### Metrics

The health checker writes metrics to Analytics Engine:
- Check success/failure rates
- Response times
- Error counts by type

#### Alerts

Failed health checks trigger alerts via:
- Webhook (configurable URL)
- Email (requires email service integration)

Alert payload includes:
- Severity level
- Failed checks details
- Timestamp and error messages

## Future Enhancements

1. **Dashboards**: Grafana dashboards for health metrics
2. **SLA Tracking**: Calculate and report uptime percentages
3. **Intelligent Alerting**: Reduce noise with smart thresholds
4. **Recovery Actions**: Automatic remediation for common issues