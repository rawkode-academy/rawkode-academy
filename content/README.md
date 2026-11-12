# Content

Articles on [rawkode.academy/read](https://rawkode.academy/read) are the
Markdown files in `content/articles`. To publish or fix one, open a pull
request. Everything else on the site (videos, shows, people, technologies,
courses, news) lives in the platform's databases, not here.

## Add an article

Create `content/articles/<slug>.mdx`. The file name is the URL:
`content/articles/how-i-git.mdx` is served at `/read/how-i-git`. Use lowercase
letters, digits and hyphens.

If the article has images of its own, give it a directory instead and put
them beside it:

```
content/articles/my-article/index.mdx
content/articles/my-article/cover.png
content/articles/my-article/terminal.png
```

`.md` files work too. Use `.mdx` when you need one of the components below.

## Frontmatter

```yaml
---
title: "Seccomp for Kubernetes workloads"
description: One or two sentences, used for search results and link previews.
type: guide                # tutorial (default), article, guide or news
publishedAt: 2026-10-01
authors:
  - rawkode                # ids from rawkode.academy/people/<id>
technologies:
  - kubernetes             # ids from rawkode.academy/technology/<id>
cover:
  image: ./cover.png       # beside the article, or an absolute URL
  alt: What the image shows
---
```

Required: `title`, `description`, `publishedAt`, `authors`.

Optional:

| Field | Purpose |
|---|---|
| `subtitle` | A line under the title |
| `type` | `tutorial`, `article`, `guide` or `news` |
| `technologies` | Technology ids; they tag the article and list it on those pages |
| `cover` | `image` and `alt`. A remote `image` URL also needs `width` and `height` |
| `openGraph` | `title` and `subtitle` for link previews, when they should differ |
| `updatedAt` | The date of a substantial revision |
| `updates` | A change log shown above the article: `date` and `description` |
| `resources` | Links listed after the article: `title`, `type: url`, `url`, `description`, `category` |
| `howto` | `true` adds how-to structured data built from the headings |
| `draft` | `true` keeps the article off the published site |
| `categories`, `tags` | Free-form labels |

A misspelt or unknown field fails the build and names the file and the field.

## Writing

The body is Markdown (GitHub flavoured: tables, task lists, fenced code). Code
fences take a language and an optional title:

````md
```yaml title="deployment.yaml"
spec:
  replicas: 3
```
````

Technology names are linked to their pages for you, and external links open
in a new tab.

Images use normal Markdown, with a path relative to the article:

```md
![The terminal after the rollout](./terminal.png)
```

`.mdx` files can import these components:

```mdx
import Aside from "@/components/Aside.astro";
import ZoomableImage from "@/components/image/ZoomableImage.astro";
import ThemeAwareImage from "@/components/common/ThemeAwareImage.astro";
import VideoPlayer from "@/components/video/player.vue";
import Diagram from "@/components/articles/Diagram.astro";

<Aside variant="tip">
  Keep `RuntimeDefault` until your tests cover more than startup.
</Aside>
```

Any other import or component fails the build. Look at the existing articles
for worked examples of each.

## Preview

```bash
cd projects/rawkode.academy/website
cuenv task dev
```

The development server shows drafts and future-dated articles and reloads when
a file changes. A pull request also gets a preview deployment.

## Publishing

Merging to `main` deploys the site with the article. A `draft: true` article,
or one whose `publishedAt` is still in the future, is left out of the
deployment: it appears with the first deploy after that date.
