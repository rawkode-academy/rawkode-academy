# CLAUDE.md - Rawkode Studio Monorepo Conventions

## 📚 Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Code Formatting & Linting](#code-formatting--linting)
- [Commit Conventions](#commit-conventions)
- [TypeScript Guidelines](#typescript-guidelines)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Deployment](#deployment)
- [Command Reference](#command-reference)

## Overview

This is a monorepo containing multiple projects for the Rawkode Academy ecosystem. The codebase leverages modern web technologies with a focus on performance, type safety, and developer experience.

## Tech Stack

### Core Technologies
- **Runtime**: Bun (preferred) - Fast all-in-one JavaScript runtime
- **Language**: TypeScript (strict mode enabled)
- **Formatter/Linter**: Biome (v2.2.0+) - Fast, unified toolchain
- **Package Manager**: Bun

### Frontend Stack
- **Frameworks**: 
  - Astro 5+ (SSR) - Main web framework with server-side rendering
  - React 19+ - Interactive components with latest features
  - React Router v7 - Client-side routing
- **Styling**: 
  - Tailwind CSS v4 - Utility-first CSS with CSS variables
  - CSS Variables for design tokens
- **UI Components**: 
  - Radix UI - Accessible component primitives
  - shadcn/ui patterns - Composable component architecture
  - class-variance-authority (CVA) - Variant management
  - Lucide React - Icon library
- **State Management**:
  - TanStack Query v5 - Server state management
  - React Context - Application state
- **Real-time Features**:
  - Cloudflare RealTimeKit - WebRTC platform for video meetings
  - WebSockets - Real-time communication

### Backend Stack
- **Platform**: Cloudflare Workers/Pages with server-side rendering
- **Authentication**: 
  - Zitadel - Identity provider (OIDC/OAuth2)
  - Arctic - OAuth client library
  - OIDC Client TS - OpenID Connect client
  - Jose - JWT handling
- **Real-time Platform**: 
  - Cloudflare RealTimeKit - Video meeting infrastructure
  - WebRTC - Peer-to-peer communication
- **Database**: 
  - Cloudflare D1 (SQLite) - Primary database
  - Turso/LibSQL - Being phased out
- **ORM**: Drizzle ORM
- **GraphQL**: 
  - WunderGraph Cosmo - Federation router
  - Pothos - Type-safe schema builder
  - GraphQL Yoga - Server implementation
- **Workflows**: Cloudflare Workflows for durable execution

### Development Tools
- **Documentation**: 
  - Storybook - Component documentation
  - MDX - Rich documentation
- **Deployment**: 
  - Wrangler - Cloudflare deployment
  - Dagger - CI/CD automation

## Repository Structure

```
projects/
├── rawkode.studio/          # Main website (this project)
├── rawkode.academy/
│   ├── website/            # Academy website
│   ├── platform/           # Microservices
│   ├── forgepoint/         # Story mapping tool
│   └── infrastructure/     # K8s/deployment configs
├── rawkode.chat/           # Chat integrations
├── rawkode.tools/          # Analytics and tools
└── workshop-automation/     # Infrastructure automation
```

## Code Formatting & Linting

### Biome Configuration
All projects use Biome for formatting and linting with these conventions:

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"      // ALWAYS use tabs for indentation
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"   // ALWAYS use double quotes
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

### Key Formatting Rules
- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for strings
- **Semicolons**: Avoid unnecessary semicolons (ASI)
- **Line endings**: LF (Unix-style)
- **Trailing commas**: Use where valid
- **Import organization**: Automatic via Biome

### Running Format/Lint Commands
```bash
bun run format  # Format code
bun run lint    # Lint and auto-fix
bun run check   # Combined format + lint
```

## Commit Conventions

Use conventional commits with monorepo-aware scoping:

### Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance tasks
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `perf`: Performance improvements
- `revert`: Revert previous commit

### Scope Examples
- `feat(rawkode.studio): add dark mode toggle`
- `fix(rawkode.academy/website): resolve hydration issue`
- `chore(platform/videos): update dependencies`
- `docs(forgepoint): add API documentation`

### Commit Message Footer
For AI-assisted commits, append:
```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Authentication & Authorization

This application uses Zitadel as the identity provider with OIDC (OpenID Connect) for authentication.

### Authentication Flow

#### PKCE OAuth2 Flow
```typescript
// Authentication setup with PKCE
import { Arctic } from "arctic";

const zitadel = new Arctic({
	clientId: ZITADEL_CLIENT_ID,
	authorizeEndpoint: `${ZITADEL_URL}/oauth/v2/authorize`,
	tokenEndpoint: `${ZITADEL_URL}/oauth/v2/token`,
});

// Generate PKCE challenge
const { codeVerifier, codeChallenge } = await zitadel.generatePKCE();
```

#### JWT Token Handling
```typescript
import { jwtVerify, SignJWT } from "jose";

// Verify JWT tokens
const { payload } = await jwtVerify(
	token,
	new TextEncoder().encode(SECRET),
	{ issuer: ZITADEL_URL }
);

// Create session tokens
const sessionToken = await new SignJWT({ sub: userId })
	.setProtectedHeader({ alg: "HS256" })
	.setIssuedAt()
	.setExpirationTime("24h")
	.sign(new TextEncoder().encode(SECRET));
```

### Authentication Context

```typescript
// AuthContext.tsx pattern
interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	login: () => void;
	logout: () => void;
	isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
```

### Route Protection

```typescript
// RouteGuard component pattern
interface RouteGuardProps {
	children: React.ReactNode;
	requireAuth?: boolean;
	redirectTo?: string;
}

export function RouteGuard({ 
	children, 
	requireAuth = true, 
	redirectTo = "/login" 
}: RouteGuardProps) {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) return <LoadingSpinner />;
	
	if (requireAuth && !isAuthenticated) {
		return <Navigate to={redirectTo} replace />;
	}

	return <>{children}</>;
}
```

### API Route Protection

```typescript
// Middleware pattern for API routes
export async function onRequest(
	context: APIContext,
	next: MiddlewareNext
): Promise<Response> {
	const token = context.request.headers.get("authorization")?.replace("Bearer ", "");
	
	if (!token) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { payload } = await jwtVerify(
			token,
			new TextEncoder().encode(AUTH_SECRET)
		);
		
		context.locals.user = payload;
		return next();
	} catch {
		return new Response("Invalid token", { status: 401 });
	}
}
```

### Security Best Practices

- **PKCE Flow**: Always use PKCE for OAuth2 flows
- **Secure Cookies**: Use `httpOnly`, `secure`, `sameSite` attributes
- **Token Validation**: Verify JWT signatures and claims
- **CORS**: Configure proper origin checking in Astro config
- **State Parameters**: Use cryptographically secure state for OAuth

## RealTimeKit Integration

Cloudflare RealTimeKit provides the WebRTC infrastructure for video meetings, recording, and livestreaming.

### Environment Configuration

```typescript
// Environment variables for RealTimeKit
REALTIMEKIT_ORGANIZATION_ID=your-org-id
REALTIMEKIT_API_KEY=your-api-key
REALTIMEKIT_API_URL=https://rtk.realtime.cloudflare.com/v2
REALTIMEKIT_STREAM_URL=rtmps://live.cloudflare.com:443/live/
REALTIMEKIT_ENABLE_RECORDING=true
REALTIMEKIT_ENABLE_LIVESTREAM=true
REALTIMEKIT_ENABLE_ANALYTICS=true
```

### Meeting Management

#### Creating Meetings
```typescript
// API route: /api/meetings.ts
import { createMeeting } from "@/lib/realtime-kit";

export async function POST({ request }: APIContext) {
	const { title, description, scheduledAt } = await request.json();
	
	try {
		const meeting = await createMeeting({
			title,
			description,
			scheduledAt,
			settings: {
				recording: {
					enabled: REALTIMEKIT_ENABLE_RECORDING,
					autoStart: true,
				},
				livestream: {
					enabled: REALTIMEKIT_ENABLE_LIVESTREAM,
				},
			},
		});
		
		return Response.json(meeting);
	} catch (error) {
		return new Response("Failed to create meeting", { status: 500 });
	}
}
```

#### Session Management
```typescript
// Creating a session for a meeting
export async function createSession(meetingId: string) {
	return await fetch(`${REALTIMEKIT_API_URL}/meetings/${meetingId}/sessions`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${REALTIMEKIT_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			participantLimits: {
				maxParticipants: 50,
				maxScreenShares: 3,
			},
		}),
	});
}
```

### React Components

#### Meeting Provider Pattern
```typescript
import { RealTimeKitProvider } from "@cloudflare/realtimekit-react";

