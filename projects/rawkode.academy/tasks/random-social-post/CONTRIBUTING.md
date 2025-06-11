# Contributing to Random Social Post

Thank you for your interest in contributing to the Random Social Post project! This guide will help you get started with contributing to this Cloudflare Workers application.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Adding New Features](#adding-new-features)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project is part of the RawkodeAcademy monorepo. Please be respectful and constructive in all interactions.

## Getting Started

1. Fork the [RawkodeAcademy repository](https://github.com/RawkodeAcademy/RawkodeAcademy)
2. Clone your fork locally
3. Navigate to the project directory:
   ```bash
   cd projects/rawkode.academy/tasks/random-social-post
   ```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (preferred) or Node.js
- A Cloudflare account (free tier works for development)
- Wrangler CLI (installed automatically with dependencies)

### Initial Setup

```bash
# Install dependencies
bun install

# Generate TypeScript types
bun run cf-typegen

# Copy the example environment configuration
cp wrangler.example.jsonc wrangler.jsonc
```

### Local Development

1. Set up your local environment variables in `wrangler.jsonc`
2. For testing without actual social media accounts, you can mock the API calls
3. Run the development server:
   ```bash
   bun run dev
   ```

## Making Changes

### Branch Naming

Create a feature branch following this pattern:
- `feat/random-social-post/description` for new features
- `fix/random-social-post/description` for bug fixes
- `chore/random-social-post/description` for maintenance tasks

### Code Style

- Follow the existing code patterns in the project
- Use TypeScript for all new code
- Ensure proper type definitions
- Follow the `.editorconfig` settings

### Commit Messages

This monorepo uses conventional commits with specific scopes:

```
type(rawkode.academy/tasks/random-social-post): description

Examples:
feat(rawkode.academy/tasks/random-social-post): add Twitter support
fix(rawkode.academy/tasks/random-social-post): handle empty video responses
chore(rawkode.academy/tasks/random-social-post): update dependencies
```

## Testing

### Running Tests

```bash
bun test
```

### Writing Tests

- Add test files with `.test.ts` extension
- Test new functionality thoroughly
- Mock external API calls to avoid rate limits and credentials issues

### Manual Testing

For manual testing of the workflow:

```bash
# Trigger the workflow manually (requires deployment)
wrangler tail
```

## Submitting Changes

1. Ensure all tests pass
2. Run linting and type checking:
   ```bash
   bun run typecheck  # If available
   bun run lint       # If available
   ```
3. Commit your changes with a descriptive commit message
4. Push to your fork
5. Create a Pull Request to the main repository

### Pull Request Guidelines

- Title should follow the commit message format
- Include a clear description of the changes
- Reference any related issues
- Ensure CI checks pass
- Request review from maintainers

## Adding New Features

### Adding a New Social Platform

1. **Update Type Definitions** (`src/env.d.ts`):
   ```typescript
   interface Env {
     // Add your platform credentials
     PLATFORM_API_KEY: SecretsStoreSecret;
     PLATFORM_USER_ID: string;
   }
   ```

2. **Create AI Prompt** (`src/prompts/platform.txt`):
   - Study existing prompts for style
   - Keep platform-specific requirements in mind
   - Test the prompt with sample content

3. **Update Platform Enum** (`src/steps/generateSocialPost.ts`):
   ```typescript
   export enum SocialPlatforms {
     // ... existing platforms
     PLATFORM = "platform",
   }
   ```

4. **Implement Publishing Logic** (`src/steps/publishToSocialPlatforms.ts`):
   - Add platform-specific API integration
   - Handle authentication properly
   - Implement error handling

5. **Update Configuration** (`wrangler.jsonc`):
   - Add necessary environment variables
   - Document required secrets

### Adding New Video Sources

Modify `src/steps/fetchRandomVideo.ts` to add new video sources or change the selection logic.

## Reporting Issues

### Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Cloudflare Workers version, etc.)
- Any relevant error messages or logs

### Feature Requests

For feature requests:
- Describe the feature and its use case
- Explain how it benefits the project
- Consider implementation complexity
- Check if similar requests already exist

## Questions?

If you have questions about contributing:
- Check existing issues and discussions
- Ask in the project's communication channels
- Tag maintainers in your PR for guidance

Thank you for contributing to Random Social Post!