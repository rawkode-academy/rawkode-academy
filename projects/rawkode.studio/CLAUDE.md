# CLAUDE.md - Rawkode Studio

> Video meeting platform built with Astro, React, and Cloudflare RealTimeKit

## 🚀 Quick Start

```bash
bun install           # Install dependencies
bun run dev          # Start development server (user will run this)
bun run format       # Format code before committing
bun run lint         # Lint and fix issues
bun run build        # Build for production (always run before committing)
```

**Note**: Claude will NEVER start the dev server automatically - you control when to start it.

## ⚡ Critical Rules

**NEVER break these:**
- ✅ Use **tabs** for indentation (not spaces)
- ✅ Use **double quotes** for strings
- ✅ Always use **Tailwind CSS v4** (not v3)
- ✅ All imports must use **@/** prefix (e.g., `@/lib/utils`, `@/components/ui/button`)
- ✅ Use **Radix UI** as the component library base
- ✅ Use **Astro's env mechanism** for all environment variables (`astro:env/server`, `astro:env/client`)
- ✅ Consult `src/lib/realtime-kit/api.yaml` OpenAPI spec when implementing methods in `src/lib/realtime-kit/client.ts`
- ✅ Run `bun run format && bun run lint && bun run build` before committing
- ✅ **NEVER** start the dev server automatically (user will start it)
- ✅ Use TypeScript strict mode
- ✅ Follow component patterns in `src/components/ui/`

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/               # Reusable UI components (Button, Dialog, etc.)
│   ├── app/              # App-specific components
│   └── meeting/          # Meeting-related components
├── pages/                # Astro page routes
├── lib/                  # Utilities and helpers
└── styles/               # Global styles with CSS variables
```

## 🛠️ Common Tasks

### Adding a New UI Component
1. Create component in `src/components/ui/component-name.tsx`
2. Use this pattern:
```typescript
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const componentVariants = cva(
	"bg-background text-foreground border-border",
	{
		variants: {
			variant: { 
				default: "bg-primary text-primary-foreground", 
				secondary: "bg-secondary text-secondary-foreground",
				outline: "border-2 bg-transparent hover:bg-accent hover:text-accent-foreground"
			},
			size: { default: "px-4 py-2", sm: "px-3 py-1.5", lg: "px-6 py-3" },
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

interface ComponentProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof componentVariants> {}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
	({ className, variant, size, ...props }, ref) => (
		<div
			className={cn(componentVariants({ variant, size }), className)}
			ref={ref}
			{...props}
		/>
	),
);
Component.displayName = "Component";

export { Component };
```

### Theme System Architecture
The app uses a CSS variable-based theming system with Tailwind CSS v4:

- **Theme Definition**: Colors are defined in the `@theme` directive in `src/styles/global.css`
- **Runtime Switching**: CSS variables in `:root` and `.dark` selectors handle light/dark mode
- **Semantic Utilities**: Use semantic color classes like `bg-background`, `text-foreground`, `bg-primary`
- **Theme Provider**: `<ThemeProvider>` from `@/app/providers/ThemeProvider` manages theme state (light/dark/system)

```typescript
// ✅ Preferred - Use semantic color utilities (maps to CSS variables)
"bg-background text-foreground border-border"
"bg-primary text-primary-foreground"
"bg-card text-card-foreground"

// ✅ For solid overlays/dialogs that need explicit backgrounds
"bg-white dark:bg-gray-900"

// ✅ For translucent backgrounds
"bg-primary/10 border-primary/20"
```

### Adding Authentication
- Use existing `AuthContext` in `src/components/app/contexts/AuthContext.tsx`
- Protect routes with `RouteGuard` component
- Check patterns in `src/components/app/pages/Dashboard.tsx`

### Working with Meetings
- API routes in `src/pages/api/meetings.ts`
- Meeting list in `src/components/app/pages/Dashboard.tsx`
- Meeting components in `src/components/meeting/`
- Use `useMeetings` hook for data fetching

### API Development with RealTimeKit
- **Source of Truth**: Always consult `src/lib/realtime-kit/api.yaml` for the complete OpenAPI specification
- **Implementation**: Add new methods to `src/lib/realtime-kit/client.ts` based on the OpenAPI spec
- **Pattern**: Follow existing method patterns in the client for consistency
- **Types**: Define TypeScript interfaces that match the API schema exactly
- **Error Handling**: Use the `RealtimeKitError` class for consistent error management

```typescript
// Example: Adding a new API method
// 1. Check src/lib/realtime-kit/api.yaml for the endpoint definition
// 2. Add method to RealtimeKitClient class following this pattern:
async newApiMethod(params: NewApiParams): Promise<NewApiResponse> {
	this.validateRequiredString(params.id, "id");
	return this.request(`/new-endpoint/${params.id}`, {
		method: "POST",
		body: JSON.stringify(params),
	});
}
```

### Environment Variables with Astro
- **ALWAYS** use Astro's built-in env mechanism - NEVER use `process.env` directly
- **Server-side**: Import from `astro:env/server` for sensitive data (API keys, secrets)
- **Client-side**: Import from `astro:env/client` for public configuration
- **Type Safety**: Astro provides full TypeScript support for env vars

```typescript
// ✅ Correct - Server-side env vars (sensitive data)
import { REALTIMEKIT_API_KEY, REALTIMEKIT_ORGANIZATION_ID, AUTH_STATE_SECRET } from "astro:env/server";

// ✅ Correct - Client-side env vars (public config)
import { REALTIMEKIT_ENABLE_RECORDING, REALTIMEKIT_ENABLE_LIVESTREAM } from "astro:env/client";

// ❌ Wrong - Don't use process.env directly
const apiKey = process.env.REALTIMEKIT_API_KEY; // Avoid this

// ✅ Example usage in API client
export class RealtimeKitClient {
	constructor() {
		this.apiKey = REALTIMEKIT_API_KEY; // Type-safe, server-only
		this.orgId = REALTIMEKIT_ORGANIZATION_ID;
	}
}
```

**Configuration**: Define env vars in `astro.config.ts` with proper schema validation.

## 🔧 Tech Stack Essentials

| Category | Technology | Usage |
|----------|------------|-------|
| **Runtime** | Bun | Package manager, dev server |
| **Framework** | Astro 5 + React 19 | SSR + client-side interactivity |
| **Styling** | Tailwind CSS v4 | Utility-first with CSS variables |
| **UI** | Radix UI + shadcn/ui | Accessible component primitives |
| **Video** | Cloudflare RealTimeKit | WebRTC meetings, recording |
| **Database** | Cloudflare D1 (SQLite) | Primary database |
| **Auth** | Zitadel (OIDC) | Identity provider |
| **Deployment** | Cloudflare Pages/Workers | Edge deployment |

## 🎨 Styling Guidelines

### Theme System with CSS Variables
The project uses Tailwind CSS v4's `@theme` directive combined with CSS custom properties:

```css
/* Token Definition (global.css) */
@theme {
	/* Brand Colors */
	--color-primary: #5f5ed7;
	--color-secondary: #00ceff;
	--color-tertiary: #04b59c;
	--color-quaternary: #85ff95;
}

