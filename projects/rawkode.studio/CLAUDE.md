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
  - `active/` - Active livestream management components
  - `past/` - Past livestream viewing components
  - `room/` - Shared room components (video grid, chat, controls)
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

1. **Import Conventions**: Always use absolute imports with the `@/` alias instead of relative imports. For example:
   - ✅ `import { Button } from "@/components/shadcn/button"`
   - ❌ `import { Button } from "../shadcn/button"`
   - ✅ `import { Chat } from "@/components/livestreams/room/Chat"`
   - ❌ `import { Chat } from "./Chat"`

2. **Component Organization**: Place new UI components in appropriate subdirectories under `src/components/`. Use shadcn components from `src/components/shadcn/` as building blocks.

3. **Server Actions**: Use Astro Actions in `src/actions/` for server-side operations. These are type-safe and handle authentication automatically.

4. **Database Changes**: Modify `src/schema.ts` and run migrations. The dev server automatically applies migrations on startup.

5. **Authentication**: Use the `security.ts` utilities for authentication checks. The `director` role is required for administrative actions.

6. **Real-time Features**: LiveKit handles video/audio streaming. Chat uses server-sent events through Astro Actions.

## LiveKit Documentation Reference

The following LiveKit documentation is available at https://docs.livekit.io/llms.txt:

# LiveKit Docs

> LiveKit is an open source platform for developers building realtime media applications. It makes it easy to integrate audio, video, text, data, and AI models while offering scalable realtime infrastructure built on top of WebRTC.

## Overview

LiveKit contains these primary components:

- [Open source WebRTC SFU](https://github.com/livekit/livekit), with a hosted global mesh version available as [LiveKit Cloud](https://cloud.livekit.io)
- [Open source AI Agents Framework](https://github.com/livekit/agents) for building realtime and Voice AI agents in Python (Node.js beta also [available](https://github.com/livekit/agents-js))
- [Realtime SDKs](https://docs.livekit.io/home/client/connect.md) to make it easy to add realitme audio, video, and data to your apps (available for Web, iOS, Android, Flutter, React Native, Unity, Python, Node.js, Rust, and more))
- [Telephony integration](https://docs.livekit.io/sip.md) built on SIP for integrating telephony into LiveKit rooms

For greater detail, see [Intro to LiveKit](https://docs.livekit.io/home/get-started/intro-to-livekit.md).

### Key Documentation Sections

#### Home - Core Platform
- Get Started: Authentication, Rooms/participants/tracks
- CLI: Templates and bootstrapping
- LiveKit SDKs: Realtime media, text & data, state synchronization
- Server APIs: Token generation, room/participant management, webhooks
- Recording & Composition: Egress service for recording/livestreaming
- Stream Ingest: Bringing non-WebRTC sources into rooms
- Cloud: Architecture, billing, analytics
- Self-hosting: Deployment options including Kubernetes

#### Agents - AI Framework
- Getting Started: Voice AI quickstart, telephony integration
- Building Voice Agents: Workflows, audio/vision, tools, turn detection
- Integrations: Partner support for OpenAI, Google, Azure, AWS, Groq, and more
- Deployment: Production deployment and recording/transcripts

#### Telephony - SIP Integration
- Getting Started: SIP trunk setup
- Provider Guides: Twilio, Telnyx, Plivo
- Features: DTMF, cold transfer, HD voice
- API Reference: SIP participant management

### Integration Partners

**LLM Providers:**
- OpenAI (including Realtime API)
- Google Gemini (including Live API) 
- Azure OpenAI
- Anthropic Claude
- Amazon Bedrock
- Cerebras, DeepSeek, Fireworks, Groq, Letta, Ollama, Perplexity, Together AI, xAI

**Speech-to-Text (STT):**
- AssemblyAI, Amazon Transcribe, Azure AI Speech, Clova, Deepgram, fal, Gladia, Google Cloud, Groq, OpenAI, Speechmatics

**Text-to-Speech (TTS):**
- Amazon Polly, Azure AI Speech, Cartesia, Deepgram, ElevenLabs, Google Cloud, Groq, Hume, Neuphonic, OpenAI, PlayHT, Resemble AI, Rime, Speechify

**Virtual Avatars:**
- Beyond Presence, bitHuman, Tavus

### Example Applications

- Voice assistants (Swift, Next.js, Flutter, React Native, Android)
- Medical office triage agent
- Personal shopping assistant
- Restaurant ordering agent
- LivePaint - realtime drawing game with AI judge
- Push-to-talk multi-participant conversations
- Background audio for thinking states
- Multi-language switching agents

For the complete documentation, visit the individual pages at https://docs.livekit.io/