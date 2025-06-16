# CLAUDE.md - Website Project Conventions

## Architecture Decision Records (ADRs)

This project uses Architecture Decision Records to document significant architectural decisions. All ADRs are located in `website/content/adrs/`.

When making architectural changes or introducing new patterns, please:

1. Review existing ADRs to understand current decisions
2. Create new ADRs following the established numbering pattern (e.g., `0003-title.md`)
3. Follow the ADR format used in existing records

## Code Formatting and Linting

Before committing any code changes, you MUST run:

```bash
bun run biome format
bun run biome lint
```

These commands ensure consistent code formatting and catch potential issues. All code must pass both formatting and linting checks before being committed.