/* Runtime Theme Switching */
:root {
	/* Light mode semantic colors */
	--color-background: hsl(0 0% 100%);
	--color-foreground: #111827;
	--color-card: hsl(0 0% 100%);
	--color-muted: hsl(220 14.3% 95.9%);
}

.dark {
	/* Dark mode semantic colors */
	--color-background: #111827;
	--color-foreground: hsl(210 20% 98%);
	--color-card: hsl(217.2 32.6% 17.5%);
	--color-muted: hsl(217.2 32.6% 17.5%);
}
```

### Using Theme Colors in Components
```typescript
// ✅ Semantic utilities (automatically use CSS variables)
className="bg-background text-foreground border-border"
className="bg-primary text-primary-foreground"
className="bg-card border-border p-4"

// ✅ Opacity modifiers work with semantic colors
className="bg-primary/10 border-primary/20"

// ✅ Hover states with semantic colors
className="hover:bg-accent hover:text-accent-foreground"
```

### Using the Theme System
```typescript
// Import the theme hook
import { useTheme } from "@/app/providers/ThemeProvider";

// In your component
const { theme, setTheme, actualTheme } = useTheme();

// Theme values: "light" | "dark" | "system" 
// actualTheme values: "light" | "dark" (resolved from system if needed)

// Toggle theme
<Button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
	{actualTheme === "dark" ? "🌞" : "🌙"}
