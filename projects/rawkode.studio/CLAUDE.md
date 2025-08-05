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
- **Formatter/Linter**: Biome (v2.1.3+) - Fast, unified toolchain
- **Package Manager**: Bun

### Frontend Stack
- **Frameworks**: 
  - Astro (SSR/SSG) - Main web framework
  - React 19+ - Interactive components
  - Vue 3 - Alternative components
- **Styling**: 
  - Tailwind CSS v4 - Utility-first CSS
  - CSS Variables for design tokens
- **UI Components**: 
  - Radix UI - Accessible component primitives
  - shadcn/ui patterns - Composable component architecture
  - class-variance-authority (CVA) - Variant management

### Backend Stack
- **Platform**: Cloudflare Workers/Pages
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