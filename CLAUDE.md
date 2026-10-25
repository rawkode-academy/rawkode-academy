# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a Bun workspace monorepo containing the Rawkode Academy platform. Key domains:

- **`projects/rawkode.academy/`** - Main website and platform services
- **`packages/`** - Shared packages (design system, `@rawkodeacademy/rich-text`)
- **`infrastructure/`** - Terraform and DNS configurations

## Content

There is no file-based content in the repo. Articles, videos, shows, people, technologies, courses, learning paths, news, changelog, ADRs and testimonials are rows in D1-backed platform services (`projects/rawkode.academy/platform/<service>`), served through the GraphQL gateway (`projects/rawkode.academy/api`, `https://api.rawkode.academy/`). Rich text is stored as TipTap/ProseMirror JSON (GraphQL scalar `RichTextDocument`); use `@rawkodeacademy/rich-text` (`packages/rich-text`) to convert from/to Markdown (`/markdown`), validate (`/schema`) and render (`toHtml`, `toText`).

## Environment & Runtime

**Always use Bun**, not Node.js/npm.

**Use `cuenv` when `env.cue` exists.** Many directories have an `env.cue` file for environment variables and tasks:

```bash
cuenv task dev       # Run dev task with env vars
cuenv task build     # Run build task
```

If no `env.cue` exists, use `bun run <script>` directly.

**After adding or changing a cuenv-managed service** (any directory with an `env.cue`/`service.cue`), run `cuenv sync -A` at the repo root to materialize generated files (`wrangler.jsonc`, `package.json`, `http/main.ts`, `drizzle.config.ts`) so the Bun workspace and typechecks resolve.

## Common Commands

```bash
bun install          # Install all workspace dependencies
bun run knip         # Detect unused dependencies
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** Astro 7 (SSR on Cloudflare Workers) with React/Vue islands
- **Styling:** Tailwind CSS v4
- **API:** GraphQL federation (Hive Gateway) on Cloudflare Workers
- **Database:** Cloudflare D1 with Drizzle ORM
- **Testing:** Vitest
- **Linting:** Biome
- **CI/CD:** GitHub Actions

## Commit Convention

Format: `type(scope): description`

**Types:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`

**Scope:** Project path (e.g., `rawkode.academy/website`)

```
feat(rawkode.academy/website): add theme toggle
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
| `infrastructure/CLAUDE.md` | Infrastructure configuration |
