# CLAUDE.md - Content Management

This directory contains all content for the Rawkode Academy platform, structured as MDX files with frontmatter schemas.

## Content Types

| Directory | Purpose | Example Fields |
|-----------|---------|----------------|
| `technologies/` | Technology profiles (320+) | name, website, cncf status, matrix |
| `people/` | Guest/contributor profiles | id, name, social links |
| `articles/` | Blog articles and changelogs | title, description, type, publishedAt |
| `courses/` | Course metadata | title, description, lessons |
| `shows/` | Show metadata | title, schedule |
| `videos/` | Video content | title, youtube ID |
| `testimonials/` | User testimonials | quote, author |
| `learning-paths/` | Curated learning paths | title, technologies |
| `series/` | Content series | title, parts |
| `adrs/` | Architecture Decision Records | title, status, context |

## Adding Content

### Technology Profile

Create `technologies/<slug>/index.mdx`:

```mdx
---
name: Technology Name
website: 'https://example.com/'
documentation: 'https://docs.example.com/'
license: Apache-2.0
status: stable
category: Orchestration & Management
subcategory: Scheduling & Orchestration
cncf:
  status: graduated  # sandbox, incubating, graduated, archived
  accepted: '2020-01-01'
matrix:
  status: advocate   # assess, trial, adopt, advocate
  confidence: deep-experience
  trajectory: rising
---
Content description here...
```

**Schema reference:** See `src/technologies.ts` for the complete Zod schema.

### Person Profile

Create `people/<id>.mdx`:

```mdx
---
id: username
name: Full Name
github: github-username
bluesky: handle.bsky.social
linkedin: linkedin-username
website: https://example.com/
---
```

### Article

Create `articles/<slug>/index.mdx` with appropriate frontmatter:

```mdx
---
title: "Article Title"
description: "Brief description"
type: article  # article, tutorial, guide, news, or changelog
publishedAt: 2025-01-01T00:00:00.000Z
authors:
  - rawkode
---
Content here...
```

For changelog entries, use `type: changelog`.

## Directory Structure

```
content/
├── technologies/<slug>/
│   ├── index.mdx        # Profile content
│   ├── icon.svg         # Square logo (optional)
│   ├── horizontal.svg   # Wide logo (optional)
│   └── stacked.svg      # Vertical logo (optional)
├── people/<id>.mdx
├── articles/<slug>/index.mdx
└── src/
    ├── technologies.ts  # Zod schema for technologies
    └── dimensions.js    # Enum values for matrix fields
```

## Schemas and Validation

- **Technologies:** `src/technologies.ts` defines the Zod schema
- **Dimension values:** `src/dimensions.js` contains enum values for CNCF status, matrix status, confidence, trajectory

## Automation

- `review_technologies.py` - Python script for reviewing technology profiles
- `scripts/` - Additional automation scripts

## Logos

Technology logos should be placed in the technology's directory:
- `icon.svg` - Square icon (set `logos.icon: true` in frontmatter)
- `horizontal.svg` - Horizontal logo (set `logos.horizontal: true`)
- `stacked.svg` - Stacked/vertical logo (set `logos.stacked: true`)
