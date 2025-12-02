# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a Bun workspace monorepo containing the Rawkode Academy platform - an educational platform for cloud-native technologies. Key domains:

- **`projects/rawkode.academy/`** - Main website and platform services
- **`projects/rawkode.studio/`** - Video meeting platform with RealTimeKit
- **`content/`** - Content management (technologies, articles, courses, videos)
- **`dagger/`** - CI/CD pipeline modules
- **`infrastructure/`** - Terraform CDK and Kubernetes configurations

## Environment & Runtime

**Always use Bun**, not Node.js/npm. This monorepo uses Bun as the package manager and runtime.

**Use `cuenv` when `env.cue` exists.** Many directories contain an `env.cue` file that manages environment variables (via 1Password) and defines tasks. When present:
```bash
cuenv task dev                 # Run the dev task with proper env vars
cuenv task build               # Run the build task
cuenv shell                    # Enter shell with env vars loaded
```

If no `env.cue` exists, use `bun run <script>` directly.

## Common Commands

### Root Level
```bash
bun install                    # Install all workspace dependencies
bun run knip                   # Detect unused dependencies
```

### Website (`projects/rawkode.academy/website/`)
```bash
cuenv task dev                 # Start Astro dev server (preferred, loads env)
cuenv task build               # Type check + build
bun run test                   # Run vitest
bun run test:watch             # Watch mode
bun run format                 # Biome format
bun run storybook              # Component development
bun run codegen                # GraphQL codegen
bun run sync:content           # Sync GraphQL content
```

### Studio (`projects/rawkode.studio/`)
```bash
bun run dev                    # Start Astro dev server
bun run build                  # Type check + build
bun run format && bun run lint # Format and lint before committing
```

### Platform Services (`projects/rawkode.academy/platform/<service>/`)
```bash
cuenv shell                    # Load env vars first (if env.cue exists)
bun run wrangler dev --local   # Local development
bun run wrangler deploy        # Deploy to Cloudflare
```

## Architecture

### Tech Stack
- **Runtime**: Bun (package manager & runtime)
- **Framework**: Astro 5 with React/Vue islands
- **Styling**: Tailwind CSS v4
- **API**: GraphQL federation (Hive Gateway) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Schema**: Pothos GraphQL with federation plugin
- **Testing**: Vitest with happy-dom
- **Linting**: Biome (replaces ESLint/Prettier)
- **CI/CD**: Dagger (TypeScript SDK) + GitHub Actions

### GraphQL Microservices Pattern
Each service in `platform/` follows:
```
platform/<service>/
├── data-model/         # Drizzle schema, migrations
├── read-model/         # GraphQL read API (Pothos + Yoga)
└── write-model/        # Cloudflare Workflows for writes
```

All new services must use Cloudflare D1 (not Turso/LibSQL).

## Commit Convention

Format: `type(scope): description`

**Types**: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`

**Scope**: Project path (e.g., `rawkode.academy/website`, `rawkode.studio`, `github`)

Examples:
```
feat(rawkode.academy/website): add theme toggle
fix(rawkode.studio): resolve dialog transparency
chore(github): update workflow
```

## Code Formatting

Follow `.editorconfig`:
- **Indentation**: Tabs (size 2)
- **Line endings**: LF
- **Charset**: UTF-8
- **YAML files**: Use spaces for indentation

Always run linting and type checking before committing.

## Project-Specific Guides

Check for `CLAUDE.md` files in subdirectories:
- `projects/rawkode.academy/website/CLAUDE.md` - Design system & component library
- `projects/rawkode.studio/CLAUDE.md` - Video platform conventions
- `projects/rawkode.academy/platform/CLAUDE.md` - GraphQL microservices guide
