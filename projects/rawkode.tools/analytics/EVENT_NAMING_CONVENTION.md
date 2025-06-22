# Analytics Event Naming Convention

## Current Issues
- Video events use generic `analytics.video.event` with action in data
- Inconsistent with other event types like `analytics.web.pageview`
- Makes partitioning and querying less efficient

## Proposed Event Naming Convention

### Web Events
- `analytics.web.pageview` - Page view event
- `analytics.web.page_exit` - Page exit event (with time on page)
- `analytics.web.click` - Click events on links/buttons
- `analytics.web.form_submit` - Form submission events
- `analytics.web.search` - Search events

### Video Events (Updated)
- `analytics.video.play` - Video play event
- `analytics.video.pause` - Video pause event
- `analytics.video.seek` - Video seek event
- `analytics.video.progress` - Video progress milestones (25%, 50%, 75%)
- `analytics.video.complete` - Video completion event
- `analytics.video.error` - Video playback error

### Social Events
- `analytics.social.share` - Content shared on social platforms
- `analytics.social.follow` - Social follow actions
- `analytics.social.like` - Social like/favorite actions

### Engagement Events
- `analytics.engagement.reaction` - Emoji reactions on content
- `analytics.engagement.comment` - Comment posted
- `analytics.engagement.vote` - Voting on content

### User Events
- `analytics.user.signup` - User registration
- `analytics.user.login` - User login
- `analytics.user.logout` - User logout
- `analytics.user.profile_update` - Profile updates

## Benefits
1. **Better Partitioning**: Events naturally partition by specific actions
2. **Clearer Queries**: No need to filter by action field
3. **Consistent Structure**: All events follow `analytics.{category}.{action}` pattern
4. **Performance**: Iceberg can optimize storage and queries better

## Migration Plan
1. Update the Analytics library to use specific event types
2. Update the SDK to send proper event types
3. Keep backward compatibility by mapping old events
4. Gradually phase out generic event types

## Example Query Impact

### Before:
```sql
SELECT * FROM events 
WHERE type = 'analytics.video.event' 
AND data->>'action' = 'play'
```

### After:
```sql
SELECT * FROM events 
WHERE type = 'analytics.video.play'
```

This makes queries simpler, faster, and more intuitive.