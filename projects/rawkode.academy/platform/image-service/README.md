# Image service

Generate images (`svg` & `png`) with a given set of parameters.

## Local development

```bash
bun install
bun run start
```

Open browser at
`http://localhost:4321/image?payload=MAformatAFApngACAtextAFAYHenloCWdisWisWdoggoAN`

### Templates

Templates are located in [src/templates/](src/templates/). Adding e.g.
[`template=80s`](http://localhost:4321/image?payload=MAformatAFApngACAtextAFAYHenloCWdisWisWdoggoACAtemplateAFA80sAN)
as a query parameter selects another template.

## Running the service

This works only on Cloudflare Workers Paid Tier, as it is too large. Free Tier
only allows 1MB of code.
