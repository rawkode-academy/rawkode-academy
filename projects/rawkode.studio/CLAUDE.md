# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a live streaming web application built with Astro, React, and Cloudflare Workers. It provides video streaming capabilities via LiveKit, authentication through Zitadel OIDC, and uses Turso (distributed SQLite) with Drizzle ORM for data persistence.

## Development Commands

```bash
# Install dependencies (uses Bun)
bun install

# Run development server (includes database migrations)
bun run astro:dev

# Format and lint code
bun run astro:format

# Build for production (includes linting and type checking)
bun run astro:build

# Update shadcn UI components
bun run shadcn:update

# Upgrade dependencies interactively
bunx npm-check-updates --interactive
```

**Note**: The dev server is always started manually and runs at `http://localhost:4321`. You can make requests to this URL for testing.

## Architecture

### Tech Stack
- **Frontend**: Astro 5.8 with React 19 islands, Tailwind CSS, shadcn/ui components
- **Backend**: Cloudflare Workers (edge runtime), Astro Actions for server operations
- **Database**: Turso (distributed SQLite) with Drizzle ORM
- **Video Streaming**: LiveKit WebRTC infrastructure
- **Authentication**: Zitadel OIDC with role-based access (director role)

### Key Directories
- `src/actions/` - Server-side operations (room management, chat, auth)
- `src/components/livestreams/` - Video streaming UI components
- `src/pages/api/` - API endpoints (auth callbacks, webhooks)
- `src/lib/` - Core utilities (database client, LiveKit client, auth helpers)
- `drizzle/` - Database migrations and schema snapshots

### Database Schema
Three main tables:
- `rooms` - Streaming room metadata
- `participants` - Users who joined rooms
- `chat_messages` - Chat history for rooms

### Environment Variables
Required environment variables are defined in `src/env.d.ts`:
- `DATABASE_URL`, `DATABASE_AUTH_TOKEN` - Turso database connection
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` - LiveKit configuration
- `ZITADEL_*` - OIDC authentication configuration

### Deployment
The application is deployed to Cloudflare Pages/Workers. Configuration is in `wrangler.jsonc` and the Cloudflare adapter is configured in `astro.config.ts`.

## Development Guidelines

1. **Component Organization**: Place new UI components in appropriate subdirectories under `src/components/`. Use shadcn components from `src/components/shadcn/` as building blocks.

2. **Server Actions**: Use Astro Actions in `src/actions/` for server-side operations. These are type-safe and handle authentication automatically.

3. **Database Changes**: Modify `src/schema.ts` and run migrations. The dev server automatically applies migrations on startup.

4. **Authentication**: Use the `security.ts` utilities for authentication checks. The `director` role is required for administrative actions.

5. **Real-time Features**: LiveKit handles video/audio streaming. Chat uses server-sent events through Astro Actions.