interface MeetingProviderProps {
	children: React.ReactNode;
	meetingId: string;
	sessionToken: string;
}

export function MeetingProvider({ 
	children, 
	meetingId, 
	sessionToken 
}: MeetingProviderProps) {
	return (
		<RealTimeKitProvider
			organizationId={REALTIMEKIT_ORGANIZATION_ID}
			apiKey={sessionToken}
			meetingId={meetingId}
			options={{
				audio: { enabled: true },
				video: { enabled: true },
				screen: { enabled: true },
			}}
		>
			{children}
		</RealTimeKitProvider>
	);
}
```

#### Video Meeting Component
```typescript
import { 
	useLocalParticipant, 
	useRemoteParticipants,
	useDevices,
	useRoom
} from "@cloudflare/realtimekit-react";

export function VideoMeeting() {
	const localParticipant = useLocalParticipant();
	const remoteParticipants = useRemoteParticipants();
	const { cameras, microphones, speakers } = useDevices();
	const { isConnected, connectionState } = useRoom();

	return (
		<div className="meeting-container">
			{/* Local participant video */}
			<div className="local-video">
				{localParticipant?.videoTrack && (
					<video
						ref={localParticipant.videoTrack.attach()}
						autoPlay
						muted
						playsInline
					/>
				)}
			</div>

			{/* Remote participants grid */}
			<div className="participants-grid">
				{remoteParticipants.map((participant) => (
					<ParticipantVideo 
						key={participant.id} 
						participant={participant} 
					/>
				))}
			</div>

			{/* Meeting controls */}
			<MeetingControls />
		</div>
	);
}
```

### Recording & Livestreaming

#### Starting Recording
```typescript
export async function startRecording(sessionId: string) {
	return await fetch(`${REALTIMEKIT_API_URL}/sessions/${sessionId}/recording`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${REALTIMEKIT_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			format: "mp4",
			quality: "1080p",
			layout: "grid",
		}),
	});
}
```

#### Livestream Configuration
```typescript
export async function startLivestream(sessionId: string, streamKey: string) {
	return await fetch(`${REALTIMEKIT_API_URL}/sessions/${sessionId}/livestream`, {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${REALTIMEKIT_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			rtmpUrl: `${REALTIMEKIT_STREAM_URL}${streamKey}`,
			layout: "speaker",
			resolution: "1920x1080",
		}),
	});
}
```

### Custom Hooks

#### useMeetings Hook
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";

export function useMeetings() {
	const { data: meetings, isLoading } = useQuery({
		queryKey: ["meetings"],
		queryFn: async () => {
			const response = await fetch("/api/meetings");
			return response.json();
		},
	});

	const createMeeting = useMutation({
		mutationFn: async (meetingData: CreateMeetingRequest) => {
			const response = await fetch("/api/meetings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(meetingData),
			});
			return response.json();
		},
	});

	return {
		meetings,
		isLoading,
		createMeeting: createMeeting.mutate,
		isCreating: createMeeting.isPending,
	};
}
```

