# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

rawkode.studio is a live streaming web application built with Astro, React, and Cloudflare Workers. It provides professional video streaming capabilities via LiveKit WebRTC, authentication through Zitadel OIDC, and uses Turso (distributed SQLite) with Drizzle ORM for data persistence.

## Development Commands

```bash
# Install dependencies (uses Bun exclusively)
bun install

# Run development server (auto-runs database migrations)
bun run astro:dev

# Format and lint code (uses Biome)
bun run astro:format

# Build for production (includes linting, type checking, and build)
bun run astro:build

# Update all shadcn UI components
bun run shadcn:update

# Upgrade dependencies interactively
bunx npm-check-updates --interactive
```

**Development Server**: Runs at `http://localhost:4321` after manual startup. Database migrations are applied automatically during dev server startup.

## Architecture

### Tech Stack
- **Frontend**: Astro 5.9 with React 19 islands architecture, Tailwind CSS, shadcn/ui components
- **Backend**: Cloudflare Workers (edge runtime), Astro Actions for type-safe server operations
- **Database**: Turso (distributed SQLite) with Drizzle ORM
- **Video/Audio**: LiveKit WebRTC infrastructure with auto-recording capability
- **Authentication**: Zitadel OIDC with role-based access control (director role for admin)
- **Storage**: S3-compatible object storage for recordings and assets
- **CI/CD**: Dagger for build pipelines, Cloudflare Pages for deployment

### Project Structure
```
src/
├── actions/           # Server-side operations (Astro Actions)
│   ├── chat.ts       # Chat messaging via server-sent events
│   ├── participants.ts # Participant management
│   └── rooms.ts      # Livestream room CRUD operations
├── components/
│   ├── livestreams/  # Streaming-specific components
│   │   ├── dialogs/  # Modal dialogs for livestream management
│   │   ├── forms/    # Form components (extensible)
│   │   ├── prejoin/  # Pre-join screen components
│   │   └── room/     # Core room functionality
│   │       ├── chat/        # Real-time chat UI
│   │       ├── controls/    # Room control components
│   │       ├── core/        # LiveKit integration layer
│   │       ├── hooks/       # Custom React hooks
│   │       ├── layouts/     # Video layout options (grid, presentation, etc.)
│   │       ├── media/       # Video/audio components
│   │       └── participants/ # Participant management UI
│   ├── pages/        # Page-level components
│   └── shadcn/       # shadcn/ui component library
├── hooks/            # Global React hooks
├── lib/              # Core utilities
│   ├── database.ts   # Turso/Drizzle client
│   ├── livekit.ts    # LiveKit client configuration
│   ├── security.ts   # Authentication helpers
│   └── zitadel.ts    # OIDC integration
├── pages/
│   ├── api/          # API endpoints
│   │   ├── auth/     # OIDC callbacks
│   │   ├── livestream/ # Livestream APIs
│   │   └── webhooks/ # LiveKit webhook handlers
│   └── watch/        # Public viewing pages
└── schema.ts         # Database schema definitions
```

### Database Schema
```typescript
// Three main tables in Turso:
livestreams          # Main livestream/room data
  - id, name, description
  - status: 'created' | 'running' | 'ended'
  - createdAt, startedAt, endedAt
  - isPublic, recordingEnabled

participants         # Users who joined livestreams
  - livestreamId, participantId, displayName
  - joinedAt, leftAt

chat_messages       # Chat history
  - livestreamId, participantId
  - content, timestamp
```

### Environment Variables
Configure in `.env` file (see `src/env.d.ts` for types):
```bash
# Turso Database
TURSO_URL=libsql://...
TURSO_AUTH_TOKEN=...

# LiveKit WebRTC
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://...

# Zitadel OIDC Authentication
ZITADEL_URL=https://...
ZITADEL_CLIENT_ID=...

# S3-Compatible Storage (for recordings)
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET_NAME=...

# Runtime Environment
PUBLIC_APP_URL=https://...
```

## Development Guidelines

### 1. Import Conventions
Always use absolute imports with the `@/` alias:
```typescript
// ✅ Correct
import { Button } from "@/components/shadcn/button"
import { Chat } from "@/components/livestreams/room/chat/Chat"
import { createRoom } from "@/actions/rooms"

// ❌ Incorrect
import { Button } from "../shadcn/button"
import { Chat } from "./Chat"
```

### 2. Code Style & Formatting
- **Formatter**: Biome (configured in `biome.json`)
- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for JavaScript/TypeScript
- **Import Organization**: Automatic via Biome
- Run `bun run astro:format` before committing

### 3. Component Development
- Place new components in appropriate subdirectories
- Use shadcn/ui components as building blocks
- Follow existing patterns for consistency
- Components should be typed with TypeScript

### 4. Server-Side Operations
Use Astro Actions for all server operations:
```typescript
// Define in src/actions/
export const myAction = defineAction({
  input: z.object({ /* schema */ }),
  handler: async (input, context) => {
    // Automatic auth via context.locals.user
    // Type-safe input validation
    // Automatic error handling
  }
});
```

### 5. Database Operations
- Modify schema in `src/schema.ts`
- Migrations auto-apply in development
- Use Drizzle ORM for queries:
```typescript
import { db } from "@/lib/database"
import { livestreams } from "@/schema"

const active = await db
  .select()
  .from(livestreams)
  .where(eq(livestreams.status, "running"))
```

### 6. Authentication & Authorization
- Authentication via Zitadel OIDC
- Role-based access: `director` role for admin actions
- Use `security.ts` helpers:
```typescript
import { hasDirectorRole } from "@/lib/security"

if (!hasDirectorRole(user)) {
  throw new Error("Unauthorized")
}
```

### 7. Real-time Features
- **Video/Audio**: LiveKit WebRTC handles streaming
- **Chat**: Server-sent events via Astro Actions
- **Updates**: LiveKit webhooks for room lifecycle
- **Layouts**: Multiple video layouts available

### 8. Error Handling
- Fix all TypeScript and linting errors properly
- Never use ignore comments (`biome-ignore`, etc.)
- Handle errors gracefully with user-friendly messages
- Log errors appropriately for debugging

### 9. Testing
- Currently no test infrastructure
- Manual testing via development server
- Consider adding tests for critical paths

### 10. Deployment
- Deploys to Cloudflare Pages/Workers
- Configuration in `wrangler.jsonc`
- Dagger handles CI/CD pipeline
- Environment variables set in Cloudflare dashboard

## Common Tasks

### Creating a New Livestream
1. User with director role accesses dashboard
2. Creates room via `createLivestream` action
3. System generates LiveKit room
4. Participants join with generated tokens

### Implementing a New Feature
1. Check existing patterns in codebase
2. Use Astro Actions for server logic
3. Build UI with shadcn components
4. Handle real-time updates appropriately
5. Test locally with dev server

### Debugging Issues
1. Check browser console for client errors
2. Check terminal for server errors
3. Verify environment variables
4. Check LiveKit dashboard for streaming issues
5. Review Cloudflare logs for production issues

## LiveKit Documentation Reference

The complete LiveKit documentation is available at https://docs.livekit.io/llms.txt for AI assistant reference. This includes:
- WebRTC SFU architecture and concepts
- Client SDK documentation for all platforms
- Server API reference
- Webhooks and event handling
- Recording and composition (Egress)
- AI Agents framework
- Integration examples and best practices