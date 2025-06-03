# CLAUDE.md - Monorepo Conventions

## Commit Message Convention

This monorepo uses conventional commits with a specific scope format:

- Format: `type(scope): description`
- Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`
- Scope: Use the project or service name, with nested paths for sub-projects
  - Examples:
    - `feat(github): add new workflow`
    - `chore(rawkode.academy/website): update dependencies`
    - `fix(rawkode.academy/casting-credits): resolve database connection issue`

## Code Formatting

All code must adhere to the .editorconfig settings found in the project. When editing or creating files, ensure that:
- Indentation, line endings, and other formatting rules specified in .editorconfig files are followed
- Check for .editorconfig files at both the root level and in project subdirectories
- Apply the appropriate settings based on file type and location

## Linting and Type Checking

When making code changes, always run the appropriate linting and type checking commands before considering the task complete. If you're unsure of the specific commands for a project, check for scripts in package.json or ask for clarification.

## Project Structure

This is a monorepo containing multiple projects and services. Each project may have its own specific conventions documented in nested CLAUDE.md files. Always check for project-specific CLAUDE.md files when working in subdirectories.