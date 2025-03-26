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

## Template Previews

When changes are made to this repository in a pull request, a GitHub Action will automatically:

1. Generate preview images for all templates
2. Post these images as a comment on the pull request

This makes it easy to review visual changes to templates without having to run the service locally.

### Running Template Previews Locally

To generate template previews locally:

```bash
# Run the template preview test
bun test src/test/template-preview.test.ts
```

This will output preview data that can be used to generate images.