### Error Handling

```typescript
// RealTimeKit error handling
interface RTKError {
	code: string;
	message: string;
	details?: Record<string, any>;
}

export function handleRTKError(error: RTKError) {
	switch (error.code) {
		case "PARTICIPANT_LIMIT_EXCEEDED":
			return "Meeting is full. Please try again later.";
		case "INVALID_SESSION":
			return "Session has expired. Please rejoin.";
		case "NETWORK_ERROR":
			return "Connection lost. Attempting to reconnect...";
		default:
			return "An unexpected error occurred.";
	}
}
```

### Best Practices

- **Token Management**: Use short-lived session tokens for security
- **Graceful Degradation**: Handle network failures and reconnection
- **Permission Handling**: Request camera/microphone permissions early
- **Performance**: Implement virtual scrolling for large participant lists
- **Accessibility**: Add ARIA labels and keyboard navigation
- **Mobile Support**: Test on mobile devices and handle orientation changes

## TypeScript Guidelines

### Configuration
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Best Practices
- Enable strict mode
- Use type imports: `import type { ... }`
- Prefer interfaces over type aliases for objects
- Use const assertions for literals
- Avoid `any`, use `unknown` when type is truly unknown
- Define explicit return types for public APIs

## Frontend Development

### React Component Patterns

```typescript
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const componentVariants = cva(
	"base-classes",
	{
		variants: {
			variant: {
				default: "default-classes",
				secondary: "secondary-classes",
			},
			size: {
				default: "h-10 px-4",
				sm: "h-9 px-3",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ComponentProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof componentVariants> {
	// Additional props
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<div
				className={cn(componentVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Component.displayName = "Component";

export { Component };
```

### Astro Components
- Use `.astro` for static components
- Use `.tsx` for interactive components
- Leverage Astro's partial hydration directives
- Use content collections for structured content

### Styling Conventions

