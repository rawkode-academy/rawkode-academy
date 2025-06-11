# Random Social Post

A Cloudflare Workers application that automatically shares random videos across multiple social media platforms on a daily schedule.

## Overview

This service runs as a Cloudflare Workflow that:
1. Fetches a random video from a collection
2. Generates platform-specific social media posts using AI
3. Publishes the posts to Bluesky, LinkedIn, and Zulip

The workflow is triggered daily at 9:00 AM UTC via a cron schedule.

## Features

- **Automated Content Sharing**: Shares content across multiple platforms automatically
- **AI-Generated Posts**: Uses Cloudflare AI to generate engaging, platform-specific content
- **Multi-Platform Support**: Currently supports Bluesky, LinkedIn, and Zulip
- **Cloudflare Workflows**: Built on Cloudflare's durable execution engine for reliability

## Prerequisites

- Node.js or Bun runtime
- Cloudflare account with Workers enabled
- API credentials for supported social platforms
- Access to Cloudflare AI

## Installation

```bash
# Install dependencies
bun install

# Generate TypeScript types for Cloudflare bindings
bun run cf-typegen
```

## Configuration

### Environment Variables

Configure the following in your `wrangler.jsonc` or via Cloudflare dashboard:

**Public Variables:**
- `BLUESKY_HANDLE`: Your Bluesky handle (e.g., "rawkode.academy")
- `LINKEDIN_USER_ID`: Your LinkedIn user ID
- `ZULIP_SERVER_URL`: Your Zulip server URL
- `ZULIP_BOT_EMAIL`: Email for your Zulip bot
- `ZULIP_STREAM_NAME`: Target Zulip stream name

**Secrets (via Cloudflare Secrets Store):**
- `BLUESKY_APP_PASSWORD`: Bluesky app password
- `LINKEDIN_ACCESS_TOKEN`: LinkedIn API access token
- `ZULIP_BOT_API_KEY`: Zulip bot API key

### Cron Schedule

The workflow runs daily at 9:00 AM UTC. Modify the cron expression in `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": [
    "0 9 * * *"  // Daily at 9:00 AM UTC
  ]
}
```

## Development

```bash
# Start local development server
bun run dev

# Deploy to Cloudflare
bun run deploy
```

## Project Structure

```
src/
├── index.ts                 # Main workflow entry point
├── env.d.ts                 # TypeScript environment definitions
├── steps/                   # Workflow step implementations
│   ├── fetchRandomVideo.ts  # Video fetching logic
│   ├── generateSocialPost.ts # AI post generation
│   └── publishToSocialPlatforms.ts # Platform publishing logic
└── prompts/                 # AI prompt templates
    ├── bluesky.txt
    ├── linkedin.txt
    └── zulip.txt
```

## Adding New Platforms

1. Add platform credentials to `env.d.ts`
2. Create a new prompt template in `src/prompts/`
3. Add the platform to `SocialPlatforms` enum
4. Implement publishing logic in `publishToSocialPlatforms.ts`

## Testing

```bash
# Run tests
bun test
```

## Monitoring

The workflow includes observability with 100% head sampling rate. Monitor your workflows via:
- Cloudflare dashboard
- Workers logs
- Workflow execution history

## License

Part of the RawkodeAcademy monorepo. See repository root for license information.