# CLAUDE.md - Rawkode Academy Project

This is the main Rawkode Academy project containing the website, API gateway, and platform microservices.

## Project Structure

```
rawkode.academy/
├── api/              # GraphQL Hive Gateway
├── platform/         # Microservices (see platform/CLAUDE.md)
├── website/          # Astro website (see website/CLAUDE.md)
└── generators/       # Service scaffolding tools
```

## Environment Setup

Most directories have an `env.cue` file. Use `cuenv` for task execution:

```bash
cuenv task install    # Install dependencies
cuenv task dev        # Start development
cuenv task deploy     # Deploy services
```

## Platform Services

Services follow a CQRS pattern with read/write separation. Each service lives in `platform/<service>/` with:
- `data-model/` - Drizzle schema and migrations
- `read-model/` - GraphQL subgraph (Pothos + Yoga)
- `write-model/` - Cloudflare Workflows

**All new services must use Cloudflare D1** (not Turso/LibSQL).

See `platform/CLAUDE.md` for the comprehensive microservices guide including:
- Creating new services with projen
- GraphQL federation patterns
- Cloudflare Workflows
- Database migrations

## Website

The website uses Astro 5 with React/Vue islands.

See `website/CLAUDE.md` for:
- Theme system and design tokens
- Component library (Card, Hero, Layout)
- Development workflow

## Quick Commands

### Website
```bash
cd website
cuenv task dev        # Start Astro dev server
cuenv task build      # Build for production
bun run storybook     # Component development
```

### Platform Service
```bash
cd platform/<service>
bunx wrangler dev --local              # Local development
bunx drizzle-kit generate              # Generate migrations
bunx wrangler d1 migrations apply DB   # Apply migrations
bunx wrangler deploy --config ./read-model/wrangler.jsonc
```

## Observability

All Cloudflare Workers must configure observability for Grafana. Add to `wrangler.jsonc`:

```jsonc
"observability": {
  "traces": {
    "enabled": true,
    "destinations": ["grafana-traces"]
  },
  "logs": {
    "enabled": true,
    "destinations": ["grafana-logs"]
  }
}
```

Workers that need analytics should also add the ANALYTICS service binding:

```jsonc
"services": [
  {
    "binding": "ANALYTICS",
    "service": "rawkode-tools-observability-collector"
  }
]
```

## Related Documentation

- `platform/CLAUDE.md` - GraphQL microservices architecture
- `website/CLAUDE.md` - Design system and components