#### Design Tokens (CSS Variables)
```css
:root {
  /* Brand Colors */
  --color-primary: #5f5ed7;
  --color-secondary: #00ceff;
  --color-tertiary: #04b59c;
  --color-quaternary: #85ff95;
  
  /* Typography */
  --font-display: var(--font-quicksand), sans-serif;
  --font-body: var(--font-poppins), sans-serif;
  --font-mono: "Monaspace", monospace;
}
```

#### Tailwind Usage
- Use Tailwind v4 with CSS variables
- Prefer utility classes over custom CSS
- Use `cn()` utility for conditional classes
- Organize classes: layout → spacing → typography → colors → effects

### File Organization
```
src/
├── app/                # App-specific components
│   ├── providers/      # Context providers
│   └── pages/          # Page components
├── components/         # Shared components
│   ├── ui/            # Base UI components
│   └── layouts/       # Layout components
├── lib/               # Utilities and helpers
├── styles/            # Global styles
└── pages/             # Astro pages/routes
```

## Backend Development

### GraphQL Microservice Structure
Each service follows this pattern:
```
service-name/
├── data-model/         # Database layer
│   ├── schema.ts      # Drizzle schema
│   ├── client.ts      # D1 client setup
│   └── migrations/    # SQL migrations
├── read-model/        # GraphQL API
│   ├── schema.ts      # GraphQL schema
│   ├── main.ts        # Worker entry
│   └── wrangler.jsonc # Deployment config
└── write-model/       # Write operations
    └── workflow.ts    # Cloudflare Workflows
```

### Database Conventions
- **Use Cloudflare D1** for all new services
- **Schema-first approach** with Drizzle ORM
- **CUID2** for primary keys
- **Timestamps** on all tables (created_at, updated_at)
- **Soft deletes** where appropriate

### GraphQL Best Practices
- Use federation for service composition
- Keep schemas minimal and focused
- Implement proper error handling
- Use DataLoader pattern for N+1 prevention
- Add proper authorization checks

### Cloudflare Workers Configuration
```jsonc
{
  "name": "service-name",
  "compatibility_date": "2025-05-05",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "service-db",
    "database_id": "..."
  }]
}
```

## Deployment

### Cloudflare Pages/Workers
1. Build the project: `bun run build`
2. Deploy: `bun run wrangler deploy`
3. Preview: `bun run preview`

### Environment Variables
- Development: `.dev.vars` file
- Production: Set via Cloudflare dashboard or wrangler secret

### D1 Database Management
```bash
# Create database
wrangler d1 create <database-name>

# Run migrations
wrangler d1 migrations apply <database-name>

# Execute SQL
wrangler d1 execute <database-name> --command="SELECT * FROM table"
```

## Command Reference

### Development
```bash
bun install           # Install dependencies
bun run dev          # Start dev server
bun run dev:wrangler # Start with Wrangler
```

### Building
```bash
bun run build        # Build for production
bun run preview      # Preview production build
```

### Code Quality
```bash
bun run format       # Format code with Biome
bun run lint        # Lint and fix issues
bun run check       # Run all checks
bun run typecheck   # TypeScript type checking
```

### Deployment
```bash
wrangler deploy     # Deploy to Cloudflare
wrangler dev        # Local development with bindings
wrangler tail       # Stream logs
```

### Storybook
```bash
bun run storybook        # Start Storybook dev
bun run build-storybook  # Build Storybook
```

## Important Guidelines

### DO
- ✅ Use Bun as the primary runtime
- ✅ Use tabs for indentation
- ✅ Use double quotes for strings
- ✅ Use Cloudflare D1 for new services
- ✅ Follow conventional commit format
- ✅ Use TypeScript strict mode
- ✅ Leverage Cloudflare's edge capabilities
- ✅ Use CSS variables for theming
- ✅ Implement proper error boundaries

### DON'T
- ❌ Use Turso/LibSQL for new services (being phased out)
- ❌ Use spaces for indentation
- ❌ Use single quotes (except in specific contexts)
- ❌ Commit without running format/lint
- ❌ Use `any` type without justification
- ❌ Create unnecessary files or documentation
- ❌ Ignore TypeScript errors
- ❌ Store secrets in code
- ❌ Use synchronous operations in Workers
- ❌ Bypass the established patterns

## Getting Help

- Check existing code for patterns
- Review service-specific CLAUDE.md files
- Use TypeScript for type safety
- Leverage IDE integrations for Biome
- Test locally with `wrangler dev`

## Performance Considerations

- Use Cloudflare's caching capabilities
- Implement proper lazy loading
- Optimize bundle sizes
- Use partial hydration in Astro
- Leverage edge computing
- Implement proper database indexing
- Use connection pooling where applicable

---

**Remember**: Consistency is key. When in doubt, follow existing patterns in the codebase.