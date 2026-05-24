# Image service

Generate Open Graph PNG images from JSON payloads.

## Local development

```bash
bun install
bun run start
```

Render a preview page:

```bash
open 'http://localhost:4321/preview'
```

Render a PNG through the image endpoint:

```bash
curl \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"title":"Rawkode Academy","text":"Cloud native learning that gets to the point.","template":"gradient"}' \
  --output image.png \
  http://localhost:4321/image
```

Production Open Graph URLs use
`GET /image?v=<template-version>&payload=<base64url-json>`. The `v` query
parameter is part of the public URL so template changes invalidate external
caches.

## Running the service

The deployed Worker uses Cloudflare Browser Run to screenshot generated HTML at
1200x630. PNG responses are cached for 72 hours with the Worker Cache API.

## Template Previews

To validate the HTML templates locally:

```bash
bun test src/test/template-preview.test.ts
```
