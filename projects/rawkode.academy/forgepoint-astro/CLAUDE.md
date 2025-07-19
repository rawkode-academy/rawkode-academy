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

## Build

If a `build` script is available via `bun run build`; this must also be validated before committing any code changes.

## Version Control

- Commits without GPG signatures (`--no-gpg-sign`) are not permitted
- After every task, commit; do not push

## Post-Task Review

- After every task, use gemini -p "PROMPT" and replace PROMPT with a description of what you've done and ask for a review
- After every successful review, use gemini -p "PROMP" to ask for the next task where PROMP is our request for the next task

## Troubleshooting

- If you ever get stuck or have a question, do not ask me. Ask gemini with gemini -p "QUESTION"

## Task Continuation

- Do not stop until gemini tells you do. Always ask for the next task