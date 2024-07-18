# OpenGraph service

Generate OpenGraph images with a given set of parameters.

## Local development

```bash
bun install
bun run start
```

Open browser at `http://localhost:4321/image?format=png&text=henlo%20dis%20is%20doggo%21`

### Templates

Templates are located in [src/templates/](src/templates/).
Adding e.g. [`template=80s`](http://localhost:4321/image?format=png&text=henlo%20dis%20is%20doggo%21&template=80s) as a query parameter selects another template.

## Running the service

This works only on Cloudflare Workers Paid Tier, as it is too large. Free Tier only allows 1MB of code.