</Button>
```

### Tailwind Class Order
```typescript
// Layout → Spacing → Typography → Colors → Effects
"flex items-center justify-between px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
```

## 🚨 Troubleshooting

### Transparent Backgrounds
**Problem**: Components appear transparent
**Solution**: Use semantic background utilities or explicit colors for overlays
```typescript
// ✅ Preferred - Use semantic utilities (maps to CSS variables automatically)
"bg-background"  // Uses var(--color-background)
"bg-card"        // Uses var(--color-card)

// ✅ For modal overlays/dialogs that need solid backgrounds
"bg-white dark:bg-gray-900"

// ❌ Avoid arbitrary value syntax for theme colors
"bg-[var(--color-background)]"  // Unnecessary and verbose
```

### Theme Issues
**Problem**: Theme toggle not working
**Solution**: Ensure ThemeProvider wraps the app and use `actualTheme` from the hook
```typescript
// ✅ Correct usage
import { useTheme } from "@/app/providers/ThemeProvider";

const { theme, setTheme, actualTheme } = useTheme();
// Use actualTheme for conditional logic, theme for display
```

### Button Disabled States
**Problem**: Buttons should be disabled based on conditions
**Solution**: Use this pattern:
```typescript
<Button 
	disabled={!isActive}
	title={!isActive ? "Reason disabled" : "Action description"}
>
```

### Import Errors
**Problem**: Module not found errors
**Solution**: ALWAYS use absolute imports with `@/` prefix (NEVER use relative imports):
```typescript
// ✅ Correct - Use @/ prefix
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/app/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { realtimeKitClient } from "@/lib/realtime-kit/client";

// ❌ Wrong - Don't use relative imports
import { Button } from "../../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
```

## 📝 Commit Convention

```
type(scope): description

Examples:
feat(rawkode.studio): add theme toggle to navigation
fix(rawkode.studio): resolve dialog transparency issue
chore(rawkode.studio): update dependencies
```

**AI Commit Footer**:
```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 🔍 Key Files to Know

| File | Purpose |
|------|---------|
| `src/components/app/App.tsx` | Main app component with providers |
| `src/components/app/components/Layout.tsx` | Navigation and layout |
| `src/components/app/pages/Dashboard.tsx` | Meeting list and management |
| `src/components/ui/` | Reusable UI component library |
| `src/lib/realtime-kit/client.ts` | RealTimeKit API client |
| `src/styles/global.css` | CSS variables and global styles |

## 🎯 Performance Notes

- Use `client:only="react"` for React components in Astro
- Implement lazy loading for meeting components
- Use TanStack Query for server state management
- Leverage Cloudflare edge caching

## 🔐 Security Reminders

- **Never store secrets in code** - Always use Astro's env mechanism
- **Environment Variables**: Use `astro:env/server` for secrets (API keys, tokens, database URLs)
- **Public Config**: Use `astro:env/client` only for non-sensitive configuration
- **NEVER** use `process.env` directly - always import from Astro's env modules
- Use PKCE for OAuth flows
- Validate JWT tokens server-side
- Use secure cookie attributes
- Sanitize user inputs

```typescript
// ✅ Secure - Server-side secrets
import { 
	REALTIMEKIT_API_KEY, 
	REALTIMEKIT_ORGANIZATION_ID,
	AUTH_STATE_SECRET 
} from "astro:env/server";

// ✅ Public config (safe for client)
import { REALTIMEKIT_ENABLE_ANALYTICS, REALTIMEKIT_ENABLE_RECORDING } from "astro:env/client";
```

---

**Golden Rule**: When in doubt, follow existing patterns in the codebase. Check similar components for reference.