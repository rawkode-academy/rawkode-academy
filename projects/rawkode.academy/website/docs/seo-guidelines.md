# SEO Guidelines and Testing

This document outlines the SEO requirements and testing approach for the Rawkode Academy website to ensure consistent and effective search engine optimization.

## Required SEO Components

All pages on the Rawkode Academy website must include the following SEO components:

### Basic Meta Tags

- `<meta charset="utf-8">`
- `<meta name="viewport" content="width=device-width">`
- `<meta name="description" content="...">`
- `<title>Page Title | Rawkode Academy</title>`
- `<link rel="canonical" href="...">`

### OpenGraph Meta Tags

- `<meta property="og:type" content="website or article">`
- `<meta property="og:title" content="...">`
- `<meta property="og:description" content="...">`
- `<meta property="og:url" content="...">`
- `<meta property="og:image" content="...">`

### Twitter Card Meta Tags

- `<meta name="twitter:card" content="summary_large_image">`
- `<meta property="twitter:domain" content="rawkode.academy">`
- `<meta property="twitter:url" content="...">`
- `<meta name="twitter:title" content="...">`
- `<meta name="twitter:description" content="...">`
- `<meta name="twitter:image" content="...">`

### Article-Specific Meta Tags (for blog posts and series)

- `<meta property="article:published_time" content="...">`
- `<meta property="article:modified_time" content="...">`
- `<meta property="article:publisher" content="https://rawkode.academy">`

### Video-Specific Meta Tags (for video pages)

- `<meta property="og:type" content="video.other">`
- `<meta property="og:video" content="...">`
- `<meta property="og:video:url" content="...">`
- `<meta property="og:video:thumbnail" content="...">`
- `<meta property="og:video:duration" content="...">`

### JSON-LD Structured Data

All pages must include appropriate structured data based on page type:

#### Breadcrumbs (All Pages)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://rawkode.academy"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Section",
      "item": "https://rawkode.academy/section"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Page Title",
      "item": "https://rawkode.academy/section/page"
    }
  ]
}
```

#### Video (Single Video Pages)

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Video Title",
  "description": "Video Description",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "uploadDate": "YYYY-MM-DDT00:00:00Z",
  "duration": "H:MM:SS",
  "contentUrl": "https://example.com/video.mp4",
  "url": "https://rawkode.academy/watch/video-title"
}
```

#### Video List (Video Collection Pages)

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Video List Title",
  "description": "Video List Description",
  "url": "https://rawkode.academy/watch"
}
```

## Testing

The SEO requirements are validated using comprehensive tests that ensure all necessary meta tags and structured data are present and properly formatted. 

The test suite examines:

1. Presence of all required meta tags
2. Correct content values for meta tags
3. Appropriate conditional tags based on content type
4. Valid JSON-LD structured data formats

### Running the Tests

```
bun test src/components/html/seo.test.ts
```

## Implementation Notes

- The `head.astro` component includes basic meta tags and imports the OpenGraph component
- The `opengraph.astro` component handles OpenGraph, Twitter Card, and breadcrumb structured data
- The `video-metadata.astro` component adds video-specific meta tags and structured data
- For dynamic image generation, we use the image service with encoded payloads

## Best Practices

1. Always provide a unique title for each page
2. Keep descriptions under 160 characters and make them compelling
3. Use high-quality images for thumbnails and OpenGraph images
4. Ensure all structured data is valid according to schema.org standards
5. Use canonical URLs to prevent duplicate content issues
6. Include appropriate publisher and author information for articles