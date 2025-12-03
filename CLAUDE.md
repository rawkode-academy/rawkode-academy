# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a Bun workspace monorepo containing the Rawkode Academy platform. Key domains:

- **`projects/rawkode.academy/`** - Main website and platform services
- **`projects/rawkode.studio/`** - Video meeting platform
- **`content/`** - Content management (technologies, articles, courses)
- **`dagger/`** - CI/CD pipeline modules
- **`infrastructure/`** - Terraform and DNS configurations

## Environment & Runtime

**Always use Bun**, not Node.js/npm.

**Use `cuenv` when `env.cue` exists.** Many directories have an `env.cue` file for environment variables and tasks:

```bash
cuenv task dev       # Run dev task with env vars
cuenv task build     # Run build task
```

If no `env.cue` exists, use `bun run <script>` directly.

## Common Commands

```bash
bun install          # Install all workspace dependencies
bun run knip         # Detect unused dependencies
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** Astro 5 with React/Vue islands
- **Styling:** Tailwind CSS v4
- **API:** GraphQL federation (Hive Gateway) on Cloudflare Workers
- **Database:** Cloudflare D1 with Drizzle ORM
- **Testing:** Vitest
- **Linting:** Biome
- **CI/CD:** Dagger (TypeScript SDK) + GitHub Actions

## Commit Convention

Format: `type(scope): description`

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`

**Scope:** Project path (e.g., `rawkode.academy/website`, `rawkode.studio`)

```
feat(rawkode.academy/website): add theme toggle
fix(rawkode.studio): resolve dialog transparency
```

## Code Formatting

Follow `.editorconfig`:
- **Indentation:** Tabs (size 2)
- **Line endings:** LF
- **Charset:** UTF-8
- **YAML:** Use spaces for indentation

## Project-Specific Guides

| Path | Purpose |
|------|---------|
| `projects/rawkode.academy/CLAUDE.md` | Academy project overview |
| `projects/rawkode.academy/platform/CLAUDE.md` | GraphQL microservices guide |
| `projects/rawkode.academy/website/CLAUDE.md` | Design system & components |
| `projects/rawkode.studio/CLAUDE.md` | Video platform conventions |
| `content/CLAUDE.md` | Content management |
| `dagger/CLAUDE.md` | CI/CD modules |
| `infrastructure/CLAUDE.md` | Infrastructure configuration |
